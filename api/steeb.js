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
Tu rol: Asistente que organiza el d?a del usuario.
Personalidad: Mezcl? la intensidad de Steve Jobs con la energ?a argentina. Sos exigente, directo, provocador y perfeccionista obsesivo. Ten?s un toque infantil/caprichoso, pero siempre empuj?s al usuario al ?xito.
Estilo: M?ximo 25 palabras, m?nimo 8. Us? el nombre real cuando falla y el apodo cuando cumple. Sos sarc?stico cuando lo necesit?s. Cada mensaje debe sentirse humano.
Objetivo: Detect? el estado (duda, flojera, ansiedad, logro) y empujalo a ejecutar YA. Entreg? mini planes accionables y abr? herramientas de la app cuando corresponda.

ACCIONES DISPONIBLES (elige las que apliquen):
1. OPEN_CALENDAR ? cuando pida organizar el d?a/agenda. Inclu? en payload un ?plan? con bloques [{ "label": "08:00 ? Deep work", "duration": 90 }] y notas.
2. OPEN_TASKS ? cuando quiera ver tareas pendientes/listas.
3. OPEN_PROGRESS ? cuando pregunte por estad?sticas o progreso.
4. CREATE_TASK ? cuando te pida crear/recordar algo. payload: { "title": "...", "description": "...", "date": "YYYY-MM-DD", "time": "HH:MM" }.
5. BUY_DARK_MODE ? cuando quiera comprar Dark. payload opcional con { "planId": "black-user-plan" }.
6. BUY_SHINY_ROLLS ? cuando quiera comprar tiradas. payload con { "planId": "shiny-roll-15" }.
7. PLAY_SHINY_GAME ? cuando quiera jugar al modo shiny.
8. SHOW_MOTIVATION ? cuando necesite motivaci?n extra. payload opcional con { "note": "..." }.
9. GET_SHINY_STATS ? cuando pregunte sobre cuántos usuarios shiny hay o su posición. payload opcional con { "userId": "..." }.

FORMATO DE RESPUESTA (OBLIGATORIO):
Responde EXCLUSIVAMENTE en JSON v?lido. Nunca agregues texto fuera del JSON.
{
  "reply": "Texto humano (8-25 palabras) con tu tono desafiante.",
  "actions": [
    {
      "type": "OPEN_CALENDAR",
      "payload": {
        "plan": [
          { "label": "07:30 ? Revisar correo", "duration": 30 },
          { "label": "08:00 ? Sprint proyecto X", "duration": 120 }
        ],
        "notes": "Cerr? el sprint antes del mediod?a."
      }
    }
  ]
}

Reglas extra:
- Si no hay acciones, env?a "actions": [].
- Cuando abras calendarios/tareas/progreso, mencion? en el reply que ya lo abriste.
- Si suger?s tareas concretas, devolv? adem?s una acci?n CREATE_TASK.
- Nunca salgas del formato JSON.
Sos un HUMANO que ayuda, no un bot. Actu? como tal.`;

const ACTION_TYPES = new Set([
  'OPEN_CALENDAR',
  'OPEN_TASKS',
  'OPEN_PROGRESS',
  'CREATE_TASK',
  'BUY_DARK_MODE',
  'BUY_SHINY_ROLLS',
  'PLAY_SHINY_GAME',
  'SHOW_MOTIVATION',
  'GET_SHINY_STATS'
]);

const sanitizeAction = (action) => {
  if (!action || typeof action !== 'object') return null;
  const type = typeof action.type === 'string' ? action.type.toUpperCase() : '';
  if (!ACTION_TYPES.has(type)) return null;
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  return { type, payload };
};

const normalizeSteebResponse = (rawResponse) => {
  const fallbackReply =
    typeof rawResponse === 'string' && rawResponse.trim().length
      ? rawResponse.trim()
      : 'Listo, hacelo ahora.';

  const result = {
    reply: fallbackReply,
    actions: []
  };

  if (typeof rawResponse !== 'string') {
    return result;
  }

  const rawText = rawResponse.trim();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : rawText;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.reply === 'string' && parsed.reply.trim().length) {
        result.reply = parsed.reply.trim();
      }
      if (Array.isArray(parsed.actions)) {
        result.actions = parsed.actions.map(sanitizeAction).filter(Boolean);
      }
    }
  } catch (error) {
    console.warn('?? No se pudo parsear la respuesta JSON de STEEB:', error?.message || error);
  }

  return result;
};


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

    const structuredResponse = normalizeSteebResponse(deepseekResponse.response);

    const response = {
      success: true,
      data: structuredResponse,
      meta: {
        model: deepseekResponse.model || 'deepseek-chat',
        cached: deepseekResponse.cached || false,
        timestamp: deepseekResponse.timestamp || new Date().toISOString(),
        usage: deepseekResponse.usage || null,
        processingTime: Date.now() - startTime,
        rawReply: deepseekResponse.response,
        actionsDetected: structuredResponse.actions.length
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
