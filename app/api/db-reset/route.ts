import { NextResponse } from "next/server"
import { forceResetConnection, testConnection } from "@/lib/db-connection"

export async function POST() {
  try {
    // Reset the database connection
    forceResetConnection()

    // Test the new connection
    const isConnected = await testConnection()

    return NextResponse.json({
      success: true,
      message: "Database connection reset successfully",
      connected: isConnected,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error resetting database connection:", error)
    return NextResponse.json({
      success: false,
      message: "Failed to reset database connection",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}