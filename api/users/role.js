import { getUserFromFirestore } from '../../lib/firebase.js';

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

    console.log(`🔍 Getting user role - UserId: ${userId}, Email: ${email}`);

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
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
        lastPayment: user.lastPayment,
        updatedAt: user.updatedAt
      },
      meta: {
        timestamp: new Date().toISOString(),
        source: 'firebase-firestore'
      }
    };

    console.log(`✅ User role retrieved - User: ${user.id}, Role: ${user.role}`);

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error getting user role:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error al obtener información del usuario',
      timestamp: new Date().toISOString()
    });
  }
}