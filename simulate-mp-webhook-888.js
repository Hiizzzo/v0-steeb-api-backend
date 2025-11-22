// Simular webhook de Mercado Pago con payment ID 888
import 'dotenv/config';

const simulatePaymentWebhook = async () => {
  const webhookUrl = 'http://localhost:3001/api/payments/webhook';
  const webhookSecret = process.env.MP_WEBHOOK_SECRET || 'tu_secreto_webhook_muy_seguro_123456';

  console.log('🔔 Simulando webhook de Mercado Pago con Payment ID: 888');
  console.log(`🎯 URL: ${webhookUrl}`);
  console.log(`🔐 Secret: ${webhookSecret}`);
  console.log('');

  // Este es el formato real que Mercado Pago envía cuando un pago es aprobado
  const webhookPayload = {
    type: 'payment',
    data: {
      id: '888'  // El ID que nos dijiste que simulemos
    }
  };

  console.log('📦 Enviando payload:');
  console.log(JSON.stringify(webhookPayload, null, 2));
  console.log('');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await response.text();

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response: ${responseText}`);
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook enviado exitosamente al servidor');
      console.log('🔍 El backend debería estar procesando el pago ID 888...');
      console.log('🎮 Si todo funciona, el tipoUsuario debería actualizarse automáticamente');
    } else {
      console.log('❌ Error en el webhook');
      console.log('🚨 Revisa la consola del servidor para más detalles');
    }

  } catch (error) {
    console.error('💥 Error al enviar webhook:', error.message);
    console.log('💡 Asegúrate de que el servidor esté corriendo en http://localhost:3001');
  }
};

// Ejecutar simulación
simulatePaymentWebhook();