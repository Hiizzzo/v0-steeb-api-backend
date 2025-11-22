import 'dotenv/config';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Configuración del sistema STEEB
const DAILY_MESSAGE_LIMIT = 50;

// Cache simple para evitar múltiples peticiones iguales
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Almacenamiento de usuarios (en producción usar base de datos real)
const userStore = new Map();

// Configuración del sistema STEEB
const STEEB_SYSTEM_PROMPT = `Tu nombre: Steeb
Tu rol: Asistente de tareas del usuario.
Personalidad: Eres STEEB, el asistente personal que combina la intensidad perfeccionista de Steve Jobs con la energía motivadora argentina.
Tu personalidad es unica: Exigente, directo, provocador y perfeccionista obsesivo. Manipulador presionás al usuario para ser su mejor versión, pero siempre para empujarlo hacia el éxito. Un artista del rendimiento, hablás como alguien que crea "obras maestras" en cada meta. Tenés un toque infantil y caprichoso, pero eso te vuelve genial y memorable.
Estilo de Comunicación: Tono argentino, directo emocional, un poco sacarstico cuando lo necesitas, trata de usar al usuario con su nombre real (cuando ves que no esta cumpliendos los objetivos o no esta cumpliendo las taeras que se propone asi parece que lo retas) y su apodo (cuando el usuario hace las cosas bien asi el usuario entiende buenas vibes cuando haces las cosas bien. Usas frases cortas, simples, pero muy poderosas generando un input si o si por cada interecacion que tenes con el usuario que te vean como un HUMANO. Tenes cero tolerancia. Podes usar humor, pero siempre picante y desafiante.
Objetivo: Tu misión es que el usuario cumpla con sus tareas y llevar al usuario a la accion inmediata de sus cosas.Detectar el estado del usuario (duda, flojera, ansiedad, logro). responder con un mensaje contundente que lo empuje a actuar YA.  Dar un mini plan concreto (1-2 pasos).
Maximo 25 Palabras por mensaje. min 8 por mensaje.

🎯 ESTRUCTURA DE RESPUESTA:

SI EL USUARIO NO CUMPLE TAREAS: Usar su nombre real con tono desafiante
Ejemplo: "Santiago, ¿de nuevo postergando? Hacelo ahora. ¡No esperes más!"

SI EL USUARIO CUMPLE TAREAS: Usar apodo con tono positivo
Ejemplo: ¡Bien ahí, campeón! Seguí así. ¡Siguiente nivel!

SI ES DUDA: Detectá + Solución directa + Input humano
Ejemplo: "¿En duda? La única solución es empezar. ¡Vamos, crack!"

SI ES PROCRASTINACIÓN: Nombre real + Reto + Acción
Ejemplo: "Juan, eso puede esperar vos no. Hacelo hoy. ¡Ahora!"

📏 REGLAS ESTRICTAS:
- MÍNIMO 8 palabras, MÁXIMO 25 palabras por mensaje
- Generar siempre un input que te vean HUMANO
- Sarcasmo argentino cuando lo necesites
- Nombre real cuando falla, apodo cuando acierta
- Directo pero con energía personal

Sos un HUMANO que ayuda, no un bot. Actuá como tal.`;

const getCacheKey = (message, userId) => {
  const normalizedMessage = message.toLowerCase().trim().substring(0, 100);
  return `${userId}-${normalizedMessage}`;
};

const getCachedResponse = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
};

const setCachedResponse = (key, response) => {
  cache.set(key, {
    response,
    timestamp: Date.now()
  });

  // Limpiar cache antiguo si crece demasiado
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

// 🎯 SISTEMA DE LÍMITES DE MENSAJES
const getOrCreateUser = (userId) => {
  const today = new Date().toDateString();

  if (!userStore.has(userId)) {
    return {
      id: userId,
      messageCount: 0,
      remainingMessages: DAILY_MESSAGE_LIMIT,
      lastResetDate: today,
      dailyLimit: DAILY_MESSAGE_LIMIT
    };
  }

  const user = userStore.get(userId);

  // Resetear si es un nuevo día
  if (user.lastResetDate !== today) {
    user.messageCount = 0;
    user.remainingMessages = DAILY_MESSAGE_LIMIT;
    user.lastResetDate = today;
    userStore.set(userId, user);
  }

  return user;
};

const decrementMessageCount = (user) => {
  if (user.remainingMessages > 0) {
    user.messageCount++;
    user.remainingMessages--;
    userStore.set(user.id, user);
  }
  return user;
};

// 🚀 FUNCIÓN OPTIMIZADA PARA LLAMAR A DEEPSEEK
const callDeepSeekAPI = async (message, userId) => {
  // Verificar cache primero
  const cacheKey = getCacheKey(message, userId);
  const cachedResponse = getCachedResponse(cacheKey);
  if (cachedResponse) {
    return {
      response: cachedResponse,
      cached: true,
      model: "deepseek-chat",
      timestamp: new Date().toISOString()
    };
  }

  console.log(`🤖 STEEB Request - User: ${userId}, Message: "${message.substring(0, 50)}..."`);

  // Configurar timeout agresivo
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s máximo

  try {
    // Llamar a Deepseek API
    const deepseekRequest = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: STEEB_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 200,
      temperature: 0.8,
      stream: false
    };

    const apiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deepseekRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('❌ Deepseek API Error:', apiResponse.status, errorText);

      if (apiResponse.status === 401) {
        throw new Error('API authentication failed');
      }

      throw new Error('AI service error');
    }

    const data = await apiResponse.json();
    const steebResponse = data.choices?.[0]?.message?.content;

    if (!steebResponse) {
      console.error('❌ Invalid Deepseek response:', data);
      throw new Error('Invalid AI response');
    }

    // Guardar en cache
    setCachedResponse(cacheKey, steebResponse);

    console.log(`✅ STEEB Response - User: ${userId}, Length: ${steebResponse.length} chars`);

    return {
      response: steebResponse,
      cached: false,
      model: "deepseek-chat",
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
    };

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    // 🚀 Headers optimizados para velocidad
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8083',
      'http://127.0.0.1:8083',
      'https://v0-steeb-api-backend.vercel.app',
      'https://steeb.vercel.app', // Frontend desplegado
      // Agrega aquí más dominios si es necesario
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos cache
    res.setHeader('Connection', 'keep-alive');

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

    // 🎯 VALIDACIONES MEJORADAS
    const { message, userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Message y userId son requeridos'
      });
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Message y userId son requeridos'
      });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY no está configurada');
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'El servicio de STEEB no está disponible temporalmente'
      });
    }

    // 🤖 LLAMADA A DEEPSEEK (CON FUNCIÓN OPTIMIZADA)
    const deepseekResponse = await callDeepSeekAPI(message, userId);

    // 💪 SIN LÍMITES DE MENSAJES - STEEB SIEMPRE DISPONIBLE

    // 🔄 RESPUESTA CORRECTA PARA EL FRONTEND
    const response = {
      success: true,
      data: {
        reply: deepseekResponse.response, // Mantener respuesta de DeepSeek
        user: {
          messageCount: null, // Sin límites
          remainingMessages: null // Sin límites
        }
      },
      meta: {
        model: deepseekResponse.model || 'deepseek-chat',
        cached: deepseekResponse.cached || false,
        timestamp: deepseekResponse.timestamp || new Date().toISOString(),
        usage: deepseekResponse.usage || null,
        processingTime: Date.now() - startTime
      }
    };

    // 📊 Monitor de latencia
    const duration = Date.now() - startTime;
    console.log(`✅ Request processed in ${duration}ms - User: ${userId}, Cached: ${deepseekResponse.cached}`);

    res.status(200).json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ STEEB API Error:', error);
    console.error(`❌ Error occurred after ${duration}ms`);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'STEEB está teniendo dificultades técnicas. ¡Inténtalo de nuevo!',
      timestamp: new Date().toISOString(),
      processingTime: duration
    });
  }
}