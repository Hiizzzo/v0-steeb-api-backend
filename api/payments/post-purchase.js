// Endpoint para recibir datos del usuario después de la compra y asignar el rol correspondiente
import 'dotenv/config';
import { MercadoPagoConfig } from 'mercadopago';
import { db, getUserFromFirestore, updateUserTipo, createPaymentRecord, addShinyUserToGlobalCounter, getShinyUserPosition } from '../lib/firebase.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });

// Helper function to convert numbers to Spanish ordinals
const getOrdinal = (num) => {
  const exceptions = {
    1: 'primer',
    2: 'segundo',
    3: 'tercer',
    4: 'cuarto',
    5: 'quinto',
    6: 'sexto',
    7: 'séptimo',
    8: 'octavo',
    9: 'noveno',
    10: 'décimo',
    11: 'undécimo',
    12: 'duodécimo'
  };

  if (exceptions[num]) {
    return exceptions[num];
  }

  // For larger numbers, use generic ordinal
  if (num >= 13 && num <= 19) {
    return 'decimo' + getOrdinal(num - 10);
  }

  if (num >= 20 && num <= 29) {
    return 'vigésimo ' + getOrdinal(num - 20);
  }

  if (num >= 30 && num <= 99) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    const tensWords = ['trigésimo', 'cuadragésimo', 'quincuagésimo', 'sexagésimo', 'septuagésimo', 'octogésimo', 'nonagésimo'];
    return tensWords[tens - 3] + (units > 0 ? ' ' + getOrdinal(units) : '');
  }

  // For simplicity beyond 100
  return `${num}º`;
};

const mpRequest = async (endpoint, options = {}) => {
  const url = `https://api.mercadopago.com${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return await response.json();
};

const fetchPaymentById = async (id) => {
  console.log(`🔍 Buscando pago con ID: ${id}`);
  return await mpRequest(`/v1/payments/${id}`, { method: 'GET' });
};

export default async function handler(req, res) {
  // Enhanced CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8083',
    'http://127.0.0.1:8083',
    'https://v0-steeb-api-backend.vercel.app',
    'https://steeb.vercel.app',
  ];

  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Solo se permite POST'
    });
  }

  try {
    console.log('🔔 POST-COMPRA: Recibiendo datos del usuario...');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const {
      paymentId,           // ID del pago de Mercado Pago
      userAvatar,          // URL del avatar del usuario (OBLIGATORIO para identificación)
      userName             // Nombre del usuario (opcional)
    } = req.body || {};

    if (!paymentId || !userAvatar) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'paymentId y userAvatar son requeridos'
      });
    }

    console.log(`🎯 Datos recibidos:`);
    console.log(`   - Payment ID: ${paymentId}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - User Email: ${userEmail}`);
    console.log(`   - User Avatar: ${userAvatar || 'No proporcionado'}`);
    console.log(`   - User Name: ${userName || 'No proporcionado'}`);

    // 1. Verificar el pago en Mercado Pago
    console.log(`\n💳 Verificando pago en Mercado Pago...`);
    const payment = await fetchPaymentById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        message: 'No se encontró el pago en Mercado Pago'
      });
    }

    console.log(`✅ Pago encontrado:`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Amount: ${payment.transaction_amount} ${payment.currency_id}`);
    console.log(`   - Plan (de external_reference): ${payment.external_reference}`);

    // 2. Verificar que el pago esté aprobado
    if (payment.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Payment not approved',
        message: `El pago no está aprobado. Status actual: ${payment.status}`,
        paymentStatus: payment.status
      });
    }

    // 3. Extraer el planId de la external_reference
    const planId = payment.external_reference?.split('_')[0] || 'unknown';
    console.log(`📋 Plan detectado: ${planId}`);

    // 4. Determinar el tipoUsuario y permisos según el plan
    let tipoUsuario = 'white';
    let permissions = ['basic_features'];

    switch (planId) {
      case 'black-user-plan':
        tipoUsuario = 'black';
        permissions = ['dark_mode', 'basic_features'];
        break;
      case 'shiny-user-plan':
        tipoUsuario = 'shiny';
        permissions = ['shiny_game', 'dark_mode', 'premium_features', 'exclusive_content'];
        break;
      default:
        tipoUsuario = 'white';
        permissions = ['basic_features'];
    }

    console.log(`🎨 Asignando tipoUsuario: ${tipoUsuario}`);
    console.log(`🔑 Permisos: ${JSON.stringify(permissions)}`);

    // 5. Extraer el userId del payment para identificar al usuario
    // Nota: Esto puede venir en el payment metadata o external_reference
    const userId = payment.metadata?.user_id || payment.description?.split('ID:')[1] || 'unknown';

    if (userId === 'unknown') {
      console.error('❌ No se pudo identificar el usuario del pago');
      return res.status(400).json({
        success: false,
        error: 'User identification failed',
        message: 'No se pudo identificar al usuario del pago'
      });
    }

    // 6. Buscar o crear el usuario en Firebase
    console.log(`\n🔍 Buscando usuario en Firebase: ${userId}`);
    let user = await getUserFromFirestore(userId);

    if (!user) {
      console.log(`👤 Usuario no encontrado, creándolo...`);

      // Crear usuario con los datos proporcionados
      const userRef = db.collection('users').doc(userId);
      const userDoc = {
        id: userId,
        email: userEmail,
        tipoUsuario: tipoUsuario,
        permissions: permissions,
        avatar: userAvatar || null,
        displayName: userName || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastPayment: paymentId,
        isActive: true
      };

      await userRef.set(userDoc);
      console.log(`✅ Usuario creado exitosamente`);
      user = userDoc;
    } else {
      console.log(`🔄 Usuario encontrado, actualizando rol...`);

      // Actualizar el rol del usuario
      await updateUserTipo(userId, tipoUsuario, permissions);

      // Actualizar información adicional si se proporcionó
      const updateData = {
        lastPayment: paymentId,
        updatedAt: new Date().toISOString()
      };

      if (userAvatar) updateData.avatar = userAvatar;
      if (userName) updateData.displayName = userName;

      await db.collection('users').doc(userId).update(updateData);
      console.log(`✅ Usuario actualizado exitosamente`);
    }

    // 7. Si es un usuario shiny, agregar al contador global
    let shinyStats = null;
    let congratulationMessage = null;

    if (tipoUsuario === 'shiny') {
      console.log(`🌟 Agregando usuario al contador global shiny...`);

      try {
        // Verificar si ya es shiny para evitar duplicados
        const existingPosition = await getShinyUserPosition(userId);

        if (!existingPosition) {
          // Es un nuevo usuario shiny
          shinyStats = await addShinyUserToGlobalCounter(
            userId,
            userName || user?.displayName || null,
            userAvatar || user?.avatar || null
          );

          // Generar mensaje de felicitación según posición
          const position = shinyStats.position;
          const ordinal = getOrdinal(position);

          congratulationMessage = `¡FELICIDADES! 🎉 ${userName || ' crack'} sos ${ordinal} usuario en conseguir SHINY mode en todo STEEB. ¡Sos parte de un club exclusivo de solo ${shinyStats.totalShinyUsers} personas! ✨`;

          console.log(`✅ Usuario agregado al contador global. Posición: ${position}/${shinyStats.totalShinyUsers}`);
          console.log(`🎉 Mensaje de felicitación: ${congratulationMessage}`);
        } else {
          // Ya era shiny previamente
          congratulationMessage = `¡Ya eres parte del club SHINY! 🌟 Fuiste el ${getOrdinal(existingPosition.position)} usuario en desbloquearlo.`;
          shinyStats = {
            position: existingPosition.position,
            totalShinyUsers: existingPosition.totalShinyUsers
          };

          console.log(`ℹ️ Usuario ya era shiny. Posición existente: ${existingPosition.position}/${existingPosition.totalShinyUsers}`);
        }
      } catch (error) {
        console.error('❌ Error al agregar usuario al contador global shiny:', error);
        // Continuar con el proceso aunque falle el contador
      }
    }

    // 8. Guardar el registro del pago
    console.log(`\n💾 Guardando registro del pago...`);
    await createPaymentRecord({
      id: paymentId,
      userId: userId,
      planId: planId,
      status: payment.status,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      externalReference: payment.external_reference
    });

    console.log(`✅ Registro del pago guardado`);

    // 9. Responder con éxito
    const response = {
      success: true,
      message: tipoUsuario === 'shiny' && congratulationMessage
        ? congratulationMessage
        : 'Usuario actualizado exitosamente',
      data: {
        userId: userId,
        userEmail: userEmail,
        tipoUsuario: tipoUsuario,
        permissions: permissions,
        planId: planId,
        paymentId: paymentId,
        paymentStatus: payment.status,
        avatar: userAvatar,
        displayName: userName
      },
      meta: {
        timestamp: new Date().toISOString(),
        paymentProcessed: true,
        userRoleUpdated: true
      },
      // Agregar información shiny si aplica
      ...(shinyStats && {
        shinyStats: {
          position: shinyStats.position,
          totalShinyUsers: shinyStats.totalShinyUsers,
          isExclusive: shinyStats.totalShinyUsers <= 10, // Es exclusivo si hay 10 o menos
          message: congratulationMessage
        }
      })
    };

    console.log(`\n🎉 ¡PROCESO COMPLETADO!`);
    console.log(`   ✅ Pago verificado: ${payment.status}`);
    console.log(`   ✅ Usuario actualizado: ${userId}`);
    console.log(`   ✅ Nuevo tipo: ${tipoUsuario}`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error en POST-COMPRA:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error procesando la compra post-pago',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}