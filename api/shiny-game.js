import { db, getUserFromFirestore, addShinyUserToGlobalCounter, getShinyUserPosition } from '../lib/firebase.js';
import admin from 'firebase-admin';

// Helper function to convert numbers to Spanish ordinals
const getOrdinal = (num) => {
  const exceptions = {
    1: 'primer',
    2: 'segundo',
    3: 'tercer',
    4: 'cuarto',
    5: 'quinto',
    6: 'sexto',
    7: 'séptimo',
    8: 'octavo',
    9: 'noveno',
    10: 'décimo',
    11: 'undécimo',
    12: 'duodécimo'
  };

  if (exceptions[num]) {
    return exceptions[num];
  }

  // For larger numbers, use generic ordinal
  if (num >= 13 && num <= 19) {
    return 'decimo' + getOrdinal(num - 10);
  }

  if (num >= 20 && num <= 29) {
    return 'vigésimo ' + getOrdinal(num - 20);
  }

  if (num >= 30 && num <= 99) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    const tensWords = ['trigésimo', 'cuadragésimo', 'quincuagésimo', 'sexagésimo', 'septuagésimo', 'octogésimo', 'nonagésimo'];
    return tensWords[tens - 3] + (units > 0 ? ' ' + getOrdinal(units) : '');
  }

  // For simplicity beyond 100
  return `${num}º`;
};

export default async function handler(req, res) {
  try {
    // CORS is handled by server.js middleware

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
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 2) {
      return res.status(400).json({
        error: 'Invalid guess',
        message: 'El número debe ser entre 1 y 2'
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
    const secret = Math.floor(Math.random() * 2) + 1;
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

    // 6. Si ganó, agregar al contador global shiny
    let shinyStats = null;
    let finalMessage = won ? '¡GANASTE SHINY! 🎉' : `No acertaste. ${hint}`;

    if (won) {
      console.log(`🌟 Usuario ganó el juego shiny, agregando al contador global...`);

      try {
        // Verificar si ya es shiny para evitar duplicados
        const existingPosition = await getShinyUserPosition(userId);

        if (!existingPosition) {
          // Es un nuevo usuario shiny
          shinyStats = await addShinyUserToGlobalCounter(
            userId,
            user.displayName || user.email || 'Usuario Anónimo',
            user.avatar || null
          );

          // Generar mensaje de felicitación según posición
          const position = shinyStats.position;
          const ordinal = getOrdinal(position);

          finalMessage = `¿¿¿EN SERIO LO ADIVINASTE??? 🤯🤯🤯 ¡¡¡FELICITACIONES!!! 🎉🎉🎉 Ahora sos USUARIO SHINY ✨. Sos el usuario número ${position} en lograrlo. ¡Actualmente hay ${shinyStats.totalShinyUsers} usuarios SHINY en todo el mundo! 🌍🏆`;

          console.log(`✅ Usuario agregado al contador global. Posición: ${position}/${shinyStats.totalShinyUsers}`);
          console.log(`🎉 Mensaje de felicitación: ${finalMessage}`);
        } else {
          // Ya era shiny previamente (raro caso pero posible)
          finalMessage = `¡Ya eres parte del club SHINY! 🌟 Ganaste, pero ya eras el ${getOrdinal(existingPosition.position)} usuario en desbloquearlo.`;
          shinyStats = {
            position: existingPosition.position,
            totalShinyUsers: existingPosition.totalShinyUsers
          };

          console.log(`ℹ️ Usuario ya era shiny. Posición existente: ${existingPosition.position}/${existingPosition.totalShinyUsers}`);
        }
      } catch (error) {
        console.error('❌ Error al agregar usuario al contador global shiny:', error);
        // Continuar con el proceso aunque falle el contador
      }
    }

    // 7. Responder
    return res.json({
      success: true,
      won,
      secret,
      message: finalMessage,
      remainingRolls: usedExtraRoll ? (user.shinyRolls - 1) : (user.shinyRolls || 0),
      // Agregar información shiny si ganó
      ...(shinyStats && {
        shinyStats: {
          position: shinyStats.position,
          totalShinyUsers: shinyStats.totalShinyUsers,
          isExclusive: shinyStats.totalShinyUsers <= 10, // Es exclusivo si hay 10 o menos
          isNewShiny: true
        }
      })
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
// Force redeploy 2