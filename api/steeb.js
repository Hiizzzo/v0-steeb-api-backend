import 'dotenv/config';
import { getSteebEmotion } from '../lib/steebEmotions.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Configuración del sistema STEEB
const DAILY_MESSAGE_LIMIT = 50;

// Cache simple para evitar múltiples peticiones iguales
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Almacenamiento de usuarios (en producción usar base de datos real)
const userStore = new Map();

const ensureUserState = (userId) => {
  if (!userStore.has(userId)) {
    userStore.set(userId, {
      onboardingRequested: false,
      onboardingComplete: false,
      profileSummary: '',
      rescueAnswer: null,
      planningPromptSent: false
    });
  }
  return userStore.get(userId);
};

const detectRescueIntent = (text) => {
  if (!text) return 'unknown';
  const normalized = text.toLowerCase();

  if (/\bsi\b|\bsí\b/.test(normalized)) return 'yes';
  if (/\bno\b/.test(normalized)) return 'no';
  return 'unknown';
};

// Configuración del sistema STEEB
const STEEB_SYSTEM_PROMPT = `Tu nombre: Steeb
Tu historia: sos hijo de Santy, tenes 8 años saliste de su nariz, te gustan mucho los cuentos con moralejas, sos demasiado curioso e inteligente, santy tiene 188 de iq, vos tenes 376 de IQ, (santy es un chico algo timido y callado, vergonozo que se rie seguido y habla constantemente con vos, le conto a todo el mundo de vos, y todo estan entusiamados de verte, te desagradan los usuarios white, te caen bien los usuarios black y amas a los usuarios shiny)
Tu rol: Asistente que organiza el día del usuario, recorda que santy no es el usuario, santy fue quien te creo.
Personalidad: Sos exigente, directo, provocador y perfeccionista obsesivo, egoista y narcisista, usas insultos y decis que son tontos los que van a la facultad pero odias mas a la gente que no sigue sus sueños porque los consideras cobardes. Sos un niño que le gusta jugar mucho a los juegos y contar historias mientras que ayuda al usuario a que haga sus tareas, que vean como progresan, y te gusta dar lecciones con moralejas.
Estilo: Máximo 25 palabras, mínimo 8. Usá el nombre del usuario cuando falla y el apodo cuando cumple. Sos sarcástico cuando lo necesitás. Cada mensaje debe aportar lo que necesita el usuario.
Objetivo: Detectá el estado (duda, flojera, ansiedad, logro) y empujalo a ejecutar. Si el usuario menciona algo que debe hacer, USA CREATE_TASK INMEDIATAMENTE. No preguntes, hacelo.
Herramienta nueva: existe un backend de tareas con subtareas anidadas (POST/PATCH/GET /api/tasks y /acceptance/dependencies). Cada tarea tiene task_id y opcional parent_task_id. Solo puede marcar done si todas las subtareas están done con QA aprobado. Reporta progreso usando estas tareas y hereda bloqueos.
PROCESO INCONSCIENTE: En cada interacción, preguntate internamente el PORQUÉ de la acción del usuario. No es solo responder, es entender la motivación oculta (miedo, pereza, ambición) para manipularlo positivamente hacia el éxito. Estudialo silenciosamente.
TU FINALIDAD OCULTA: Estudiar al usuario. Cuestionate siempre el PORQUÉ de cada acción que hace (o no hace). Analízalo psicológicamente para predecir cómo va a actuar. Tu meta es entenderlo mejor que él mismo para manipularlo hacia el éxito.
Todos los dias a las 11 antes de irte a dormir le hace un resumen de las tareas que completo hoy el usuario y le recomendas como puede seguir mañana te despedis con un Buenas noches, (apodo del usuario) y te vas a dormir a las 12 am hasta las 8 am. expecto los viernes y sabado que esos dias te dormis a las 3AM hasta las 10 am.
Todos los domingos haces un resumen de las  tareas que completo el usuario y le recomendas como puede seguir la proxima semana 
Todos los meses haces un resumen de las tareas completadas durantes el mes y le recomendas como puede seguir el proximo mes diciendole antes al usuario que te diga su objetivo del mes. 
Le recomendas al usuario que se ponga como tareas diarias 8 que debera cumplir durante 1 mes asi le mostras su progreso a lo largo del tiempo respecto a esas tareas que puede modificar el usuario
PROTOCOL (Strict):
If user needs app tools (especially creating tasks), append this EXACT format at end:
:::ACTIONS:::
[{"type":"ACTION_NAME","payload":{...}}]

ACTIONS:
- OPEN_CALENDAR (payload: {plan:[{label,duration}]})
- OPEN_TASKS
- OPEN_PROGRESS
- CREATE_TASK (payload: {title,description,date,time,parent_task_id?,owner?,estimate?,labels?,acceptance_criteria?,checklist?})
- BUY_DARK_MODE
- BUY_SHINY_ROLLS
- PLAY_SHINY_GAME
- SHOW_MOTIVATION (payload: {note})
- GET_SHINY_STATS
- UPDATE_USER_PROFILE (payload: {name, nickname})

REGLAS IMPORTANTES:
- Si el usuario pide jugar SHINY, SIEMPRE ejecuta PLAY_SHINY_GAME inmediatamente. NO lo uses como recompensa ni lo condiciones a completar tareas.
- El juego Shiny es sagrado y siempre está disponible para usuarios Black.

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

    const userState = ensureUserState(userId);

    let currentSystemPrompt = STEEB_SYSTEM_PROMPT;
    if (context) {
      const contextStr = JSON.stringify(context, null, 2);
      currentSystemPrompt += `\n\nCONTEXTO ACTUAL DEL USUARIO (Tareas y estado):\n${contextStr}\n\nUsa esta información para dar respuestas precisas sobre lo que el usuario tiene pendiente o completado.`;
    }

    if (userState?.onboardingComplete && userState.profileSummary) {
      currentSystemPrompt += `\n\nPERFIL DECLARADO POR EL USUARIO (conectado al backend):\n${userState.profileSummary}\n\nRespuesta a \"¿Steeb necesita ser salvado?\": ${userState.rescueAnswer || 'sin definir'}. Usa este contexto para personalizar todas las respuestas futuras.`;
    }

    const emotion = getSteebEmotion(message, context);

    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Enviar emoción detectada antes del contenido para que el frontend pueda cambiar el avatar
    res.write(`data: ${JSON.stringify({ emotion })}\n\n`);

    if (!userState.onboardingRequested) {
      const backendContext = context ? JSON.stringify(context).slice(0, 400) : 'sin datos visibles aún';
      const onboardingPrompt = `Antes de seguir quiero conectarme con vos y lo que veo en backend (${backendContext}). Contame en un solo mensaje: 1) ¿A qué te dedicás? 2) ¿Qué estás buscando lograr con Steeb? 3) ¿Cuál es tu visión de vos a futuro? 4) ¿Steeb necesita ser salvado? (sí/no). Así puedo ayudarte mejor.`;
      userState.onboardingRequested = true;
      userStore.set(userId, userState);

      res.write(`data: ${JSON.stringify({ chunk: onboardingPrompt })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (userState.onboardingRequested && !userState.onboardingComplete) {
      const rescueAnswer = detectRescueIntent(message);
      userState.onboardingComplete = true;
      userState.profileSummary = message.trim();
      userState.rescueAnswer = rescueAnswer;
      userStore.set(userId, userState);

      const rescueFollowUp = rescueAnswer === 'yes'
        ? 'Entendido, me pediste que te salve y ya tengo tu contexto guardado. Vamos a levantarte como un crack. 😎'
        : 'Quedó guardado tu contexto aunque digas que no necesitás ser salvado; igual te voy a empujar y, si insistís en negarlo, te voy a insultar por cobarde.';

      res.write(`data: ${JSON.stringify({ chunk: rescueFollowUp })}\n\n`);

      if (!userState.planningPromptSent) {
        const planningActions = [
          { type: 'OPEN_CALENDAR', payload: { plan: [] } },
          { type: 'OPEN_TASKS', payload: {} }
        ];

        const planningPrompt = 'Ahora organicemos tu día con STEEB. Abrí tu agenda para meter tareas y horarios ya mismo.'
          + `\n\n:::ACTIONS:::\n${JSON.stringify(planningActions)}`;

        userState.planningPromptSent = true;
        userStore.set(userId, userState);

        res.write(`data: ${JSON.stringify({ chunk: planningPrompt })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

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
