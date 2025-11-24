import { db, getUserFromFirestore } from '../../lib/firebase.js';
import admin from 'firebase-admin';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8083',
  'http://127.0.0.1:8083',
  'https://v0-steeb-api-backend.vercel.app',
  'https://steeb.vercel.app',
  'https://steeb2.vercel.app',
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Solo se permite POST'
    });
  }

  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Se requiere userId'
      });
    }

    console.log(`[consume-shiny-roll] UserId: ${userId}`);

    const user = await getUserFromFirestore(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    const remainingRolls = await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(userId);
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        throw new Error('User not found');
      }

      const data = snap.data() || {};
      const currentRolls = Number(data.shinyRolls || 0);

      if (currentRolls <= 0) {
        throw new Error('No shiny rolls available');
      }

      tx.update(userRef, {
        shinyRolls: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return currentRolls - 1;
    });

    console.log(`[consume-shiny-roll] Remaining rolls: ${remainingRolls}`);

    return res.status(200).json({
      success: true,
      data: {
        remainingRolls
      },
      message: 'Tirada shiny consumida'
    });

  } catch (error) {
    console.error('[consume-shiny-roll] Error:', error);

    const message = error instanceof Error ? error.message : 'Error desconocido';
    const status = message === 'No shiny rolls available' ? 400 : 500;

    return res.status(status).json({
      success: false,
      error: message,
      message
    });
  }
}
