import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// 🚀 Configuración y constantes
const CONFIG = {
  MESSAGE_LIMIT: 100,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos
  AI_TIMEOUT: 30000, // 30 segundos
}

// 💾 Cache en memoria simple para usuarios frecuentes
interface UserCache {
  data: { messages: number; lastUpdated: Date }
  expires: number
}
const userCache = new Map<string, UserCache>()

// 🔧 Utilidades
const log = (level: "INFO" | "WARN" | "ERROR", message: string, userId?: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const userIdStr = userId ? ` [userId: ${userId}]` : ""
  const dataStr = data ? ` ${JSON.stringify(data)}` : ""
  console.log(`[${timestamp}] ${level}${userIdStr}: ${message}${dataStr}`)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const sanitizeInput = (input: string): string => {
  return input.trim().slice(0, CONFIG.MAX_MESSAGE_LENGTH)
}

const generateUserId = (): string => {
  return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// 🔄 Reintentos con exponential backoff
const retryOperation = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  userId?: string,
  retries: number = CONFIG.MAX_RETRIES
): Promise<T> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isLastAttempt = attempt === retries
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1)

      log(
        isLastAttempt ? "ERROR" : "WARN",
        `Attempt ${attempt}/${retries} failed for ${operationName}`,
        userId,
        { error: error instanceof Error ? error.message : "Unknown error", delay }
      )

      if (isLastAttempt) throw error

      await sleep(delay)
    }
  }

  throw new Error(`All ${retries} attempts failed for ${operationName}`)
}

// 🗃️ Servicios de Supabase
class SupabaseService {
  private client: SupabaseClient

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration")
    }

    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'public'
        },
        auth: {
          persistSession: false
        }
      }
    )
  }

  async getUserUsage(userId: string): Promise<{ messages: number } | null> {
    return retryOperation(async () => {
      const { data, error } = await this.client
        .from('usage')
        .select('messages')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    }, "getUserUsage", userId)
  }

  async createUserUsage(userId: string): Promise<void> {
    await retryOperation(async () => {
      const { error } = await this.client
        .from('usage')
        .insert({ user_id: userId, messages: 0 })

      if (error) throw error
    }, "createUserUsage", userId)
  }

  async incrementMessageCount(userId: string, currentCount: number): Promise<void> {
    await retryOperation(async () => {
      const { error } = await this.client
        .from('usage')
        .update({
          messages: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
    }, "incrementMessageCount", userId)
  }

  async incrementMessageAtomic(userId: string): Promise<{ messages: number }> {
    return retryOperation(async () => {
      const { data, error } = await this.client
        .rpc('increment_user_messages', { p_user_id: userId })

      if (error) throw error
      return data[0]
    }, "incrementMessageAtomic", userId)
  }
}

// 🤖 Servicio de IA
class AIService {
  private client: ReturnType<typeof createOpenAI>

  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Missing DeepSeek API key")
    }

    this.client = createOpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    })
  }

  async generateResponse(message: string, systemPrompt: string): Promise<string> {
    return retryOperation(async () => {
      const { text } = await Promise.race([
        generateText({
          model: this.client("deepseek-chat"),
          system: systemPrompt,
          prompt: message,
          temperature: 0.7,
          maxTokens: 500,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI request timeout")), CONFIG.AI_TIMEOUT)
        )
      ])

      return text.trim()
    }, "generateResponse")
  }
}

// 🎯 System prompts dinámicos
const getSystemPrompt = (userMessagesCount: number): string => {
  const basePrompt = `
    Eres STEEB, un coach motivador energético, divertido y sin toxicidad.
    Tu objetivo es ayudar al usuario a vencer la procrastinación.

    Personalidad:
    - Tono energético y humor ligero.
    - Cercano como un amigo.
    - Estilo divertido pero directo.
    - JAMÁS seas regañón o negativo.

    Instrucciones:
    - Responde de forma breve y motivadora.
    - Usa emojis si encaja con el tono.
    - Enfócate en la acción inmediata.
  `

  const contextualMessages = [
    "¡Nuevo día, nuevas oportunidades! 🔥",
    "¡Genético! ¡Podemos con esto! 💪",
    "¡Fire! ¡A darle con todo! 🚀",
    "¡Shiny! ¡Cada vez más cerca! ⭐",
    "¡STEEB mode activated! 💫",
  ]

  if (userMessagesCount === 0) {
    return `${basePrompt}\n\nEs el primer mensaje del usuario. Dale una bienvenida increíblemente motivadora.`
  } else if (userMessagesCount > 50) {
    return `${basePrompt}\n\nEl usuario ya ha conversado mucho contigo. Recuérdale su progreso y celebra su constancia.`
  } else if (userMessagesCount > 80) {
    return `${basePrompt}\n\n¡El usuario está cerca del límite! Motívalo a terminar fuerte.`
  }

  const contextualTip = contextualMessages[userMessagesCount % contextualMessages.length]
  return `${basePrompt}\n\nMensaje contextual adicional: ${contextualTip}`
}

// 📊 Response formatter
const formatResponse = (reply: string, metadata: {
  userId: string
  messageCount: number
  remainingMessages: number
  processingTime: number
  cached: boolean
}) => {
  return {
    success: true,
    data: {
      reply,
      user: {
        messageCount: metadata.messageCount,
        remainingMessages: metadata.remainingMessages,
        usagePercentage: Math.round((metadata.messageCount / CONFIG.MESSAGE_LIMIT) * 100)
      },
      performance: {
        processingTime: `${metadata.processingTime}ms`,
        cached: metadata.cached
      }
    }
  }
}

// 🛡️ Validation schemas
const validateRequest = (body: any): { message: string; userId?: string } => {
  if (!body) {
    throw new Error("Request body is required")
  }

  const { message, userId } = body

  if (!message || typeof message !== 'string') {
    throw new Error("Valid message is required")
  }

  if (!userId) {
    log("INFO", "Generating userId for anonymous user", undefined, { messageLength: message.length })
    return { message, userId: generateUserId() }
  }

  if (typeof userId !== 'string' || userId.length < 3) {
    throw new Error("Invalid userId format")
  }

  return { message: sanitizeInput(message), userId }
}

// 🎯 Main API handler
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let supabaseService: SupabaseService | null = null
  let aiService: AIService | null = null

  try {
    // 🔐 Validar configuración
    if (!process.env.DEEPSEEK_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: "Server configuration error: Missing API Keys" },
        { status: 500 }
      )
    }

    // 📝 Parsear y validar request
    const body = await req.json()
    const { message, userId } = validateRequest(body)

    log("INFO", "Processing request", userId, { messageLength: message.length })

    // 🚀 Inicializar servicios
    supabaseService = new SupabaseService()
    aiService = new AIService()

    // 💾 Verificar cache primero
    const cached = userCache.get(userId)
    let userUsage = cached?.data.messages ? { messages: cached.data.messages } : null

    if (cached && Date.now() < cached.expires) {
      log("INFO", "Using cached user data", userId, { messageCount: userUsage!.messages })
    } else {
      // 🗄️ Buscar o crear registro de usuario
      try {
        userUsage = await supabaseService.getUserUsage(userId)

        if (!userUsage) {
          await supabaseService.createUserUsage(userId)
          userUsage = { messages: 0 }
          log("INFO", "Created new user record", userId)
        }

        // 🗂️ Actualizar cache
        userCache.set(userId, {
          data: { ...userUsage, lastUpdated: new Date() },
          expires: Date.now() + CONFIG.CACHE_TTL
        })

      } catch (error) {
        log("ERROR", "Database operation failed", userId, { error: error instanceof Error ? error.message : "Unknown error" })
        return NextResponse.json(
          { success: false, error: "Database operation failed" },
          { status: 500 }
        )
      }
    }

    // 🚫 Verificar límites
    if (userUsage.messages >= CONFIG.MESSAGE_LIMIT) {
      log("INFO", "User reached message limit", userId, { messageCount: userUsage.messages })

      const limitReply = getSystemPrompt(userUsage.messages).includes("cerca del límite")
        ? "¡Wow! ¡Llegaste al máximo! Has sido increíblemente constante. Vuelve mañana para seguir rompiéndola. 💪🏆"
        : "¡Llegaste al máximo de mensajes por hoy! Vuelve mañana para seguir hablando conmigo. 💪🔥"

      return NextResponse.json(
        formatResponse(limitReply, {
          userId,
          messageCount: userUsage.messages,
          remainingMessages: 0,
          processingTime: Date.now() - startTime,
          cached: !!cached
        })
      )
    }

    // 🤖 Generar respuesta con IA
    try {
      const systemPrompt = getSystemPrompt(userUsage.messages)
      const reply = await aiService.generateResponse(message, systemPrompt)

      log("INFO", "AI response generated successfully", userId, {
        responseLength: reply.length,
        userMessages: userUsage.messages
      })

      // 📊 Actualizar contador (usando operación atómica si está disponible)
      try {
        await supabaseService.incrementMessageCount(userId, userUsage.messages)

        // 🗂️ Actualizar cache local
        const newCount = userUsage.messages + 1
        userCache.set(userId, {
          data: { messages: newCount, lastUpdated: new Date() },
          expires: Date.now() + CONFIG.CACHE_TTL
        })

        log("INFO", "Message count updated", userId, { newCount })
      } catch (updateError) {
        log("ERROR", "Failed to update message count", userId, {
          error: updateError instanceof Error ? updateError.message : "Unknown error"
        })
        // No fallamos el request si el update falla, pero lo logueamos
      }

      const processingTime = Date.now() - startTime
      const remainingMessages = CONFIG.MESSAGE_LIMIT - (userUsage.messages + 1)

      return NextResponse.json(
        formatResponse(reply, {
          userId,
          messageCount: userUsage.messages + 1,
          remainingMessages,
          processingTime,
          cached: !!cached
        })
      )

    } catch (aiError) {
      log("ERROR", "AI service failed", userId, { error: aiError instanceof Error ? aiError.message : "Unknown error" })
      return NextResponse.json(
        { success: false, error: "AI service temporarily unavailable" },
        { status: 503 }
      )
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    log("ERROR", "Request failed", undefined, { error: errorMessage })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// 🧹 Limpieza periódica del cache
const cleanupCache = () => {
  const now = Date.now()
  for (const [userId, cached] of userCache.entries()) {
    if (now > cached.expires) {
      userCache.delete(userId)
    }
  }
}

// Ejecutar limpieza cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 10 * 60 * 1000)
}