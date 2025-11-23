// Simular exactamente lo que Mercado Pago debería enviar en el webhook
import 'dotenv/config';

const simulateRealWebhook = async () => {
  const webhookUrl = 'https://v0-steeb-api-backend.vercel.app/api/payments/webhook';

  console.log('🔔 Simulando webhook real de Mercado Pago...');
  console.log(`🎯 URL: ${webhookUrl}`);
  console.log('');

  // Simulación exacta de lo que envía Mercado Pago para un pago aprobado
  const mercadoPagoWebhookPayload = {
    action: "payment.updated",
    api_version: "v1",
    data: {
      id: "134300149639"  // Tu payment ID real
    },
    date_created: "2025-11-22T23:36:26.000Z",
    id: "webhook_notification_123456",
    live_mode: true,
    type: "payment",
    user_id: "2974051580"
  };

  console.log('📦 Payload exacto que Mercado Pago enviaría:');
  console.log(JSON.stringify(mercadoPagoWebhookPayload, null, 2));
  console.log('');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MercadoPago/1.0'
      },
      body: JSON.stringify(mercadoPagoWebhookPayload)
    });

    const responseText = await response.text();

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response: ${responseText}`);
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook simulado exitosamente');
      console.log('🔍 El backend debería haber procesado tu pago 134300149639');
      console.log('🎮 Deberías ver el usuario actualizado en Firebase');
    } else {
      console.log('❌ Error en el webhook simulado');
    }

  } catch (error) {
    console.error('💥 Error simulando webhook:', error.message);
  }
};

simulateRealWebhook();