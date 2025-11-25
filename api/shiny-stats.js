// Endpoint para consultar estadísticas globales de usuarios shiny
import { getGlobalShinyStats, getShinyUserPosition } from '../lib/firebase.js';

export default async function handler(req, res) {
  try {
    // CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8083',
      'http://127.0.0.1:8083',
      'http://localhost:8083',
      'https://v0-steeb-api-backend.vercel.app',
      'https://steeb.vercel.app',
      'https://steeb2.vercel.app',
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        message: 'Solo se permite GET o POST'
      });
    }

    console.log('🌟 Consultando estadísticas globales shiny...');

    // Obtener estadísticas globales
    const globalStats = await getGlobalShinyStats();

    // Verificar si hay un userId específico para consultar su posición
    const { userId } = req.method === 'POST' ? req.body : req.query;
    let userPosition = null;

    if (userId) {
      try {
        userPosition = await getShinyUserPosition(userId);
        console.log(`👤 Posición del usuario ${userId}: ${userPosition?.position || 'N/A'}/${globalStats.totalShinyUsers}`);
      } catch (error) {
        console.error(`❌ Error obteniendo posición del usuario ${userId}:`, error);
      }
    }

    // Preparar respuesta
    const response = {
      success: true,
      data: {
        totalShinyUsers: globalStats.totalShinyUsers,
        isExclusive: globalStats.totalShinyUsers <= 10,
        recentlyJoined: globalStats.shinyUsersList.slice(-5), // Últimos 5 usuarios en obtener shiny
        totalUsersWithAvatars: globalStats.shinyUsersList.filter(user => user.userAvatar).length,
        // Si hay usuario específico, incluir su información
        ...(userPosition && {
          userStats: {
            position: userPosition.position,
            isShiny: true,
            unlockedAt: userPosition.unlockedAt,
            percentile: ((userPosition.position / globalStats.totalShinyUsers) * 100).toFixed(1) + '%'
          }
        })
      },
      meta: {
        timestamp: new Date().toISOString(),
        lastUpdated: globalStats.lastUpdated,
        featuredUsers: globalStats.totalShinyUsers > 0 ? globalStats.shinyUsersList.slice(0, 3) : [] // Primeros 3 usuarios
      }
    };

    console.log(`✅ Estadísticas consultadas: ${globalStats.totalShinyUsers} usuarios shiny totales`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Shiny Stats Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error consultando las estadísticas shiny.',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}