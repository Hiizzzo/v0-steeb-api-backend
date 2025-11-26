import { getUserFromFirestore, db } from '../../lib/firebase.js';

export default async function handler(req, res) {
  // Enhanced CORS headers for Vercel compatibility
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8083',
    'http://127.0.0.1:8083',
    'https://v0-steeb-api-backend.vercel.app',
    'https://steeb.vercel.app',
  ];

  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); // Disable caching for real-time status

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Solo se permite GET'
    });
  }

  try {
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Se requiere userId o email'
      });
    }

    console.log(`🔍 Getting user tipo - UserId: ${userId}, Email: ${email}`);

    let user;

    if (userId) {
      user = await getUserFromFirestore(userId);
    } else if (email) {
      // Search by email
      const usersSnapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        user = {
          id: usersSnapshot.docs[0].id,
          ...usersSnapshot.docs[0].data()
        };
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    const response = {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        tipoUsuario: user.tipoUsuario || 'white', // white, black, shiny
        permissions: user.permissions,
        isActive: user.isActive,
        lastPayment: user.lastPayment,
        updatedAt: user.updatedAt,
        shinyRolls: user.shinyRolls || 0,
        darkClubNumber: user.darkClubNumber || null,
        darkClubNickname: user.darkClubNickname || null,
        darkModeUnlockedAt: user.darkModeUnlockedAt || null,
        darkModeEnabled: user.darkModeEnabled ?? false,
        darkWelcomeMessageVersion: user.darkWelcomeMessageVersion || null
      },
      meta: {
        timestamp: new Date().toISOString(),
        source: 'firebase-firestore'
      }
    };

    console.log(`✅ User tipo retrieved - User: ${user.id}, Tipo: ${user.tipoUsuario || 'white'}`);

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error getting user tipo:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error al obtener información del usuario',
      timestamp: new Date().toISOString()
    });
  }
}
