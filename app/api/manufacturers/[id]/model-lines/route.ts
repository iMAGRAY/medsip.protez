import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await pool.connect();

    // Сначала получаем информацию о производителе
    const manufacturerResult = await client.query(
      'SELECT * FROM manufacturers WHERE id = $1',
      [params.id]
    );

    if (manufacturerResult.rows.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'Производитель не найден' },
        { status: 404 }
      );
    }

    // Получаем модельные ряды производителя
    const modelLinesResult = await client.query(`
      SELECT
        ml.*,
        m.name as manufacturer_name,
        COUNT(p.id) as products_count
      FROM model_series ml
      LEFT JOIN manufacturers m ON ml.manufacturer_id = m.id
      LEFT JOIN products p ON ml.id = p.series_id
      WHERE ml.manufacturer_id = $1
      GROUP BY ml.id, m.name
      ORDER BY ml.name
    `, [params.id]);

    client.release();

    return NextResponse.json({
      success: true,
      data: {
        manufacturer: manufacturerResult.rows[0],
        modelLines: modelLinesResult.rows
      }
    });
  } catch (error) {
    console.error('Ошибка получения модельных рядов производителя:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения данных' },
      { status: 500 }
    );
  }
}