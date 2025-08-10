import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {

    const client = await pool.connect();

    try {
      // Сначала получаем информацию о модельном ряду

      const modelLineQuery = `
        SELECT
          ml.*,
          m.name as manufacturer_name
        FROM model_series ml
        LEFT JOIN manufacturers m ON ml.manufacturer_id = m.id
        WHERE ml.id = $1
      `;

      const modelLineResult = await client.query(modelLineQuery, [params.id]);

      if (modelLineResult.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: 'Модельный ряд не найден' },
          { status: 404 }
        );
      }

      // Получаем продукты модельного ряда

      const productsQuery = `
        SELECT
          p.*,
          ml.name as model_line_name,
          m.name as manufacturer_name
        FROM products p
        LEFT JOIN model_series ml ON p.series_id = ml.id
        LEFT JOIN manufacturers m ON ml.manufacturer_id = m.id
        WHERE p.series_id = $1
        ORDER BY p.name
      `;

      const productsResult = await client.query(productsQuery, [params.id]);

      client.release();

      return NextResponse.json({
        success: true,
        data: {
          modelLine: modelLineResult.rows[0],
          products: productsResult.rows
        }
      });
    } catch (innerError) {
      console.error('Inner SQL error:', innerError);
      console.error('Error details:', {
        message: innerError.message,
        code: innerError.code,
        detail: innerError.detail,
        hint: innerError.hint,
        position: innerError.position
      });
      client.release();
      return NextResponse.json(
        { success: false, error: `Ошибка SQL: ${innerError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Ошибка получения продуктов модельного ряда:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { success: false, error: `Ошибка получения данных: ${error.message}` },
      { status: 500 }
    );
  }
}