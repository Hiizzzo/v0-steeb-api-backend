import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"

// Configurar el cliente de DeepSeek
// Usamos el proveedor de OpenAI pero apuntando a la URL de DeepSeek
const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

export async function POST(req: Request) {
  try {
    // Verificar que la API Key exista
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json({ error: "Server configuration error: Missing API Key" }, { status: 500 })
    }

    // Parsear el body
    const { message } = await req.json()

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 })
    }

    // Definir el system prompt de STEEB
    const systemPrompt = `
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

    // Llamar a DeepSeek
    const { text } = await generateText({
      // Opciones comunes:
      // - 'deepseek-chat' (V3): Rápido, bueno para chat general (ACTUAL)
      // - 'deepseek-reasoner' (R1): Mejor para lógica compleja y razonamiento
      model: deepseek("deepseek-chat"), // Modelo barato y estable
      system: systemPrompt,
      prompt: message,
      temperature: 0.7, // Creatividad balanceada
      maxTokens: 500, // Límite razonable para respuestas cortas
    })

    // Devolver solo la respuesta generada
    return Response.json({ reply: text })
  } catch (error) {
    console.error("Error in STEEB API:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
