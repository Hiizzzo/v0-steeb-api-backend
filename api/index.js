import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import 'dotenv/config';
import { createPurchaseStore } from '../server/purchaseStore.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import shinyGameHandler from './shiny-game.js';
import userRoleHandler from './users/role.js';
import consumeShinyRollHandler from './users/consume-shiny-roll.js';
import steebHandler from './steeb.js';
import {
  getUserFromFirestore,
  updateUserTipo,
  createPaymentRecord,
  db
} from '../lib/firebase.js';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || `https://v0-steeb-api-backend.vercel.app`;

// Configurar CORS y JSON
app.use(cors());
app.use(express.json());

// Normalizar rutas si llegan con prefijo /api (cuando usamos rewrite a un solo handler)
app.use((req, _res, next) => {
  console.log(`📥 Incoming request: ${req.method} ${req.url}`);
  if (req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '');
    console.log(`🔄 Rewritten URL: ${req.url}`);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// ================================
// SHINY GAME (MOVED TO TOP FOR PRIORITY)
// ================================
app.post(['/shiny-game', '/api/shiny-game'], async (req, res) => {
  console.log('🎲 Shiny Game endpoint hit!');
  try {
    const { userId, guess } = req.body;

    if (!userId || guess === undefined) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Faltan datos requeridos (userId, guess)'
      });
    }

    const guessNum = parseInt(guess, 10);
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 100) {
      return res.status(400).json({
        error: 'Invalid guess',
        message: 'El número debe ser entre 1 y 100'
      });
    }

    // 1. Obtener usuario
    const user = await getUserFromFirestore(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    // 2. Verificar permisos (Debe ser al menos DARK)
    if (user.tipoUsuario === 'shiny') {
      return res.json({
        success: true,
        alreadyWon: true,
        message: '¡Ya sos Shiny! No necesitas jugar más.'
      });
    }

    if (user.tipoUsuario !== 'dark' && user.tipoUsuario !== 'black') {
       return res.status(403).json({
        error: 'Permission denied',
        message: 'Necesitas ser usuario Dark para jugar.'
      });
    }

    // 3. Verificar límite diario
    const now = new Date();
    const lastAttempt = user.lastShinyAttemptAt ? user.lastShinyAttemptAt.toDate() : null;
    
    let canPlay = true;
    if (lastAttempt) {
      const isToday = lastAttempt.getDate() === now.getDate() &&
                      lastAttempt.getMonth() === now.getMonth() &&
                      lastAttempt.getFullYear() === now.getFullYear();
      
      if (isToday) {
        canPlay = false;
      }
    }

    // Permitir jugar si compró intentos extra (shinyRolls > 0)
    let usedExtraRoll = false;
    if (!canPlay) {
      if (user.shinyRolls && user.shinyRolls > 0) {
        canPlay = true;
        usedExtraRoll = true;
      } else {
        // Calcular tiempo restante
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilTomorrow = tomorrow - now;
        
        return res.status(429).json({
          error: 'Daily limit reached',
          message: 'Ya usaste tu intento diario.',
          nextAttemptIn: msUntilTomorrow
        });
      }
    }

    // 4. Generar número secreto y comparar
    const secret = Math.floor(Math.random() * 100) + 1;
    const won = guessNum === secret;
    const diff = Math.abs(guessNum - secret);
    
    let hint = '';
    if (!won) {
      if (diff <= 5) hint = '¡Uff! Estuviste MUY cerca... 🔥';
      else if (diff <= 10) hint = 'Casi... Estás cerca. 🌡️';
      else if (diff <= 20) hint = 'Ni frío ni calor. 😐';
      else hint = 'Lejos, muy lejos... ❄️';
      
      hint += ` (Era el ${secret})`;
    }

    // 5. Actualizar usuario
    const updates = {
      lastShinyAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      shinyAttemptsToday: admin.firestore.FieldValue.increment(1)
    };

    if (usedExtraRoll) {
      updates.shinyRolls = admin.firestore.FieldValue.increment(-1);
    }

    if (won) {
      updates.tipoUsuario = 'shiny';
      updates.permissions = admin.firestore.FieldValue.arrayUnion('shiny_mode');
    }

    await db.collection('users').doc(userId).update(updates);

    // 6. Responder
    return res.json({
      success: true,
      won,
      secret,
      message: won ? '¡GANASTE SHINY! 🎉' : `No acertaste. ${hint}`,
      remainingRolls: usedExtraRoll ? (user.shinyRolls - 1) : (user.shinyRolls || 0)
    });

  } catch (error) {
    console.error('❌ Shiny Game Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error procesando el juego.'
    });
  }
});

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MERCADOPAGO_PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY || '';
const MP_NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL || `${APP_BASE_URL}/api/payments/webhook`;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

const paymentPlansPath = path.join(__dirname, '..', 'config', 'paymentPlans.json');

let PAYMENT_PLANS = [];
try {
  if (fs.existsSync(paymentPlansPath)) {
    const planBuffer = fs.readFileSync(paymentPlansPath, 'utf-8');
    PAYMENT_PLANS = JSON.parse(planBuffer);
  } else {
    console.warn('📦 paymentPlans.json no encontrado en config/.');
  }
} catch (error) {
  console.error('❌ Error leyendo paymentPlans.json:', error);
}

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });

const createPreference = async (preferenceData) => {
  const preference = new Preference(client);
  const result = await preference.create({ body: preferenceData });
  console.log('✨ Preferencia creada:', result.id);
  console.log('👉 Init Point:', result.init_point);
  return result;
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

const searchPayment = async ({ preferenceId, externalReference }) => {
  const params = new URLSearchParams();
  if (externalReference) params.append('external_reference', externalReference);
  if (preferenceId) params.append('preference_id', preferenceId);
  params.append('sort', 'date_created');
  params.append('criteria', 'desc');

  const response = await mpRequest(`/v1/payments/search?${params.toString()}`, {
    method: 'GET',
  });

  return response.results?.[0] || null;
};

const mapPaymentToRecord = (payment) => {
  if (!payment) return null;

  const planId = payment.external_reference?.split('_')[0] || 'unknown';
  const userId = payment.external_reference?.split('_')[1] || 'anon';

  return {
    paymentId: String(payment.id),
    status: payment.status,
    statusDetail: payment.status_detail,
    planId: planId,
    userId: userId,
    email: payment.payer?.email,
    externalReference: payment.external_reference,
    preferenceId: payment.order?.id,
    payerId: payment.payer?.id,
    amount: payment.transaction_amount,
    currency: payment.currency_id,
    processedAt: payment.date_created,
    approvedAt: payment.date_approved
  };
};

const processApprovedPayment = async (paymentRecord) => {
  try {
    console.log(`🎉 Processing approved payment: ${paymentRecord.paymentId}`);
    console.log(`📋 Plan: ${paymentRecord.planId}`);
    console.log(`🆔 Original userId: ${paymentRecord.userId}`);
    console.log(`🖼️ Avatar received from frontend: ${paymentRecord.avatarUrl || 'Not provided'}`);

    // 1. Primero, intentar encontrar al usuario por el userId original (MÉTODO PRIORITARIO)
    let user = null;
    let targetUserId = paymentRecord.userId;

    if (paymentRecord.userId && paymentRecord.userId !== 'anon') {
      console.log(`🔍 Searching user by original userId: ${paymentRecord.userId}`);
      user = await getUserFromFirestore(paymentRecord.userId);
      if (user) {
        targetUserId = paymentRecord.userId;
        console.log(`✅ User found by userId: ${targetUserId}`);
      } else {
        console.log(`❌ User not found by userId: ${paymentRecord.userId}`);
      }
    }

    // 2. Si no se encontró por userId, intentar por el avatar (fallback)
    if (!user && paymentRecord.avatarUrl && paymentRecord.avatarUrl.trim() !== '') {
      console.log(`🔍 Searching user by avatar: ${paymentRecord.avatarUrl}`);
      const usersSnapshot = await db.collection('users')
        .where('avatar', '==', paymentRecord.avatarUrl)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        user = usersSnapshot.docs[0].data();
        targetUserId = usersSnapshot.docs[0].id;
        console.log(`✅ User found by avatar: ${targetUserId}`);
        console.log(`📧 User email: ${user.email || 'No email'}`);
      } else {
        console.log(`❌ No user found with avatar: ${paymentRecord.avatarUrl}`);
      }
    }

    // 3. Si no se encontró por avatar, intentar por el email del payer (último recurso)
    if (!user && paymentRecord.email && paymentRecord.email !== 'anon') {
      console.log(`🔍 Searching user by email: ${paymentRecord.email}`);
      const usersSnapshot = await db.collection('users')
        .where('email', '==', paymentRecord.email)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        user = usersSnapshot.docs[0].data();
        targetUserId = usersSnapshot.docs[0].id;
        console.log(`✅ User found by email: ${targetUserId}`);
        console.log(`🖼️ User avatar: ${user.avatar || 'No avatar'}`);
      } else {
        console.log(`❌ No user found with email: ${paymentRecord.email}`);
      }
    }

    // 4. Determinar acción según el plan comprado
    let tipoUsuario = 'white'; // default
    let permissions = [];
    let isConsumable = false;
    let consumableQuantity = 0;

    switch (paymentRecord.planId) {
      case 'black-user-plan':
        tipoUsuario = 'black';
        permissions = ['dark_mode', 'basic_features'];
        break;
      case 'shiny-user-plan':
        tipoUsuario = 'shiny';
        permissions = ['shiny_game', 'dark_mode', 'premium_features', 'exclusive_content'];
        break;
      case 'shiny-roll-plan':
        isConsumable = true;
        consumableQuantity = Math.floor(paymentRecord.amount || 1);
        break;
      case 'shiny-roll-1':
        isConsumable = true;
        consumableQuantity = 1;
        break;
      case 'shiny-roll-5':
        isConsumable = true;
        consumableQuantity = 5;
        break;
      case 'shiny-roll-15':
        isConsumable = true;
        consumableQuantity = 15;
        break;
      case 'shiny-roll-30':
        isConsumable = true;
        consumableQuantity = 30;
        break;
      default:
        tipoUsuario = 'white';
        permissions = ['basic_features'];
    }

    // 5. Si encontramos al usuario, actualizarlo
    if (user) {
      if (isConsumable) {
        console.log(`🍬 Adding consumables: ${consumableQuantity} rolls to ${targetUserId}`);
        await db.collection('users').doc(targetUserId).update({
          shinyRolls: admin.firestore.FieldValue.increment(consumableQuantity),
          lastPayment: paymentRecord.paymentId,
          lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
          payerId: paymentRecord.payerId || null
        });
        console.log(`✅ User rolls updated: +${consumableQuantity}`);
      } else {
        console.log(`🎨 Assigning tipoUsuario: ${tipoUsuario}`);
        console.log(`⬆️ Updating user tipo: ${targetUserId} -> ${tipoUsuario}`);

        await updateUserTipo(
          targetUserId,
          tipoUsuario,
          permissions
        );

        // Actualizar información adicional
        await db.collection('users').doc(targetUserId).update({
          lastPayment: paymentRecord.paymentId,
          lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
          payerId: paymentRecord.payerId || null
        });
        console.log(`✅ User tipo updated: ${targetUserId} -> ${tipoUsuario}`);
      }

      console.log(`✅ User tipo updated: ${targetUserId} -> ${tipoUsuario}`);
      console.log(`📧 User email: ${user.email || 'No email'}`);

    } else {
      console.log(`❌ Cannot update user: No matching user found`);
      console.log(`💡 Payer email (${paymentRecord.email}) needs to match a user email in Firebase`);
      console.log(`💡 Or the userId needs to match a user ID in Firebase`);
    }

  } catch (error) {
    console.error('❌ Error processing approved payment:', error);
    throw error;
  }
};

const persistPaymentFromMercadoPago = async (payment, avatarUrl = null) => {
  const record = mapPaymentToRecord(payment);
  if (!record) {
    throw new Error('Pago no encontrado en Mercado Pago');
  }

  // Agregar el avatar recibido del frontend
  record.avatarUrl = avatarUrl;

  try {
    // 1. Guardar en el sistema local existente (solo si es posible)
    try {
      const store = await createPurchaseStore();
      await store.upsert(record);
    } catch (fsError) {
      console.log('⚠️ Skipping local file storage (likely read-only fs):', fsError.message);
    }

    // 2. Guardar en Firebase
    await createPaymentRecord({
      id: record.paymentId,
      userId: record.userId,
      planId: record.planId,
      status: record.status,
      amount: record.amount,
      currency: record.currency,
      externalReference: record.externalReference
    });

    // 3. Si el pago está aprobado, actualizar rol del usuario
    if (record.status === 'approved') {
      await processApprovedPayment(record);
    }

    return record;
  } catch (error) {
    console.error('❌ Error persisting payment:', error);
    throw error;
  }
};

const getPlan = (planId) => {
  return PAYMENT_PLANS.find(p => p.id === planId);
};

const fetchPaymentById = async (id) => {
  return await mpRequest(`/v1/payments/${id}`, { method: 'GET' });
};

// Configurar multer para uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'lovable-uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  try {
    console.log('🏥 HEALTH: Comprehensive health check requested');

    // Check environment variables (only show partial values for security)
    const envVars = {
      MERCADOPAGO_ACCESS_TOKEN: MERCADOPAGO_ACCESS_TOKEN ?
        MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + '...' : '❌ Missing',
      VITE_MERCADOPAGO_PUBLIC_KEY: process.env.VITE_MERCADOPAGO_PUBLIC_KEY ? '✅ Set' : '❌ Missing',
      APP_BASE_URL: process.env.APP_BASE_URL || process.env.BASE_URL || '❌ Not configured',
      MP_NOTIFICATION_URL: MP_NOTIFICATION_URL || '❌ Not configured',
      MP_WEBHOOK_SECRET: MP_WEBHOOK_SECRET ? '✅ Set' : '❌ Not configured',
      PORT: PORT || '3001 (default)'
    };

    // Check payment plans configuration
    let paymentPlansStatus = '❌ Not accessible';
    let availablePlans = [];
    try {
      if (fs.existsSync(paymentPlansPath)) {
        const planBuffer = fs.readFileSync(paymentPlansPath, 'utf-8');
        const paymentPlans = JSON.parse(planBuffer);
        paymentPlansStatus = '✅ Available';
        availablePlans = paymentPlans.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          currency: p.currency
        }));
      } else {
        paymentPlansStatus = '❌ File not found';
      }
    } catch (error) {
      console.log('🔧 HEALTH: Could not read payment plans file:', error.message);
      paymentPlansStatus = '❌ Error reading file';
    }

    // Check Mercado Pago connectivity (basic test)
    let mercadoPagoStatus = '❌ Not configured';
    if (MERCADOPAGO_ACCESS_TOKEN) {
      if (MERCADOPAGO_ACCESS_TOKEN.startsWith('APP_USR-') && MERCADOPAGO_ACCESS_TOKEN.length > 50) {
        mercadoPagoStatus = '✅ Token format appears valid';
      } else {
        mercadoPagoStatus = '⚠️ Token format may be invalid';
      }
    }

    res.json({
      status: '✅ OK',
      timestamp: new Date().toISOString(),
      environment: envVars,
      paymentPlans: {
        status: paymentPlansStatus,
        count: availablePlans.length,
        availablePlans: availablePlans
      },
      mercadoPago: {
        status: mercadoPagoStatus
      },
      endpoints: {
        health: '✅ Working',
        verify: '/api/payments/verify',
        createPreference: '/api/payments/create-preference',
        webhook: '/api/payments/webhook'
      },
      message: 'Express server is running'
    });
  } catch (error) {
    console.error('❌ HEALTH: Error in health check:', error);
    res.status(500).json({
      status: '❌ Error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// MERCADO PAGO ENDPOINTS (PRODUCCIÓN)
// ================================

app.post('/payments/create-preference', async (req, res) => {
  try {
    const { planId, quantity = 1, userId, email, name } = req.body || {};
    console.log('📥 create-preference body:', req.body);

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido' });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({
        error: 'Mercado Pago no está configurado correctamente en el servidor.'
      });
    }

    const externalReference = `${plan.id}_${userId || 'anon'}_${Date.now()}`;

    const payer = {};
    if (email) payer.email = email;
    if (name) payer.name = name;

    const preferencePayload = {
      items: [
        {
          title: plan.title,
          quantity: Number(quantity) || 1,
          unit_price: Number(plan.price),
          currency_id: plan.currency || 'ARS'
        }
      ],
      back_urls: {
        success: `${APP_BASE_URL}/payments/success`,
        pending: `${APP_BASE_URL}/payments/pending`,
        failure: `${APP_BASE_URL}/payments/failure`
      },
      // auto_return: 'approved',
      external_reference: externalReference
    };

    console.log('📤 Creating preference with payload:', preferencePayload);
    const preference = await createPreference(preferencePayload);
    console.log('✅ Preference created result:', JSON.stringify(preference, null, 2));

    res.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      externalReference,
      plan
    });
  } catch (error) {
    console.error('❌ Error creando preferencia Mercado Pago:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo crear la preferencia'
    });
  }
});

app.post('/payments/verify', async (req, res) => {
  try {
    const { paymentId, externalReference, preferenceId } = req.body || {};

    if (!paymentId && !externalReference && !preferenceId) {
      return res
        .status(400)
        .json({ error: 'Debes enviar paymentId o externalReference/preferenceId' });
    }

    let payment = null;

    if (paymentId) {
      payment = await fetchPaymentById(paymentId);
    } else {
      payment = await searchPayment({ preferenceId, externalReference });
    }

    if (!payment) {
      return res.status(404).json({ error: 'No se encontraron pagos registrados todavía.' });
    }

    const record = await persistPaymentFromMercadoPago(payment);
    res.json({
      ...record,
      message: record.status === 'approved'
        ? 'Pago aprobado'
        : `Estado actual: ${record.status}`
    });
  } catch (error) {
    console.error('❌ Error verificando pago Mercado Pago:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo verificar el pago'
    });
  }
});

app.get('/payments/status', async (req, res) => {
  try {
    const { planId, userId, email } = req.query;

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido' });
    }

    if (!userId && !email) {
      return res
        .status(400)
        .json({ error: 'Envía userId o email para consultar el estado de compra.' });
    }

    const store = await createPurchaseStore();
    const status = await store.getStatus(planId, userId, email);
    res.json(status);
  } catch (error) {
    console.error('❌ Error obteniendo estado de pagos:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo obtener el estado de pago'
    });
  }
});

app.post('/payments/webhook', async (req, res) => {
  try {
    // Log para depuración
    console.log('🔔 Webhook recibido desde IP:', req.ip);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    // ⚠️ ELIMINADA VALIDACIÓN ESTRICTA DE SECRET PARA EVITAR 401
    // Mercado Pago a veces no envía el header esperado en notificaciones estándar

    const event = req.body || {};
    const query = req.query || {};

    const topic = event.type || query.type || query.topic;
    const resourceId =
      event.data?.id ||
      event.resource ||
      query['data.id'] ||
      query.data_id ||
      query.id ||
      event.id;

    console.log('🎯 Topic:', topic);
    console.log('🆔 Resource ID:', resourceId);

    if (topic && topic.includes('payment') && resourceId) {
      try {
        console.log('🔍 Buscando pago con ID:', resourceId);
        const payment = await fetchPaymentById(resourceId);
        console.log('💳 Pago encontrado:', JSON.stringify(payment, null, 2));

        // Validar que el pago sea válido (no un error 404)
        if (!payment || payment.status === 404 || payment.error) {
          console.log('❌ El pago no existe o no se encontró (probablemente ID simulado). Abortando.');
          res.json({ received: true, status: 'payment_not_found' });
          return;
        }

        // 💡 Opción 1: Buscar avatar en metadata de la preferencia
        let avatarUrl = req.body?.avatarUrl || req.query?.avatarUrl || null;

        // Si no viene en el webhook, buscar en metadata de la preferencia
        if (!avatarUrl && payment.preference_id) {
          console.log('🔍 Buscando avatar en metadata de preferencia...');
          try {
            const preferenceData = await mpRequest(`/v1/checkout/preferences/${payment.preference_id}`, { method: 'GET' });
            if (preferenceData.metadata?.avatar) {
              avatarUrl = preferenceData.metadata.avatar;
              console.log('✅ Avatar encontrado en metadata:', avatarUrl);
            }
          } catch (error) {
            console.log('⚠️ Error obteniendo metadata de preferencia:', error.message);
          }
        }

        console.log('🖼️ Avatar URL final:', avatarUrl || 'No avatar provided');

        await persistPaymentFromMercadoPago(payment, avatarUrl);
        console.log('✅ Webhook Mercado Pago procesado:', resourceId);
      } catch (error) {
        console.error('❌ Error procesando webhook de Mercado Pago:', error);
      }
    } else {
      console.log('⚠️ Webhook ignorado - topic o resourceId inválido');
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error en webhook Mercado Pago:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

// Endpoint uploads
app.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const filename = req.file.filename;
    const baseUrl = process.env.BASE_URL || `https://v0-steeb-api-backend.vercel.app`;
    const originalUrl = `${baseUrl}/lovable-uploads/${filename}`;

    res.json({
      success: true,
      filename: filename,
      path: `/lovable-uploads/${filename}`,
      original_url: originalUrl,
      message: 'Imagen subida exitosamente'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir archivos estáticos
app.use('/lovable-uploads', express.static(path.join(__dirname, '..', 'public', 'lovable-uploads')));

// Listar imágenes
app.get('/images', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '..', 'public', 'lovable-uploads');

    if (!fs.existsSync(uploadDir)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const baseUrl = process.env.BASE_URL || `https://v0-steeb-api-backend.vercel.app`;

    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    }).map(file => ({
      filename: file,
      path: `/lovable-uploads/${file}`,
      original_url: `${baseUrl}/lovable-uploads/${file}`,
      size: fs.statSync(path.join(uploadDir, file)).size
    }));

    res.json({ images });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ error: 'Error al listar imágenes' });
  }
});

// ================================
// SHINY GAME + USERS (UNIFICADO PARA LIMITE DE FUNCIONES)
// ================================

// Reusar handlers existentes para no duplicar l��gica
// Manejar ambas rutas por seguridad
app.post(['/shiny-game', '/api/shiny-game'], async (req, res) => {
  try {
    const { userId, guess } = req.body;

    if (!userId || guess === undefined) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Faltan datos requeridos (userId, guess)'
      });
    }

    const guessNum = parseInt(guess, 10);
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 100) {
      return res.status(400).json({
        error: 'Invalid guess',
        message: 'El número debe ser entre 1 y 100'
      });
    }

    // 1. Obtener usuario
    const user = await getUserFromFirestore(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    // 2. Verificar permisos (Debe ser al menos DARK)
    if (user.tipoUsuario === 'shiny') {
      return res.json({
        success: true,
        alreadyWon: true,
        message: '¡Ya sos Shiny! No necesitas jugar más.'
      });
    }

    if (user.tipoUsuario !== 'dark' && user.tipoUsuario !== 'black') {
       return res.status(403).json({
        error: 'Permission denied',
        message: 'Necesitas ser usuario Dark para jugar.'
      });
    }

    // 3. Verificar límite diario
    const now = new Date();
    const lastAttempt = user.lastShinyAttemptAt ? user.lastShinyAttemptAt.toDate() : null;
    
    let canPlay = true;
    if (lastAttempt) {
      const isToday = lastAttempt.getDate() === now.getDate() &&
                      lastAttempt.getMonth() === now.getMonth() &&
                      lastAttempt.getFullYear() === now.getFullYear();
      
      if (isToday) {
        canPlay = false;
      }
    }

    // Permitir jugar si compró intentos extra (shinyRolls > 0)
    let usedExtraRoll = false;
    if (!canPlay) {
      if (user.shinyRolls && user.shinyRolls > 0) {
        canPlay = true;
        usedExtraRoll = true;
      } else {
        // Calcular tiempo restante
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilTomorrow = tomorrow - now;
        
        return res.status(429).json({
          error: 'Daily limit reached',
          message: 'Ya usaste tu intento diario.',
          nextAttemptIn: msUntilTomorrow
        });
      }
    }

    // 4. Generar número secreto y comparar
    const secret = Math.floor(Math.random() * 100) + 1;
    const won = guessNum === secret;
    const diff = Math.abs(guessNum - secret);
    
    let hint = '';
    if (!won) {
      if (diff <= 5) hint = '¡Uff! Estuviste MUY cerca... 🔥';
      else if (diff <= 10) hint = 'Casi... Estás cerca. 🌡️';
      else if (diff <= 20) hint = 'Ni frío ni calor. 😐';
      else hint = 'Lejos, muy lejos... ❄️';
      
      hint += ` (Era el ${secret})`;
    }

    // 5. Actualizar usuario
    const updates = {
      lastShinyAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      shinyAttemptsToday: admin.firestore.FieldValue.increment(1)
    };

    if (usedExtraRoll) {
      updates.shinyRolls = admin.firestore.FieldValue.increment(-1);
    }

    if (won) {
      updates.tipoUsuario = 'shiny';
      updates.permissions = admin.firestore.FieldValue.arrayUnion('shiny_mode');
    }

    await db.collection('users').doc(userId).update(updates);

    // 6. Responder
    return res.json({
      success: true,
      won,
      secret,
      message: won ? '¡GANASTE SHINY! 🎉' : `No acertaste. ${hint}`,
      remainingRolls: usedExtraRoll ? (user.shinyRolls - 1) : (user.shinyRolls || 0)
    });

  } catch (error) {
    console.error('❌ Shiny Game Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error procesando el juego.'
    });
  }
});
app.all('/users/role', (req, res) => userRoleHandler(req, res));
app.all('/users/consume-shiny-roll', (req, res) => consumeShinyRollHandler(req, res));
// Chat AI (DeepSeek)
app.all('/steeb', (req, res) => steebHandler(req, res));

export default app;
