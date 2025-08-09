import { NextResponse } from "next/server"
import { executeQuery, testConnection, forceResetConnection, isDatabaseAvailable } from "@/lib/db-connection"

export async function GET() {
  try {

    // Force reset connection first

    forceResetConnection()

    // Check availability
    const isAvailable = isDatabaseAvailable()

    // Test connection

    const canConnect = await testConnection()

    // Try a simple query

    const result = await executeQuery("SELECT COUNT(*) as count FROM products")
    const productCount = result.rows[0].count

    return NextResponse.json({
      success: true,
      available: isAvailable,
      canConnect: canConnect,
      productCount: productCount,
      message: "Database test successful",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("❌ Test DB API: Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}