// 🤖 Servicio DeepSeek - API nativa v1/chat/completions
interface DeepSeekMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface DeepSeekRequest {
  model: string
  messages: DeepSeekMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface DeepSeekResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface DeepSeekErrorResponse {
  error: {
    message: string
    type: string
    code: string
  }
}

class DeepSeekService {
  private apiKey: string
  private baseURL: string = "https://api.deepseek.com"

  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Missing DEEPSEEK_API_KEY environment variable")
    }

    this.apiKey = process.env.DEEPSEEK_API_KEY
    this.baseURL = "https://api.deepseek.com"

    this.log("INFO", "DeepSeekService initialized", {
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0
    })
  }

  private log(level: "INFO" | "WARN" | "ERROR", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` ${JSON.stringify(data)}` : ""
    console.log(`[${timestamp}] DEEPSEEK ${level}: ${message}${dataStr}`)
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        const isLastAttempt = attempt === retries
        const delay = baseDelay * Math.pow(2, attempt - 1)

        this.log(
          isLastAttempt ? "ERROR" : "WARN",
          `Attempt ${attempt}/${retries} failed for ${operationName}`,
          {
            error: error instanceof Error ? error.message : "Unknown error",
            delay,
            attempt,
            retries
          }
        )

        if (isLastAttempt) throw error

        await this.sleep(delay)
      }
    }

    throw new Error(`All ${retries} attempts failed for ${operationName}`)
  }

  async generateResponse(
    userMessage: string,
    systemPrompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
      timeout?: number
    }
  ): Promise<string> {
    const {
      temperature = 0.7,
      maxTokens = 150, // REDUCIDO de 500 a 150 para velocidad
      timeout = 10000  // REDUCIDO de 30000 a 10000 para velocidad
    } = options || {}

    this.log("INFO", "Starting DeepSeek API request", {
      model: "deepseek-chat",
      temperature,
      maxTokens,
      messageLength: userMessage.length,
      baseURL: this.baseURL,
      endpoint: `${this.baseURL}/v1/chat/completions`
    })

    return this.retryOperation(async () => {
      const requestBody: DeepSeekRequest = {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const url = `${this.baseURL}/v1/chat/completions`
        this.log("INFO", "Making fetch request to DeepSeek API", {
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey.substring(0, 10)}...`
          },
          requestBodySize: JSON.stringify(requestBody).length
        })

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        })

        this.log("INFO", "DeepSeek API response received", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.text()
          this.log("ERROR", "DeepSeek API request failed", {
            status: response.status,
            statusText: response.statusText,
            errorData
          })

          if (response.status === 401) {
            throw new Error("DeepSeek API authentication failed - check API key")
          } else if (response.status === 404) {
            throw new Error("DeepSeek API endpoint not found - check model name")
          } else if (response.status === 429) {
            throw new Error("DeepSeek API rate limit exceeded")
          } else {
            throw new Error(`DeepSeek API error: ${response.status} - ${errorData}`)
          }
        }

        const data: DeepSeekResponse = await response.json()

        if (!data.choices || data.choices.length === 0) {
          throw new Error("No choices returned from DeepSeek API")
        }

        const choice = data.choices[0]

        if (!choice.message || !choice.message.content) {
          throw new Error("Invalid response format from DeepSeek API")
        }

        const content = choice.message.content.trim()

        this.log("INFO", "DeepSeek API request successful", {
          responseLength: content.length,
          tokensUsed: data.usage?.total_tokens || 0,
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          finishReason: choice.finish_reason
        })

        return content

      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error("DeepSeek API request timeout")
        }

        throw error
      }

    }, "DeepSeek generateResponse", 1, 500) // REDUCIDO para velocidad: 1 retry, 500ms delay
  }

  // Método para saludcheck del servicio
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateResponse(
        "Hello",
        "Respond with just 'OK'",
        { maxTokens: 10, timeout: 5000 }
      )
      return response.toLowerCase().includes("ok")
    } catch (error) {
      this.log("ERROR", "DeepSeek health check failed", { error: error instanceof Error ? error.message : "Unknown error" })
      return false
    }
  }
}

export { DeepSeekService, DeepSeekMessage, DeepSeekRequest, DeepSeekResponse, DeepSeekErrorResponse }