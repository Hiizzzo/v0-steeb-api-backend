import { db, getUserFromFirestore } from '../lib/firebase.js';
import admin from 'firebase-admin';

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

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Solo se permite POST'
      });
    }

    const { userId, guess } = req.body;

    if (!userId || guess === undefined) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Faltan datos requeridos (userId, guess)'
      });
    }

    const guessNum = parseInt(guess, 10);
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 100) {
      return res.status(400).json({
        error: 'Invalid guess',
        message: 'El número debe ser entre 1 y 100'
      });
    }

    // 1. Obtener usuario
    const user = await getUserFromFirestore(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    // 2. Verificar permisos (Debe ser al menos DARK)
    if (user.tipoUsuario === 'shiny') {
      return res.json({
        success: true,
        alreadyWon: true,
        message: '¡Ya sos Shiny! No necesitas jugar más.'
      });
    }

    if (user.tipoUsuario !== 'dark' && user.tipoUsuario !== 'black') {
       return res.status(403).json({
        error: 'Permission denied',
        message: 'Necesitas ser usuario Dark para jugar.'
      });
    }

    // 3. Verificar límite diario
    const now = new Date();
    const lastAttempt = user.lastShinyAttemptAt ? user.lastShinyAttemptAt.toDate() : null;
    
    let canPlay = true;
    if (lastAttempt) {
      const isToday = lastAttempt.getDate() === now.getDate() &&
                      lastAttempt.getMonth() === now.getMonth() &&
                      lastAttempt.getFullYear() === now.getFullYear();
      
      if (isToday) {
        canPlay = false;
      }
    }

    // Permitir jugar si compró intentos extra (shinyRolls > 0)
    let usedExtraRoll = false;
    if (!canPlay) {
      if (user.shinyRolls && user.shinyRolls > 0) {
        canPlay = true;
        usedExtraRoll = true;
      } else {
        // Calcular tiempo restante
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilTomorrow = tomorrow - now;
        
        return res.status(429).json({
          error: 'Daily limit reached',
          message: 'Ya usaste tu intento diario.',
          nextAttemptIn: msUntilTomorrow
        });
      }
    }

    // 4. Generar número secreto y comparar
    // NOTA: En un juego real, el secreto debería persistir por sesión o día para no cambiar en cada intento si fuera el mismo "juego".
    // Pero aquí cada intento es una tirada nueva.
    const secret = Math.floor(Math.random() * 100) + 1;
    const won = guessNum === secret;
    const diff = Math.abs(guessNum - secret);
    
    let hint = '';
    if (!won) {
      if (diff <= 5) hint = '¡Uff! Estuviste MUY cerca... 🔥';
      else if (diff <= 10) hint = 'Casi... Estás cerca. 🌡️';
      else if (diff <= 20) hint = 'Ni frío ni calor. 😐';
      else hint = 'Lejos, muy lejos... ❄️';
      
      hint += ` (Era el ${secret})`; // Revelar el número para transparencia (opcional, o quitar si se quiere más hardcore)
    }

    // 5. Actualizar usuario
    const updates = {
      lastShinyAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      shinyAttemptsToday: admin.firestore.FieldValue.increment(1)
    };

    if (usedExtraRoll) {
      updates.shinyRolls = admin.firestore.FieldValue.increment(-1);
    }

    if (won) {
      updates.tipoUsuario = 'shiny';
      updates.permissions = admin.firestore.FieldValue.arrayUnion('shiny_mode');
    }

    await db.collection('users').doc(userId).update(updates);

    // 6. Responder
    return res.json({
      success: true,
      won,
      secret,
      message: won ? '¡GANASTE SHINY! 🎉' : `No acertaste. ${hint}`,
      remainingRolls: usedExtraRoll ? (user.shinyRolls - 1) : (user.shinyRolls || 0)
    });

  } catch (error) {
    console.error('❌ Shiny Game Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error procesando el juego.'
    });
  }
}
// Force redeploy