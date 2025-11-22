// Ver todos los detalles del pago para identificar al usuario
import 'dotenv/config';
import { MercadoPagoConfig } from 'mercadopago';

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

const checkPaymentDetails = async () => {
  const paymentId = '134300149639';

  console.log('🔍 Analizando todos los detalles del pago...');
  console.log(`💳 Payment ID: ${paymentId}`);
  console.log('');

  try {
    const payment = await mpRequest(`/v1/payments/${paymentId}`, { method: 'GET' });

    console.log('✅ Datos completos del pago:');
    console.log('='.repeat(50));

    // Información básica
    console.log(`📋 Información básica:`);
    console.log(`   - ID: ${payment.id}`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Status Detail: ${payment.status_detail}`);
    console.log(`   - Amount: ${payment.transaction_amount} ${payment.currency_id}`);
    console.log(`   - Date Created: ${payment.date_created}`);
    console.log(`   - Date Approved: ${payment.date_approved}`);

    // Payer information
    console.log(`\n👤 Información del Payer:`);
    console.log(`   - ID: ${payment.payer?.id}`);
    console.log(`   - Email: ${payment.payer?.email}`);
    console.log(`   - Name: ${payment.payer?.first_name || 'N/A'} ${payment.payer?.last_name || ''}`);
    console.log(`   - Phone: ${payment.payer?.phone?.number || 'N/A'}`);
    console.log(`   - Identification: ${payment.payer?.identification?.type || 'N/A'} ${payment.payer?.identification?.number || ''}`);

    // Payer address
    if (payment.payer?.address) {
      console.log(`\n📍 Dirección del Payer:`);
      console.log(`   - Street: ${payment.payer.address.street_name || 'N/A'}`);
      console.log(`   - City: ${payment.payer.address.city || 'N/A'}`);
      console.log(`   - Zip Code: ${payment.payer.address.zip_code || 'N/A'}`);
    }

    // Additional info
    console.log(`\n🔍 Información Adicional:`);
    console.log(`   - External Reference: ${payment.external_reference}`);
    console.log(`   - Description: ${payment.description || 'N/A'}`);
    console.log(`   - Order ID: ${payment.order?.id || 'N/A'}`);
    console.log(`   - Live Mode: ${payment.live_mode}`);

    // Metadata
    if (payment.metadata) {
      console.log(`\n📊 Metadata:`);
      console.log(`   - ${JSON.stringify(payment.metadata, null, 4)}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 ¿Alguno de estos datos coincide con tu usuario?');

  } catch (error) {
    console.error('❌ Error obteniendo detalles del pago:', error.message);
  }
};

checkPaymentDetails();