// Endpoint simplificado para post-compra con identificación por avatar
import 'dotenv/config';
import { MercadoPagoConfig } from 'mercadopago';
import { db, getUserFromFirestore, updateUserTipo, createPaymentRecord } from './lib/firebase.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });

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
    console.log('🔔 POST-COMPRA-SIMPLE: Recibiendo datos...');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const {
      paymentId,      // ID del pago de Mercado Pago
      userAvatar,     // URL del avatar del usuario (OBLIGATORIO)
      userName        // Nombre del usuario (opcional)
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
    console.log(`   - User Avatar: ${userAvatar}`);
    console.log(`   - User Name: ${userName || 'No proporcionado'}`);

    // 1. Buscar usuario por avatar (método principal)
    console.log(`\n🔍 Buscando usuario por avatar...`);
    const usersSnapshot = await db.collection('users')
      .where('avatar', '==', userAvatar)
      .limit(1)
      .get();

    let user = null;
    let userId = null;

    if (!usersSnapshot.empty) {
      user = usersSnapshot.docs[0].data();
      userId = usersSnapshot.docs[0].id;
      console.log(`✅ Usuario encontrado por avatar: ${userId}`);
      console.log(`📧 Email: ${user.email || 'No email'}`);
      console.log(`🎨 Tipo actual: ${user.tipoUsuario || 'white'}`);
    } else {
      console.log(`❌ No se encontró usuario con ese avatar`);

      // Listar avatares disponibles
      const allUsersSnapshot = await db.collection('users').limit(5).get();
      if (!allUsersSnapshot.empty) {
        console.log(`📋 Avatares disponibles:`);
        allUsersSnapshot.docs.forEach((doc, index) => {
          const userData = doc.data();
          console.log(`  ${index + 1}. ${userData.email || 'No email'}: ${userData.avatar ? userData.avatar.substring(0, 50) + '...' : 'No avatar'}`);
        });
      }

      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No se encontró un usuario con ese avatar',
        debug: {
          avatarProvided: userAvatar,
          availableAvatars: allUsersSnapshot.docs.map(doc => ({
            email: doc.data().email,
            avatar: doc.data().avatar
          }))
        }
      });
    }

    // 2. Verificar el pago en Mercado Pago
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

    if (payment.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Payment not approved',
        message: `El pago no está aprobado. Status: ${payment.status}`
      });
    }

    // 3. Determinar el plan
    const planId = payment.external_reference?.split('_')[0] || 'unknown';
    console.log(`📋 Plan detectado: ${planId}`);

    // 4. Determinar tipoUsuario y permisos
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
    }

    console.log(`🎨 Asignando tipoUsuario: ${tipoUsuario}`);

    // 5. Actualizar el usuario
    console.log(`\n🔄 Actualizando rol del usuario...`);

    await updateUserTipo(userId, tipoUsuario, permissions);

    // Actualizar información adicional
    const updateData = {
      lastPayment: paymentId,
      updatedAt: new Date().toISOString()
    };

    if (userName) updateData.displayName = userName;

    await db.collection('users').doc(userId).update(updateData);
    console.log(`✅ Usuario actualizado exitosamente`);

    // 6. Guardar registro del pago
    await createPaymentRecord({
      id: paymentId,
      userId: userId,
      planId: planId,
      status: payment.status,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      externalReference: payment.externalReference
    });

    // 7. Responder con éxito
    const response = {
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        userId: userId,
        userEmail: user.email,
        tipoUsuario: tipoUsuario,
        permissions: permissions,
        planId: planId,
        paymentId: paymentId,
        avatar: userAvatar,
        displayName: userName || user.displayName
      }
    };

    console.log(`\n🎉 ¡ÉXITO! Usuario ${userId} actualizado a ${tipoUsuario}`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error en POST-COMPRA-SIMPLE:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error procesando la compra post-pago',
      details: error.message
    });
  }
}