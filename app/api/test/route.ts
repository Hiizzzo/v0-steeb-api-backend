import { NextRequest, NextResponse } from "next/server"
import { DeepSeekService } from "../../../lib/deepseekService"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

function jsonWithCors(body: any, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers)
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value)
  })
  return NextResponse.json(body, { ...init, headers })
}

export async function OPTIONS() {
  return jsonWithCors({}, { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    console.log("🧪 TEST ENDPOINT: Starting DeepSeek service test")

    // Test 1: Initialize service
    const deepseekService = new DeepSeekService()

    // Test 2: Health check
    const isHealthy = await deepseekService.healthCheck()

    if (isHealthy) {
      console.log("✅ TEST ENDPOINT: DeepSeek service is healthy")
      return jsonWithCors({
        success: true,
        message: "DeepSeek API is working correctly",
        healthy: true
      })
    } else {
      console.log("❌ TEST ENDPOINT: DeepSeek service failed health check")
      return jsonWithCors({
        success: false,
        message: "DeepSeek API health check failed",
        healthy: false
      }, { status: 503 })
    }

  } catch (error) {
    console.error("🧪 TEST ENDPOINT: Error during test", error)
    return jsonWithCors({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}