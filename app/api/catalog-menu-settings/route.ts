import { NextRequest, NextResponse } from 'next/server'

// Временная заглушка для catalog-menu-settings API
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    settings: []
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Settings updated'
  })
}