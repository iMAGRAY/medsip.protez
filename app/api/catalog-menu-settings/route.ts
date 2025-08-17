import { NextRequest, NextResponse } from 'next/server'

// Временная заглушка для catalog-menu-settings API
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    settings: []
  })
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Settings updated'
  })
}