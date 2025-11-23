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

export const processApprovedPayment = async (paymentRecord) => {
  try {
    console.log(`🎉 Processing approved payment: ${paymentRecord.paymentId}`);
    console.log(`📋 Plan: ${paymentRecord.planId}`);
    console.log(`🆔 Original userId: ${paymentRecord.userId}`);
    console.log(`🖼️ Avatar received from frontend: ${paymentRecord.avatarUrl || 'Not provided'}`);

    // 1. Primero, intentar encontrar al usuario por el avatar (método preferido)
    let user = null;
    let targetUserId = paymentRecord.userId;

    if (paymentRecord.avatarUrl && paymentRecord.avatarUrl.trim() !== '') {
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

    // 2. Si no se encontró por avatar, intentar por el email del payer
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

    // 3. Si no se encontró por email, intentar por el userId original
    if (!user && paymentRecord.userId !== 'anon') {
      console.log(`🔍 Searching user by original userId: ${paymentRecord.userId}`);
      user = await getUserFromFirestore(paymentRecord.userId);
      targetUserId = paymentRecord.userId;
      if (user) {
        console.log(`✅ User found by userId: ${targetUserId}`);
      }
    }

    // 4. Si sigue sin encontrarse, listar usuarios disponibles para depuración
    if (!user) {
      console.log(`⚠️ User not found, listing available users...`);
      const allUsersSnapshot = await db.collection('users').limit(10).get();

      if (!allUsersSnapshot.empty) {
        console.log(`📋 Available users:`);
        allUsersSnapshot.docs.forEach((doc, index) => {
          const userData = doc.data();
          console.log(`  ${index + 1}. ID: ${doc.id}`);
          console.log(`     Email: ${userData.email || 'No email'}`);
          console.log(`     🖼️ Avatar: ${userData.avatar || 'No avatar'}`);
          console.log(`     Tipo: ${userData.tipoUsuario || 'white'}`);
          console.log('');
        });
        console.log(`💡 The avatar URL from frontend needs to match one of these avatars`);
      }
    }

    // 4. Determinar el tipoUsuario según el plan comprado
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

    console.log(`🎨 Assigning tipoUsuario: ${tipoUsuario}`);

    // 5. Si encontramos al usuario, actualizarlo
    if (user) {
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
}