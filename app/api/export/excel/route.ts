import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
import { guardDbOr503, tablesExist } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const need = await tablesExist(['products','product_categories','product_characteristics_simple','characteristics_values_simple'])

    const Excel = await import('exceljs')

    const productsRes = await executeQuery(`
      SELECT p.id, p.name, c.name AS category
      FROM products p
      LEFT JOIN product_categories c ON c.id = p.category_id
      ORDER BY p.id
    `)

    let charsByProduct: Record<number, any[]> = {}
    if (need.product_characteristics_simple && need.characteristics_values_simple) {
      const charsRes = await executeQuery(`
        SELECT
          pc.product_id,
          cv.value as label,
          COALESCE(pc.additional_value, cv.value) as value
        FROM product_characteristics_simple pc
        JOIN characteristics_values_simple cv ON cv.id = pc.value_id
        ORDER BY pc.product_id, cv.sort_order
      `)

      charsByProduct = charsRes.rows.reduce((acc: any, r: any) => {
        if (!acc[r.product_id]) acc[r.product_id] = []
        acc[r.product_id].push({ label: r.label, value: r.value })
        return acc
      }, {})
    }

    const workbook = new (await Excel).Workbook()
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
        'Content-Disposition': 'attachment; filename="export.xlsx"',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}