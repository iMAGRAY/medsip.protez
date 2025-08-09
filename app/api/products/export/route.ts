import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
// Используем динамический импорт, чтобы модуль ExcelJS не попадал в edge-бандл

export async function GET() {
  try {
    // динамический импорт
    const Excel = await import('exceljs')
    const query = `
      SELECT p.id, p.name, c.name AS category,
             COALESCE(json_agg(json_build_object('label', pc.label, 'value',
               COALESCE(pc.value_text, pc.value_numeric::text)) ORDER BY pc.id) FILTER (WHERE pc.id IS NOT NULL), '[]') AS characteristics
      FROM products p
      LEFT JOIN product_categories c ON c.id = p.category_id
      LEFT JOIN product_characteristics pc ON pc.product_id = p.id
      GROUP BY p.id, c.name
      ORDER BY p.id`
    const result = await executeQuery(query)

    const workbook = new Excel.Workbook()
    const sheet = workbook.addWorksheet('Products')

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Название', key: 'name', width: 32 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Характеристики', key: 'chars', width: 60 },
    ]

    result.rows.forEach((row: any) => {
      let charsArr: { label: string; value: string }[] = []

      // PostgreSQL may already return parsed JSON or null/empty string
      if (Array.isArray(row.characteristics)) {
        charsArr = row.characteristics
      } else if (typeof row.characteristics === 'string' && row.characteristics.trim()) {
        try {
          charsArr = JSON.parse(row.characteristics)
        } catch (err) {
          console.warn('⚠️ Failed to parse characteristics JSON for product', row.id, err)
        }
      }

      const charString = charsArr.map((c) => `${c.label}: ${c.value}`).join('; ')
      sheet.addRow({ id: row.id, name: row.name, category: row.category, chars: charString })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="products.xlsx"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'