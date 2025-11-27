import { MercadoPagoConfig, Preference } from 'mercadopago';
import 'dotenv/config';
import { createPurchaseStore } from '../../server/purchaseStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || `https://v0-steeb-api-backend-production.up.railway.app`;

const paymentPlansPath = path.join(__dirname, '..', '..', 'config', 'paymentPlans.json');

let PAYMENT_PLANS = [];
try {
  if (fs.existsSync(paymentPlansPath)) {
    const planBuffer = fs.readFileSync(paymentPlansPath, 'utf-8');
    PAYMENT_PLANS = JSON.parse(planBuffer);
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

const getPlan = (planId) => {
  return PAYMENT_PLANS.find(p => p.id === planId);
};

export default async function handler(req, res) {
  // 🚀 Enhanced CORS headers for Vercel compatibility
  const origin = req.headers.origin;
  const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8083',
  'http://127.0.0.1:8083',
  'http://localhost:8083',
  'https://v0-steeb-api-backend.vercel.app',
  'https://v0-steeb-api-backend-production.up.railway.app',
  'https://steeb.vercel.app',
  'https://steeb2.vercel.app',
];

  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
      payer: payer,
      back_urls: {
        success: `https://steeb.vercel.app/payment-success`,
        pending: `https://steeb.vercel.app/payment-pending`,
        failure: `https://steeb.vercel.app/payment-failure`
      },
      auto_return: 'approved',
      external_reference: externalReference,
      // 💡 Guardar el avatar en la preferencia para que el webhook pueda acceder a él
      metadata: {
        avatar: req.body?.avatar || null,
        userName: req.body?.name || null,
        userEmail: req.body?.email || null
      },
      notification_url: `${APP_BASE_URL}/api/payments/webhook`
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
}
