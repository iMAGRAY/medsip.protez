import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export async function GET() {
  try {
    const Excel = await import('exceljs')

    const query = `
      SELECT p.id, p.name, c.name AS category
      FROM products p
      LEFT JOIN product_categories c ON c.id = p.category_id
      ORDER BY p.id
    `
    const productsRes = await executeQuery(query)

    const charsRes = await executeQuery(`
      SELECT
        pc.product_id,
        cv.value as label,
        COALESCE(pc.additional_value, cv.value) as value
      FROM product_characteristics_simple pc
      JOIN characteristics_values_simple cv ON cv.id = pc.value_id
      ORDER BY pc.product_id, cv.sort_order
    `)

    const charsByProduct = charsRes.rows.reduce((acc: any, r: any) => {
      if (!acc[r.product_id]) acc[r.product_id] = []
      acc[r.product_id].push({ label: r.label, value: r.value })
      return acc
    }, {})

    const workbook = new Excel.Workbook()
    const sheet = workbook.addWorksheet('Products')

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Название', key: 'name', width: 32 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Характеристики', key: 'chars', width: 60 },
    ]

    productsRes.rows.forEach((p: any) => {
      const charsArr = charsByProduct[p.id] || []
      const charString = charsArr.map((c: any) => `${c.label}: ${c.value}`).join('; ')
      sheet.addRow({ id: p.id, name: p.name, category: p.category, chars: charString })
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