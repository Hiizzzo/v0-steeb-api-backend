import { getUserFromFirestore } from '../../lib/firebase.js';

export default async function handler(req, res) {
  try {
    // CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8083',
      'http://127.0.0.1:8083',
      'https://v0-steeb-api-backend.vercel.app',
      'https://steeb.vercel.app',
      'https://steeb2.vercel.app',
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let user = await getUserFromFirestore(userId);

    // Si el usuario no existe, asumimos que es un usuario nuevo con valores por defecto
    if (!user) {
      user = {
        tipoUsuario: 'white', // Por defecto
        shinyRolls: 0,
        lastShinyAttemptAt: null
      };
      // No devolvemos 404, permitimos consultar el estado "inicial"
    }

    // Calcular estado de tirada diaria
    const now = new Date();
    const lastAttempt = user.lastShinyAttemptAt ? user.lastShinyAttemptAt.toDate() : null;
    
    let dailyAttemptAvailable = true;
    // DESHABILITADO TEMPORALMENTE: Límite diario de 24hs
    /*
    if (lastAttempt) {
      const isToday = lastAttempt.getDate() === now.getDate() &&
                      lastAttempt.getMonth() === now.getMonth() &&
                      lastAttempt.getFullYear() === now.getFullYear();
      
      if (isToday) {
        dailyAttemptAvailable = false;
      }
    }
    */

    // Tiradas extra compradas
    const extraRolls = user.shinyRolls || 0;

    // Total disponible hoy
    const totalAvailable = (dailyAttemptAvailable ? 1 : 0) + extraRolls;

    return res.json({
      success: true,
      dailyAttemptAvailable,
      extraRolls,
      totalAvailable,
      isShiny: user.tipoUsuario === 'shiny'
    });

  } catch (error) {
    console.error('Error checking shiny status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}