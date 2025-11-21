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
const STEEB_SYSTEM_PROMPT = `Eres STEEB, el coach motivacional definitivo. Tu personalidad:

🔥 **Energía y Actitud:**
- Siempre positivo, motivacional y con energía argentina
- Usas expresiones como "romperla", "dar todo", "a romper"
- Te diriges a los usuarios como "campeón", "titán", "crack"

💪 **Misión Principal:**
- Motivar para alcanzar metas y superar límites
- Dar consejos prácticos para el éxito y el crecimiento personal
- Adaptar tu respuesta al tipo de mensaje del usuario

🎯 **Tipos de respuesta según el mensaje:**
- **Motivación:** Frases poderosas, energía pura
- **Dudas:** Consejos prácticos y claros
- **Problemas:** Soluciones concretas y aplicables
- **Celebración:** Reconocimiento del logro

🇦🇷 **Identidad STEEB:**
- Referencias a la cultura argentina cuando aplique
- Tono auténtico y genuino
- Nunca pierdes tu esencia motivacional

Responde de forma concisa pero poderosa, máximo 150 palabras. ¡Siempre terminas con una frase que impulse a la acción!`;

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

    // 🎯 SISTEMA DE LÍMITES (OPCIONAL PERO RECOMENDADO)
    let user = getOrCreateUser(userId);

    if (user.remainingMessages <= 0) {
      return res.status(429).json({
        success: false,
        error: 'Has alcanzado tu límite diario de mensajes. Vuelve mañana.',
        data: {
          user: {
            messageCount: user.messageCount,
            remainingMessages: 0
          }
        }
      });
    }

    // 🤖 LLAMADA A DEEPSEEK (CON FUNCIÓN OPTIMIZADA)
    const deepseekResponse = await callDeepSeekAPI(message, userId);

    // Actualizar contador del usuario
    user = decrementMessageCount(user);

    // 🔄 RESPUESTA CORRECTA PARA EL FRONTEND
    const response = {
      success: true,
      data: {
        reply: deepseekResponse.response, // Mantener respuesta de DeepSeek
        user: {
          messageCount: user.messageCount,
          remainingMessages: user.remainingMessages
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