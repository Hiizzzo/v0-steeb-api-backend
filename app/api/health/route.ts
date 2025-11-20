import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("🏥 HEALTH: Simple health check requested")

    // Check environment variables
    const envVars = {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? "✅ Set" : "❌ Missing",
      SUPABASE_URL: process.env.SUPABASE_URL ? "✅ Set" : "❌ Missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
    }

    console.log("🔧 HEALTH: Environment variables:", envVars)

    return NextResponse.json({
      status: "✅ OK",
      timestamp: new Date().toISOString(),
      environment: envVars,
      message: "Backend is running"
    })

  } catch (error) {
    console.error("❌ HEALTH: Error in health check:", error)
    return NextResponse.json({
      status: "❌ Error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  return GET() // Same logic for POST
}