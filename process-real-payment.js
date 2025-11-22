// Procesar el pago real 134300149639 para asignar rol dark
import 'dotenv/config';
import { MercadoPagoConfig } from 'mercadopago';
import { db, getUserFromFirestore, updateUserTipo, createPaymentRecord, createUserInFirestore } from './lib/firebase.js';

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
  console.log(`🔍 Buscando pago real con ID: ${id}`);
  return await mpRequest(`/v1/payments/${id}`, { method: 'GET' });
};

const processRealPayment = async () => {
  const paymentId = '134300149639';

  console.log('🚀 Procesando pago real para asignar rol DARK...');
  console.log(`💳 Payment ID: ${paymentId}`);
  console.log('');

  try {
    // 1. Obtener detalles del pago desde Mercado Pago
    const payment = await fetchPaymentById(paymentId);

    console.log('✅ Pago encontrado:');
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Status Detail: ${payment.status_detail}`);
    console.log(`   - External Reference: ${payment.external_reference}`);
    console.log(`   - Amount: ${payment.transaction_amount} ${payment.currency_id}`);
    console.log(`   - Payer Email: ${payment.payer?.email}`);
    console.log('');

    if (payment.status !== 'approved') {
      console.log('❌ El pago no está aprobado. Status:', payment.status);
      return;
    }

    // 2. Mapear el pago a un record
    const mapPaymentToRecord = (payment) => {
      if (!payment) return null;

      const planId = payment.external_reference?.split('_')[0] || 'unknown';
      const userId = payment.external_reference?.split('_')[1] || 'unknown';

      return {
        paymentId: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
        planId: planId,
        userId: userId,
        email: payment.payer?.email,
        externalReference: payment.external_reference,
        amount: payment.transaction_amount,
        currency: payment.currency_id
      };
    };

    // Procesar el pago
    console.log('🔄 Procesando pago...');
    const record = mapPaymentToRecord(payment);

    console.log('✅ Pago procesado exitosamente:');
    console.log(`   - Payment ID: ${record.paymentId}`);
    console.log(`   - Plan ID: ${record.planId}`);
    console.log(`   - User ID: ${record.userId}`);
    console.log(`   - User Email: ${record.email}`);
    console.log('');

    // 3. Si todo funcionó, crear/actualizar al usuario a black si es necesario
    if (record.userId && record.planId === 'black-user-plan') {
      console.log('🎯 Verificando si el usuario existe...');

      let user = await getUserFromFirestore(record.userId);

      if (!user) {
        console.log('👤 Usuario no existe, creándolo...');
        await createUserInFirestore({
          id: record.userId,
          email: record.email,
          tipoUsuario: 'black',
          permissions: ['dark_mode', 'basic_features']
        });
        console.log('✅ Usuario creado como BLACK');
      } else {
        console.log('🔄 Usuario existe, actualizando a BLACK...');
        await updateUserTipo(
          record.userId,
          'black',
          ['dark_mode', 'basic_features']
        );
        console.log('✅ Usuario actualizado a BLACK exitosamente');
      }
    }

    console.log('');
    console.log('🎉 ¡Proceso completado! El usuario ahora tiene acceso DARK MODE');

  } catch (error) {
    console.error('❌ Error procesando el pago:', error.message);

    if (error.message.includes('404')) {
      console.log('💡 El pago 134300149639 no existe o no es accesible con estas credenciales');
      console.log('💡 Verifica que estés usando las credenciales de producción correctas');
    }
  }
};

processRealPayment();