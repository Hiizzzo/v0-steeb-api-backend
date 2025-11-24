// Simular webhook de Mercado Pago para compra de tiradas Shiny
import 'dotenv/config';

const simulateShinyRollPurchase = async () => {
  const webhookUrl = 'http://localhost:3001/api/payments/webhook';
  const webhookSecret = process.env.MP_WEBHOOK_SECRET || 'tu_secreto_webhook_muy_seguro_123456';

  // ID de pago simulado (debe ser único para evitar duplicados si el backend chequea)
  const paymentId = Math.floor(Math.random() * 1000000).toString();

  console.log(`🔔 Simulando compra de 5 Tiradas Shiny con Payment ID: ${paymentId}`);
  console.log(`🎯 URL: ${webhookUrl}`);
  
  // Payload simulando lo que envía Mercado Pago
  // NOTA: En un escenario real, el backend consulta a MP con este ID.
  // Como estamos simulando, necesitamos que el backend tenga una forma de "mockear" la respuesta de MP
  // O bien, confiamos en que el backend (en modo dev) acepte ciertos IDs de prueba.
  //
  // Sin embargo, el webhook.js actual hace: const payment = await fetchPaymentById(resourceId);
  // Si el ID no existe en MP real, fallará.
  //
  // Para probar esto SIN tocar el backend para aceptar mocks, necesitamos un ID real de MP o
  // modificar temporalmente el webhook.js para aceptar un "bypass" de prueba.
  //
  // DADO QUE NO PODEMOS GENERAR UN ID REAL DE MP SIN PAGAR:
  // Vamos a asumir que el usuario quiere ver que el CÓDIGO del webhook maneja la lógica.
  // Pero el webhook.js actual tiene una validación fuerte:
  // if (!payment || payment.status === 404 || payment.error) ...
  
  // ESTRATEGIA:
  // Voy a crear un script que llame directamente a la función `processApprovedPayment` 
  // importándola del webhook.js, saltándose la validación de MP.
  // Esto prueba la lógica de negocio (asignar tiradas) sin necesitar un pago real.
  
  console.log('⚠️ Esta simulación vía HTTP fallará si el ID no existe en Mercado Pago real.');
  console.log('⚠️ Para probar la lógica interna, usaremos un script directo de Node.js.');
};

simulateShinyRollPurchase();