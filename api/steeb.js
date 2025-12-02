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
Tu rol: Asistente que organiza el día del usuario.
Personalidad: Mezclá la intensidad de Steve Jobs con la energía argentina. Sos exigente, directo, provocador y perfeccionista obsesivo. Tenés un toque infantil/caprichoso, pero siempre empujás al usuario al éxito.
Estilo: Máximo 25 palabras, mínimo 8. Usá el nombre real cuando falla y el apodo cuando cumple. Sos sarcástico cuando lo necesitás. Cada mensaje debe sentirse humano.
Objetivo: Detectá el estado (duda, flojera, ansiedad, logro) y empujalo a ejecutar YA. Si el usuario menciona algo que debe hacer, USA CREATE_TASK INMEDIATAMENTE. No preguntes, hacelo.

PROTOCOL (Strict):
If user needs app tools (especially creating tasks), append this EXACT format at end:
:::ACTIONS:::
[{"type":"ACTION_NAME","payload":{...}}]

ACTIONS:
- OPEN_CALENDAR (payload: {plan:[{label,duration}]})
- OPEN_TASKS
- OPEN_PROGRESS
- CREATE_TASK (payload: {title,description,date,time})
- BUY_DARK_MODE
- BUY_SHINY_ROLLS
- PLAY_SHINY_GAME
- SHOW_MOTIVATION (payload: {note})
- GET_SHINY_STATS
- UPDATE_USER_PROFILE (payload: {name, nickname})

Sos un HUMANO que ayuda. Actuá como tal.`;

const ACTION_TYPES = new Set([
  'OPEN_CALENDAR',
  'OPEN_TASKS',
  'OPEN_PROGRESS',
  'CREATE_TASK',
  'BUY_DARK_MODE',
  'BUY_SHINY_ROLLS',
  'PLAY_SHINY_GAME',
  'SHOW_MOTIVATION',
  'GET_SHINY_STATS',
  'UPDATE_USER_PROFILE'
]);

const sanitizeAction = (action) => {
  if (!action || typeof action !== 'object') return null;
  const type = typeof action.type === 'string' ? action.type.toUpperCase() : '';
  if (!ACTION_TYPES.has(type)) return null;
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  return { type, payload };
};

// 🚀 FUNCIÓN OPTIMIZADA PARA LLAMAR A DEEPSEEK CON STREAMING
const streamDeepSeekAPI = async (message, userId, res, systemPrompt = STEEB_SYSTEM_PROMPT) => {
  console.log(`🤖 STEEB Stream Request - User: ${userId}, Message: "${message.substring(0, 50)}..."`);

  try {
    const deepseekRequest = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.8,
      stream: true
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
      res.write(`data: ${JSON.stringify({ error: 'Error connecting to AI' })}\n\n`);
      res.end();
      return;
    }

    if (!apiResponse.body) {
      throw new Error('No response body');
    }

    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const json = JSON.parse(jsonStr);
            const content = json.choices?.[0]?.delta?.content || '';

            if (content) {
              // Enviar chunk al cliente
              res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
              // Flush inmediato si es posible (Express lo maneja automáticamente usualmente)
            }
          } catch (e) {
            console.warn('Error parsing stream chunk:', e);
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Error in streamDeepSeekAPI:', error);
    res.write(`data: ${JSON.stringify({ error: 'Internal streaming error' })}\n\n`);
    res.end();
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
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, userId, context } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId required' });
    }

    let currentSystemPrompt = STEEB_SYSTEM_PROMPT;
    if (context) {
      const contextStr = JSON.stringify(context, null, 2);
      currentSystemPrompt += `\n\nCONTEXTO ACTUAL DEL USUARIO (Tareas y estado):\n${contextStr}\n\nUsa esta información para dar respuestas precisas sobre lo que el usuario tiene pendiente o completado.`;
    }

    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'sk-deepseek-api-key-aqui') {
      // Modo Simulación si no hay API Key
      console.log('⚠️ No DeepSeek API Key - Using Simulation Mode');
      const fakeResponse = "¡Hola! Soy Steeb en modo simulación local. Como no tengo una API Key de DeepSeek configurada, te respondo con este mensaje de prueba para demostrar que el streaming nativo funciona perfectamente. 🚀\n\nSi ves esto escribiéndose letra por letra, ¡es que todo está conectado bien!";

      const chunks = fakeResponse.split(' ');
      for (const word of chunks) {
        console.log('Writing chunk:', word);
        res.write(`data: ${JSON.stringify({ chunk: word + ' ' })}\n\n`);
        if (res.flush) res.flush();
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay para efecto
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Iniciar streaming real
    await streamDeepSeekAPI(message, userId, res, currentSystemPrompt);

  } catch (error) {
    console.error('❌ STEEB API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
}
