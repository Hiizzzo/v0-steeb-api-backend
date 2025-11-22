// Endpoint para verificar variables de entorno en producción
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envStatus = {
      MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Configurado' : 'No configurado',
      MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ? 'Configurado' : 'No configurado',
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'No configurado',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? 'Configurado' : 'No configurado',
      NODE_ENV: process.env.NODE_ENV || 'development'
    };

    res.status(200).json({
      success: true,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      variables: envStatus,
      message: envStatus.MP_WEBHOOK_SECRET === 'Configurado'
        ? 'Webhook secret configurado correctamente'
        : '❌ MP_WEBHOOK_SECRET no está configurado'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}