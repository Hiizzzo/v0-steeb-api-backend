import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import 'dotenv/config';
import { startGlobalStatsWatcher } from './lib/globalStatsWatcher.js';
import steebHandler from './api/steeb.js';
import shinyGameHandler from './api/shiny-game.js';
import shinyStatsHandler from './api/shiny-stats.js';
import userRoleHandler from './api/users/role.js';
import consumeShinyRollHandler from './api/users/consume-shiny-roll.js';
import createPreferenceHandler from './api/payments/create-preference.js';
import verifyPaymentHandler from './api/payments/verify.js';
import paymentStatusHandler from './api/payments/status.js';
import webhookHandler from './api/payments/webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// IMPORTANTE: Railway inyecta el puerto en process.env.PORT. Debemos usarlo si existe.
// Si no existe, usamos 3000 como fallback.
const PORT = process.env.PORT || 3001;
console.log(`🔌 Intentando iniciar en puerto: ${PORT} (process.env.PORT es: ${process.env.PORT})`);

const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; // Default to Vite dev server

startGlobalStatsWatcher().catch((error) => {
  console.error('[GlobalStats] Failed to start watcher', error);
});

// Configurar CORS y JSON
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8083',
    'http://127.0.0.1:8083',
    'https://steeb.vercel.app',
    'https://v0-steeb-api-backend-production.up.railway.app',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
    FRONTEND_URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));
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

// Usar los mismos handlers que Vercel para consistencia
app.post('/api/payments/create-preference', (req, res) => createPreferenceHandler(req, res));
app.post('/api/payments/verify', (req, res) => verifyPaymentHandler(req, res));
app.get('/api/payments/status', (req, res) => paymentStatusHandler(req, res));
app.post('/api/payments/webhook', (req, res) => webhookHandler(req, res));


// Chat AI (DeepSeek) - mismo handler que Vercel
app.all('/api/steeb', (req, res) => steebHandler(req, res));

// Shiny Game Handler
app.post('/api/shiny-game', (req, res) => shinyGameHandler(req, res));

// Shiny Stats Handler
app.all('/api/shiny-stats', (req, res) => shinyStatsHandler(req, res));

// User Role Handler
app.all('/api/users/role', (req, res) => userRoleHandler(req, res));

// Consume Shiny Roll Handler
app.all('/api/users/consume-shiny-roll', (req, res) => consumeShinyRollHandler(req, res));

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
