// Herramienta para probar webhooks de Mercado Pago
import 'dotenv/config';

const simulateWebhook = async (paymentData) => {
  const webhookUrl = process.env.MP_NOTIFICATION_URL || 'http://localhost:3001/api/payments/webhook';
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;

  console.log('🔔 Simulando webhook de Mercado Pago...');
  console.log(`🎯 URL: ${webhookUrl}`);
  console.log(`🔐 Secret: ${webhookSecret ? 'Configurado' : 'No configurado'}`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret || ''
      },
      body: JSON.stringify(paymentData)
    });

    const result = await response.text();

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response: ${result}`);

    if (response.ok) {
      console.log('✅ Webhook procesado exitosamente');
    } else {
      console.log('❌ Error en el webhook');
    }

  } catch (error) {
    console.error('💥 Error al enviar webhook:', error.message);
  }
};

// Simulación de pago aprobado para usuario black
const blackPaymentSimulation = {
  type: 'payment',
  data: {
    id: 'payment_test_1234567890'
  },
  // Esto es lo que normalmente enviaría Mercado Pago en el webhook body
  // El backend usará este ID para consultar los detalles del pago
};

console.log('🚀 Iniciando prueba de webhook...');
console.log('📦 Simulando pago aprobado para plan BLACK');

simulateWebhook(blackPaymentSimulation);