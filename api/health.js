import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🏥 HEALTH: Comprehensive health check requested');

    const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || `https://v0-steeb-api-backend.vercel.app`;
    const MP_NOTIFICATION_URL = process.env.MP_NOTIFICATION_URL || `${APP_BASE_URL}/api/payments/webhook`;
    const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

    // Check environment variables (only show partial values for security)
    const envVars = {
      MERCADOPAGO_ACCESS_TOKEN: MERCADOPAGO_ACCESS_TOKEN ?
        MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + '...' : '❌ Missing',
      VITE_MERCADOPAGO_PUBLIC_KEY: process.env.VITE_MERCADOPAGO_PUBLIC_KEY ? '✅ Set' : '❌ Missing',
      APP_BASE_URL: process.env.APP_BASE_URL || process.env.BASE_URL || '❌ Not configured',
      MP_NOTIFICATION_URL: MP_NOTIFICATION_URL || '❌ Not configured',
      MP_WEBHOOK_SECRET: MP_WEBHOOK_SECRET ? '✅ Set' : '❌ Not configured',
      PORT: process.env.PORT || '3001 (default)'
    };

    // Check payment plans configuration
    const paymentPlansPath = path.join(__dirname, '..', 'config', 'paymentPlans.json');
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
      message: 'API Server is running - Vercel Serverless Functions'
    });
  } catch (error) {
    console.error('❌ HEALTH: Error in health check:', error);
    res.status(500).json({
      status: '❌ Error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}