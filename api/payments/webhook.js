import { MercadoPagoConfig } from 'mercadopago';
import 'dotenv/config';
import { createPurchaseStore } from '../../server/purchaseStore.js';
import {
  getUserFromFirestore,
  updateUserTipo,
  createPaymentRecord,
  updatePaymentStatus,
  createUserInFirestore,
  db
} from '../../lib/firebase.js';
import admin from 'firebase-admin';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

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

const mapPaymentToRecord = (payment) => {
  if (!payment) return null;
  return {
    paymentId: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    planId: payment.external_reference?.split('_')[0] || 'unknown',
    userId: payment.external_reference?.split('_')[1] || null,
    email: payment.payer?.email,
    externalReference: payment.external_reference,
    preferenceId: payment.order?.id,
    amount: payment.transaction_amount,
    currency: payment.currency_id,
    processedAt: payment.date_created,
    approvedAt: payment.date_approved
  };
};

const persistPaymentFromMercadoPago = async (payment) => {
  const record = mapPaymentToRecord(payment);
  if (!record) {
    throw new Error('Pago no encontrado en Mercado Pago');
  }

  try {
    // 1. Guardar en el sistema local existente
    const store = await createPurchaseStore();
    await store.upsert(record);

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
    if (record.status === 'approved' && record.userId) {
      await processApprovedPayment(record);
    }

    return record;
  } catch (error) {
    console.error('❌ Error persisting payment:', error);
    throw error;
  }
};

const processApprovedPayment = async (paymentRecord) => {
  try {
    console.log(`🎉 Processing approved payment for user: ${paymentRecord.userId}`);

    // 1. Verificar si el usuario existe en Firebase
    let user = await getUserFromFirestore(paymentRecord.userId);

    // 2. Determinar el tipoUsuario según el plan comprado
    let tipoUsuario = 'white'; // default
    let permissions = [];

    switch (paymentRecord.planId) {
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

    // 3. Si no existe, crear el usuario
    if (!user) {
      console.log(`👤 Creating new user in Firebase: ${paymentRecord.userId}`);
      await createUserInFirestore({
        id: paymentRecord.userId,
        email: paymentRecord.email,
        tipoUsuario: tipoUsuario,
        permissions: permissions
      });
    } else {
      // 4. Si existe, actualizar su tipoUsuario
      console.log(`⬆️ Updating user tipo: ${paymentRecord.userId} -> ${tipoUsuario}`);
      await updateUserTipo(
        paymentRecord.userId,
        tipoUsuario,
        permissions
      );
    }

    // 5. Actualizar el último pago del usuario
    if (user) {
      await db.collection('users').doc(paymentRecord.userId).update({
        lastPayment: paymentRecord.paymentId,
        lastPaymentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`✅ User tipo updated: ${paymentRecord.userId} -> ${tipoUsuario}`);

  } catch (error) {
    console.error('❌ Error processing approved payment:', error);
    throw error;
  }
};


const fetchPaymentById = async (id) => {
  return await mpRequest(`/v1/payments/${id}`, { method: 'GET' });
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Log para depuración
    console.log('🔔 Webhook recibido desde IP:', req.ip);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

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

        await persistPaymentFromMercadoPago(payment);
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
}