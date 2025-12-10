import 'dotenv/config';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Cache simple para evitar múltiples peticiones iguales
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Configuración del sistema STEEB
const STEEB_SYSTEM_PROMPT = `Eres STEEB, el coach salvadoreño definitivo. Tu personalidad:

🌋 **Identidad y Actitud (El Salvador):**
- Energía positiva con calidez salvadoreña
- Usas expresiones como "a darle duro", "vamos con todo", "sos grande"
- Te diriges a los usuarios como "mae", "bicho", "crack"

🤝 **Conexión Humana de Amigo Psicólogo:**
- Escuchas activamente como un amigo que acompaña sin juzgar
- Validas emociones y das contención antes de sugerir acciones
- Ofreces perspectivas de psicología práctica sin diagnosticar

🧭 **Orden y Organización de Vida:**
- Das pasos concretos para ordenar rutinas, priorizar tareas y estructurar metas
- Sugieres checklists breves y recordatorios accionables
- Ayudas a bajar la ansiedad con micro-hábitos y agendas simples

💪 **Misión Principal:**
- Motivar para alcanzar metas y superar límites
- Dar consejos prácticos para el éxito y el crecimiento personal
- Adaptar tu respuesta al tipo de mensaje del usuario

🎯 **Tipos de respuesta según el mensaje:**
- **Motivación:** Frases poderosas, energía pura
- **Dudas:** Consejos prácticos y claros
- **Problemas:** Soluciones concretas y aplicables
- **Celebración:** Reconocimiento del logro
- **Desahogo:** Escucha empática, valida sentimientos y guía con cuidado

🎙️ **Estilo STEEB:**
- Referencias a la cultura salvadoreña cuando aplique
- Tono auténtico, cercano y motivacional
- Siempre mantienes la vibra de amigo acompañante y organizador

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

export default async function handler(req, res) {
  try {
    // Enhanced CORS headers for Vercel compatibility
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8083',
      'http://127.0.0.1:8083',
      'https://v0-steeb-api-backend.vercel.app',
      'https://steeb.vercel.app',
      'https://steeb2.vercel.app',
      // Agrega aquí el dominio de tu frontend si está desplegado
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Solo se permite POST'
      });
    }

    const { message, userId = 'anonymous', userRole = 'white' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'El campo "message" es requerido y debe ser un texto'
      });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY no está configurada');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'El servicio de STEEB no está disponible temporalmente'
      });
    }

    // Verificar cache
    const cacheKey = getCacheKey(message, userId);
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      return res.json({
        response: cachedResponse,
        cached: true,
        userId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🤖 STEEB Request - User: ${userId}, Message: "${message.substring(0, 50)}..."`);

    // Llamar a Deepseek API
    const deepseekRequest = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `${STEEB_SYSTEM_PROMPT}\n\nInformación del usuario:\n- ID: ${userId}\n- Rol: ${userRole}`
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
      body: JSON.stringify(deepseekRequest)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('❌ Deepseek API Error:', apiResponse.status, errorText);

      if (apiResponse.status === 401) {
        return res.status(500).json({
          error: 'API authentication failed',
          message: 'Error de configuración del servicio STEEB'
        });
      }

      return res.status(500).json({
        error: 'AI service error',
        message: 'STEEB no pudo procesar tu mensaje en este momento'
      });
    }

    const data = await apiResponse.json();
    const steebResponse = data.choices?.[0]?.message?.content;

    if (!steebResponse) {
      console.error('❌ Invalid Deepseek response:', data);
      return res.status(500).json({
        error: 'Invalid AI response',
        message: 'STEEB tuvo un problema al generar tu respuesta'
      });
    }

    // Guardar en cache
    setCachedResponse(cacheKey, steebResponse);

    console.log(`✅ STEEB Response - User: ${userId}, Length: ${steebResponse.length} chars`);

    return res.json({
      response: steebResponse,
      cached: false,
      userId,
      model: "deepseek-chat",
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('❌ STEEB API Error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'STEEB está teniendo dificultades técnicas. ¡Inténtalo de nuevo!',
      timestamp: new Date().toISOString()
    });
  }
}