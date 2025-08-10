import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"
import { guardDbOr503, tablesExist } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TABLES = [
  'products',
  'categories',
  'model_series',
  'manufacturers',
  'product_sizes',
  'product_images',
  'site_settings',
  'product_characteristics',
  'catalog_menu_settings',
  'spec_groups',
  'characteristic_groups',
]

const COLUMN_TITLES: Record<string, Record<string, string>> = {
  products: {
    id: 'ID',
    name: 'Название',
    category: 'Категория',
    weight: 'Вес',
    battery_life: 'Время работы',
    warranty: 'Гарантия',
    in_stock: 'В наличии',
    price: 'Цена',
    sku: 'Артикул',
    variants_count: 'Количество вариантов',
    characteristics: 'Характеристики (EAV)',
    created_at: 'Создан',
    updated_at: 'Обновлён',
    system: 'Система',
  },
  categories: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
    is_active: 'Активна',
    created_at: 'Создана',
    updated_at: 'Обновлена',
  },
  model_series: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
    category_id: 'Категория ID',
    manufacturer_id: 'Производитель ID',
    is_active: 'Активна',
    created_at: 'Создана',
    updated_at: 'Обновлена',
  },
  manufacturers: {
    id: 'ID',
    name: 'Название',
    country: 'Страна',
    created_at: 'Создан',
    updated_at: 'Обновлён',
  },
  product_sizes: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
    is_active: 'Активен',
    created_at: 'Создан',
    updated_at: 'Обновлён',
  },
  product_images: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
    is_active: 'Активен',
    created_at: 'Создан',
    updated_at: 'Обновлён',
  },
  site_settings: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
    is_active: 'Активен',
    created_at: 'Создан',
    updated_at: 'Обновлён',
  },
  product_characteristics: {
    id: 'ID',
    product_id: 'Товар ID',
    label: 'Метка',
    value_text: 'Значение (текст)',
    value_numeric: 'Значение (число)',
    created_at: 'Создано',
  },
  catalog_menu_settings: {
    id: 'ID',
    name: 'Название',
    value: 'Значение',
    updated_at: 'Обновлено',
  },
  spec_groups: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
  },
  characteristic_groups: {
    id: 'ID',
    name: 'Название',
    description: 'Описание',
  },
}

export async function GET(request: Request) {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const url = new URL(request.url)
    const tablesParam = url.searchParams.get('tables') || 'products'
    const requested = tablesParam.split(',').map((t) => t.trim()).filter(Boolean)
    const tables = requested.filter((t) => ALLOWED_TABLES.includes(t))

    if (tables.length === 0) {
      return NextResponse.json({ error: 'No valid tables requested' }, { status: 400 })
    }

    const Excel = await import('exceljs')
    const workbook = new Excel.Workbook()

    // Проверим наличие всех таблиц разом
    const existingMap = await tablesExist(tables)

    for (const table of tables) {
      if (!existingMap[table]) {
        // Пропускаем несуществующие таблицы
        continue
      }

      let rows: any[] = []
      if (table === 'products') {
        const query = `
          SELECT
            p.id,
            p.name,
            c.name AS category,
            p.weight,
            p.battery_life,
            p.warranty,
            p.in_stock,
            p.price,
            p.sku,
            COUNT(DISTINCT pv.id) as variants_count,
            STRING_AGG(
              DISTINCT CONCAT(
                COALESCE(cg.name, 'Прочее'), ': ',
                COALESCE(ct.name, 'Неизвестно'), ' = ',
                COALESCE(
                  CASE
                    WHEN ct.input_type = 'enum' THEN COALESCE(cv.display_name, cv.value)
                    WHEN ct.input_type = 'boolean' THEN CASE WHEN pc.value_text = 'true' THEN 'Да' ELSE 'Нет' END
                    WHEN ct.input_type = 'number' THEN pc.value_numeric::text
                    WHEN ct.input_type = 'date' THEN pc.value_text
                    ELSE pc.value_text
                  END,
                  'Не указано'
                ),
                CASE WHEN pv.variant_sku IS NOT NULL AND pv.variant_sku != '' THEN CONCAT(' (', pv.variant_sku, ')') ELSE '' END
              ),
              ' | '
              ORDER BY cg.ordering NULLS LAST, ct.sort_order NULLS LAST
            ) as characteristics,
            p.created_at,
            p.updated_at
          FROM products p
          LEFT JOIN product_categories c ON c.id = p.category_id
          LEFT JOIN product_variants pv ON pv.master_id = p.id AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
          LEFT JOIN product_characteristics pc ON pc.product_id = p.id
          LEFT JOIN characteristic_templates ct ON ct.id = pc.template_id
            AND (ct.is_deleted = FALSE OR ct.is_deleted IS NULL)
          LEFT JOIN characteristic_groups cg ON cg.id = ct.group_id
            AND (cg.is_deleted = FALSE OR cg.is_deleted IS NULL)
            AND cg.is_active = true
          LEFT JOIN characteristic_values cv ON cv.id = pc.value_preset_id
            AND (cv.is_active = TRUE OR cv.is_active IS NULL)
          GROUP BY p.id, c.name
          ORDER BY p.id`
        const result = await executeQuery(query)
        rows = result.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          weight: r.weight,
          battery_life: r.battery_life,
          warranty: r.warranty,
          in_stock: r.in_stock,
          price: r.price,
          sku: r.sku,
          variants_count: r.variants_count,
          characteristics: r.characteristics || 'Нет характеристик',
          created_at: r.created_at,
          updated_at: r.updated_at,
          system: 'eav_unified'
        }))
      } else {
        // generic select * for other tables (уже whitelisted, существование проверено)
        const result = await executeQuery(`SELECT * FROM ${table} ORDER BY 1 LIMIT 1000`)
        rows = result.rows
      }

      const sheet = workbook.addWorksheet(table)
      if (rows.length === 0) continue

      const headers = Object.keys(rows[0])
      sheet.columns = headers.map((h) => ({ header: COLUMN_TITLES[table]?.[h] || h, key: h }))
      rows.forEach((row) => { sheet.addRow(row) })

      const sheetColumns = (sheet.columns || []) as any[]
      sheetColumns.forEach((col) => {
        let maxLength = col.header ? String(col.header).length : 10
        col.eachCell?.({ includeEmpty: false }, (cell: any) => {
          const len = cell && cell.value ? String(cell.value).length : 0
          if (len > maxLength) maxLength = len
        })
        col.width = Math.min(Math.max(maxLength + 2, 12), 50)
      })

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
      })

      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export.xlsx"',
      },
    })
  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}