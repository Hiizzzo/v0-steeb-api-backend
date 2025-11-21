import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("🏥 HEALTH: Comprehensive health check requested")

    // Check environment variables
    const envVars = {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? "✅ Set" : "❌ Missing",
      SUPABASE_URL: process.env.SUPABASE_URL ? "✅ Set" : "❌ Missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
      MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN ? process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + "..." : "❌ Missing",
      VITE_MERCADOPAGO_PUBLIC_KEY: process.env.VITE_MERCADOPAGO_PUBLIC_KEY ? "✅ Set" : "❌ Missing",
      APP_BASE_URL: process.env.APP_BASE_URL || process.env.BASE_URL || "❌ Not configured",
      MP_NOTIFICATION_URL: process.env.MP_NOTIFICATION_URL || "❌ Not configured",
      MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ? "✅ Set" : "❌ Not configured",
      PORT: process.env.PORT || "3001 (default)"
    }

    console.log("🔧 HEALTH: Environment variables:", envVars)

    // Check payment plans configuration
    let paymentPlansStatus = "❌ Not accessible"
    let paymentPlans = []
    try {
      // Try to read payment plans from file (for Express server)
      const fs = require('fs')
      const path = require('path')
      const paymentPlansPath = path.join(process.cwd(), 'config', 'paymentPlans.json')

      if (fs.existsSync(paymentPlansPath)) {
        const planBuffer = fs.readFileSync(paymentPlansPath, 'utf-8')
        paymentPlans = JSON.parse(planBuffer)
        paymentPlansStatus = "✅ Available"
      } else {
        paymentPlansStatus = "❌ File not found"
      }
    } catch (error) {
      console.log("🔧 HEALTH: Could not read payment plans file:", error.message)
      paymentPlansStatus = "❌ Error reading file"
    }

    // Check Mercado Pago connectivity (basic test)
    let mercadoPagoStatus = "❌ Not configured"
    if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        // Basic token format validation
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN
        if (token.startsWith('APP_USR-') && token.length > 50) {
          mercadoPagoStatus = "✅ Token format appears valid"
        } else {
          mercadoPagoStatus = "⚠️ Token format may be invalid"
        }
      } catch (error) {
        mercadoPagoStatus = "❌ Error validating token"
      }
    }

    return NextResponse.json({
      status: "✅ OK",
      timestamp: new Date().toISOString(),
      environment: envVars,
      paymentPlans: {
        status: paymentPlansStatus,
        count: paymentPlans.length,
        availablePlans: paymentPlans.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          currency: p.currency
        }))
      },
      mercadoPago: {
        status: mercadoPagoStatus
      },
      endpoints: {
        health: "✅ Working",
        verify: "/api/payments/verify",
        createPreference: "/api/payments/create-preference",
        webhook: "/api/payments/webhook"
      },
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