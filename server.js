import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import 'dotenv/config';
import { createPurchaseStore } from './server/purchaseStore.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { updateUserTipo, createPaymentRecord } from './lib/firebase.js';
import steebHandler from './api/steeb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// IMPORTANTE: Railway inyecta el puerto en process.env.PORT. Debemos usarlo si existe.
// Si no existe, usamos 3000 como fallback.
const PORT = process.env.PORT || 3000;
console.log(`🔌 Intentando iniciar en puerto: ${PORT} (process.env.PORT es: ${process.env.PORT})`);

const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; // Default to Vite dev server

// Configurar CORS y JSON
app.use(cors());
app.use(express.json());

// Log de todas las peticiones para depuración (Ver si Railway llega al servidor)
app.use((req, res, next) => {
  console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MERCADOPAGO_PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY || '';
const MP_NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL || `${APP_BASE_URL}/api/payments/webhook`;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

const paymentPlansPath = path.join(__dirname, 'config', 'paymentPlans.json');

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

  const parts = payment.external_reference?.split('_') || [];
  const planId = parts[0] || 'unknown';
  // Extract userId: join all parts between first (planId) and last (timestamp)
  const userId = parts.length > 2 ? parts.slice(1, -1).join('_') : parts[1] || null;

  return {
    paymentId: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    planId: planId,
    userId: userId,
    email: payment.payer?.email,
    externalReference: payment.external_reference,
    preferenceId: payment.order?.id,
    amount: payment.transaction_amount,
    currency: payment.currency_id,
    processedAt: payment.date_created,
    approvedAt: payment.date_approved
  };
};

export const persistPaymentFromMercadoPago = async (payment) => {
  const record = mapPaymentToRecord(payment);
  if (!record) {
    throw new Error('Pago no encontrado en Mercado Pago');
  }
  
  // Asegurar que el ID sea un string válido para Firestore
  if (record.paymentId) {
    record.paymentId = String(record.paymentId);
  }
  // Si por alguna razón no hay paymentId, usar el ID del objeto payment original
  if (!record.paymentId && payment.id) {
    record.paymentId = String(payment.id);
  }

  // Validación final antes de intentar guardar
  if (!record.paymentId) {
    console.error('❌ Error crítico: No se pudo determinar un ID de pago válido para Firestore', record);
    // Generar un ID de respaldo si es absolutamente necesario para no perder la data
    record.paymentId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mapear 'paymentId' a 'id' para createPaymentRecord que espera 'id'
  const firestoreRecord = {
    ...record,
    id: record.paymentId // createPaymentRecord usa .doc(paymentData.id)
  };

  const store = await createPurchaseStore();
  await store.upsert(record);

  // Guardar respaldo en Firestore (Persistencia real para Railway)
  try {
    await createPaymentRecord(firestoreRecord);
  } catch (error) {
    console.error('⚠️ Error guardando respaldo de pago en Firestore:', error);
    // No fallamos todo el proceso si falla el backup en Firestore, pero lo logueamos
  }

  // Update user in Firebase if approved
  if (record.status === 'approved' && record.userId) {
    try {
      const targetType = record.planId.includes('shiny') ? 'shiny' : 'black';
      const permissions = targetType === 'shiny'
        ? ['dark_mode', 'basic_features', 'shiny_game', 'premium_features']
        : ['dark_mode', 'basic_features'];

      console.log(`🔄 Updating user ${record.userId} to ${targetType}...`);
      await updateUserTipo(record.userId, targetType, permissions);
    } catch (error) {
      console.error('❌ Error updating user in Firebase:', error);
      // Don't throw, so we still return the payment record
    }
  }

  return record;
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
    const uploadDir = path.join(__dirname, 'public', 'lovable-uploads');

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

// Endpoint uploads
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const filename = req.file.filename;
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
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
app.use('/lovable-uploads', express.static(path.join(__dirname, 'public', 'lovable-uploads')));

// Listar imágenes
app.get('/api/images', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'public', 'lovable-uploads');

    if (!fs.existsSync(uploadDir)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

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
// HEALTH CHECK ENDPOINT
// ================================

app.get('/api/health', (req, res) => {
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

app.post('/api/payments/create-preference', async (req, res) => {
  try {
    const { planId, quantity = 1, userId, email, name } = req.body || {};
    console.log('📥 create-preference body:', req.body);

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido' });
    }

    if (!userId) {
      console.error('❌ Error: userId es requerido para crear la preferencia');
      return res.status(400).json({ error: 'userId es requerido' });
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
        success: `${FRONTEND_URL}/payments/success`,
        pending: `${FRONTEND_URL}/payments/pending`,
        failure: `${FRONTEND_URL}/payments/failure`
      },
      payer: payer,
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

app.post('/api/payments/verify', async (req, res) => {
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

app.get('/api/payments/status', async (req, res) => {
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

app.post('/api/payments/webhook', async (req, res) => {
  try {
    // Validación de secreto opcional (comentada para evitar errores 401 con Mercado Pago estándar)
    /*
    if (MP_WEBHOOK_SECRET) {
      const provided = req.query.secret || req.headers['x-webhook-secret'];
      if (provided !== MP_WEBHOOK_SECRET) {
        console.warn('⚠️ Webhook secret mismatch, but proceeding for compatibility.');
        // return res.status(401).json({ error: 'Token de webhook inválido' });
      }
    }
    */

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

    if (topic && topic.includes('payment') && resourceId) {
      try {
        const payment = await fetchPaymentById(resourceId);
        await persistPaymentFromMercadoPago(payment);
        console.log('✅ Webhook Mercado Pago procesado:', resourceId);
      } catch (error) {
        console.error('❌ Error procesando webhook de Mercado Pago:', error);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error en webhook Mercado Pago:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});


// Chat AI (DeepSeek) - mismo handler que Vercel
app.all('/api/steeb', (req, res) => steebHandler(req, res));

// Endpoint raíz para Health Checks de Railway (y cualquier otra ruta no definida para evitar 404 en health checks)
app.get('/', (req, res) => {
  console.log('💓 Health Check recibido en /');
  res.status(200).send('✅ STEEB API Backend is running');
});

// Fallback para Health Checks agresivos de Railway que busquen /health o similar
app.get('/health', (req, res) => res.status(200).send('OK'));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor STEEB corriendo en http://0.0.0.0:${PORT}`);
  console.log(`💰 Plan configurado: ${PAYMENT_PLANS[0]?.price} ARS`);
  console.log(`📁 Directorio de uploads: ${path.join(__dirname, 'public', 'lovable-uploads')}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Error fatal: El puerto ${PORT} ya está en uso.`);
    process.exit(1);
  } else {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
});

// Graceful Shutdown para evitar errores en logs al reiniciar
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente.');
    process.exit(0);
  });
});