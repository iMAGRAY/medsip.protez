import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// GET - получить список складов
export async function GET() {
  try {
    
    if (!pool) {
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    const result = await pool.query(`
      SELECT id, name, code, address, city, is_active, sort_order
      FROM warehouses
      WHERE is_active = true
      ORDER BY sort_order, name
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch warehouses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - создать новый склад
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { name, code, address, city } = data

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO warehouses (name, code, address, city)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, code || null, address || null, city || null]
    )

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Warehouse with this code already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}