import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-connection"

export async function GET() {

  const startTime = Date.now()

  try {

    // Проверим доступность ключевых таблиц, чтобы избежать 500 из-за отсутствия
    const tables = [
      'catalog_menu_settings',
      'product_categories',
      'characteristics_groups_simple',
      'manufacturers',
      'model_series'
    ]
    const checks = await Promise.all(tables.map(t => executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema='public' AND table_name=$1
      ) AS exist
    `, [t])))
    const existsMap: Record<string, boolean> = {}
    tables.forEach((t, i) => { existsMap[t] = !!checks[i].rows?.[0]?.exist })

    // Если нет базовых таблиц меню — возвращаем 503 с сообщением
    if (!existsMap.catalog_menu_settings) {
      return NextResponse.json({ success: false, error: 'catalog_menu_settings not initialized' }, { status: 503 })
    }

    // Сначала пробуем получить из настроек меню
    let result;
    try {
      const optimizedQuery = `
        SELECT
          cms.id,
          cms.entity_type,
          cms.entity_id,
          cms.name,
          cms.description,
          cms.sort_order,
          cms.is_visible,
          cms.is_expanded,
          cms.show_in_main_menu,
          cms.parent_id,
          cms.icon,
          cms.css_class,
          cms.custom_url,
          cms.created_at,
          cms.updated_at,
          CASE
            WHEN cms.entity_type = 'category' THEN
              COALESCE((SELECT COUNT(*) FROM product_categories WHERE parent_id = cms.entity_id::integer AND is_active = true), 0)
            WHEN cms.entity_type = 'spec_group' THEN
              COALESCE((SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = cms.entity_id::integer AND is_active = true), 0)
            WHEN cms.entity_type = 'manufacturer' THEN
              COALESCE((SELECT COUNT(*) FROM model_series WHERE manufacturer_id = cms.entity_id::integer), 0)
            WHEN cms.entity_type = 'manufacturers_category' THEN
              COALESCE((SELECT COUNT(*) FROM manufacturers), 0)
            ELSE 0
          END as children_count
        FROM catalog_menu_settings cms
        WHERE cms.is_visible = true
        ORDER BY cms.sort_order, cms.name
      `;

      result = await executeQuery(optimizedQuery);

    } catch (error) {
      result = { rows: [] } as any
    }

    if (result.rows.length === 0) {
      // Fallback: формируем меню из существующих сущностей
      const fallbackQuery = `
        SELECT
          'fallback_' || type_order as id,
          entity_type,
          entity_id,
          name,
          description,
          sort_order,
          is_visible,
          is_expanded,
          show_in_main_menu,
          parent_id,
          icon,
          css_class,
          custom_url,
          created_at,
          updated_at,
          children_count
        FROM (
          SELECT
            1 as type_order,
            'spec_group' as entity_type,
            cg.id::text as entity_id,
            cg.name,
            cg.description,
            0 as sort_order,
            true as is_visible,
            false as is_expanded,
            true as show_in_main_menu,
            null as parent_id,
            'layers' as icon,
            null as css_class,
            null as custom_url,
            cg.created_at,
            cg.updated_at,
            COALESCE((SELECT COUNT(*) FROM characteristics_groups_simple WHERE parent_id = cg.id AND is_active = true), 0) as children_count
          FROM ${existsMap.characteristics_groups_simple ? 'characteristics_groups_simple' : '(SELECT NULL::int id, NULL::text name, NULL::text description, NULL::int parent_id, NULL::timestamp created_at, NULL::timestamp updated_at LIMIT 0)'} cg
          WHERE ${existsMap.characteristics_groups_simple ? 'cg.is_active = true AND cg.parent_id IS NULL' : '1=0'}

          UNION ALL

          SELECT
            2 as type_order,
            'category' as entity_type,
            c.id::text as entity_id,
            c.name,
            c.description,
            100 as sort_order,
            true as is_visible,
            false as is_expanded,
            true as show_in_main_menu,
            null as parent_id,
            'folder' as icon,
            null as css_class,
            null as custom_url,
            c.created_at,
            c.updated_at,
            COALESCE((SELECT COUNT(*) FROM product_categories WHERE parent_id = c.id AND is_active = true), 0) as children_count
          FROM ${existsMap.product_categories ? 'product_categories' : '(SELECT NULL::int id, NULL::text name, NULL::text description, NULL::int parent_id, NULL::timestamp created_at, NULL::timestamp updated_at LIMIT 0)'} c
          WHERE ${existsMap.product_categories ? 'c.is_active = true AND c.parent_id IS NULL' : '1=0'}

          UNION ALL

          SELECT
            3 as type_order,
            'manufacturer' as entity_type,
            m.id::text as entity_id,
            m.name,
            m.description,
            200 as sort_order,
            true as is_visible,
            false as is_expanded,
            true as show_in_main_menu,
            null as parent_id,
            'building' as icon,
            null as css_class,
            null as custom_url,
            m.created_at,
            m.updated_at,
            COALESCE((SELECT COUNT(*) FROM model_series WHERE manufacturer_id = m.id), 0) as children_count
          FROM ${existsMap.manufacturers ? 'manufacturers' : '(SELECT NULL::int id, NULL::text name, NULL::text description, NULL::timestamp created_at, NULL::timestamp updated_at LIMIT 0)'} m
        ) combined
        ORDER BY sort_order, name
      `;

      const fallbackResult = await executeQuery(fallbackQuery)
      const fallbackHierarchy = buildHierarchy(fallbackResult.rows.map(row => ({
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        name: row.name,
        description: row.description,
        parent_id: null,
        children_count: (row.children_count || 0).toString(),
        is_visible: true,
        is_expanded: false,
        show_in_main_menu: true,
        sort_order: row.sort_order,
        icon: row.icon
      })))

      const responseTime = Date.now() - startTime
      return NextResponse.json({
        success: true,
        data: fallbackHierarchy,
        flat: fallbackResult.rows,
        total: fallbackResult.rows.length,
        source: 'optimized_fallback',
        performance: { response_time_ms: responseTime, optimized: true }
      })
    }

    const menuItems = result.rows.map(row => ({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      name: row.name,
      description: row.description,
      parent_id: row.parent_id,
      sort_order: row.sort_order,
      is_visible: row.is_visible,
      is_expanded: row.is_expanded,
      show_in_main_menu: row.show_in_main_menu,
      icon: row.icon,
      css_class: row.css_class,
      custom_url: row.custom_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      children_count: (row.children_count || 0).toString(),
      ...(row.entity_type === 'spec_group' && { characteristics_count: row.children_count || 0, original_name: row.name, original_description: row.description }),
      ...(row.entity_type === 'category' && { subcategories_count: row.children_count || 0, original_name: row.name, original_description: row.description }),
      ...(row.entity_type === 'manufacturer' && { model_series_count: row.children_count || 0, original_name: row.name, original_description: row.description })
    }))

    const hierarchy = buildHierarchy(menuItems)

    const responseTime = Date.now() - startTime
    return NextResponse.json({
      success: true,
      data: hierarchy,
      flat: menuItems,
      total: menuItems.length,
      source: 'optimized_database',
      performance: { response_time_ms: responseTime, optimized: true, items_processed: menuItems.length }
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error("❌ Catalog Menu API error:", error)
    return NextResponse.json({ success: false, error: "Failed to load catalog menu", performance: { response_time_ms: responseTime, error: true } }, { status: 500 })
  }
}

// POST - Создать новый элемент меню
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { entity_type, entity_id, name, description, parent_id, sort_order, is_visible, is_expanded, show_in_main_menu, icon, css_class, custom_url } = body

    if (!entity_type || !name) {
      return NextResponse.json(
        { success: false, error: 'entity_type и name обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что entity_type допустимый
    const allowedTypes = ['spec_group', 'category', 'manufacturer', 'model_line', 'manufacturers_category']
    if (!allowedTypes.includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: `entity_type должен быть одним из: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Для обычных типов требуется entity_id, для manufacturers_category - нет
    if (entity_type !== 'manufacturers_category' && !entity_id) {
      return NextResponse.json(
        { success: false, error: 'entity_id обязателен для этого типа сущности' },
        { status: 400 }
      )
    }

    // Для manufacturers_category используем специальное значение entity_id
    const finalEntityId = entity_type === 'manufacturers_category' ? 0 : entity_id

    const query = `
      INSERT INTO catalog_menu_settings (
        entity_type, entity_id, name, description, parent_id, sort_order,
        is_visible, is_expanded, show_in_main_menu, icon, css_class, custom_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `

    const result = await executeQuery(query, [
      entity_type, finalEntityId, name, description, parent_id || null, sort_order || 0,
      is_visible !== false, is_expanded === true, show_in_main_menu !== false,
      icon || (entity_type === 'manufacturers_category' ? 'building' : null),
      css_class || null, custom_url || null
    ])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error("Error creating menu item:", error)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // unique violation
      return NextResponse.json(
        { success: false, error: 'Элемент меню для этой сущности уже существует' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Ошибка создания элемента меню' },
      { status: 500 }
    )
  }
}

// PUT - Обновить элемент меню
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID элемента меню обязателен' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, description, parent_id, sort_order, is_visible, is_expanded, show_in_main_menu, icon, css_class, custom_url } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Название обязательно' },
        { status: 400 }
      )
    }

    const query = `
      UPDATE catalog_menu_settings
      SET name = $1, description = $2, parent_id = $3, sort_order = $4,
          is_visible = $5, is_expanded = $6, show_in_main_menu = $7,
          icon = $8, css_class = $9, custom_url = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `

    const result = await executeQuery(query, [
      name, description || null, parent_id || null, sort_order || 0,
      is_visible !== false, is_expanded === true, show_in_main_menu !== false,
      icon || null, css_class || null, custom_url || null, parseInt(id)
    ])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Элемент меню не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error("Error updating menu item:", error)
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления элемента меню' },
      { status: 500 }
    )
  }
}

// DELETE - Удалить элемент меню
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID элемента меню обязателен' },
        { status: 400 }
      )
    }

    const query = 'DELETE FROM catalog_menu_settings WHERE id = $1 RETURNING *'
    const result = await executeQuery(query, [parseInt(id)])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Элемент меню не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Элемент меню удален',
      data: result.rows[0]
    })

  } catch (error) {
    console.error("Error deleting menu item:", error)
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления элемента меню' },
      { status: 500 }
    )
  }
}

// Функция для построения иерархии
function buildHierarchy(items: any[], parentId: number | null = null): any[] {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      ...item,
      children: buildHierarchy(items, item.id)
    }))
    .sort((a, b) => {
      // Сортируем сначала по sort_order, затем по имени
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.name.localeCompare(b.name)
    })
}

// Функция для автоматического добавления всех производителей в категорию "Производители"
// ОТКЛЮЧЕНА: теперь используется динамическая загрузка через API catalog-subgroups
async function expandManufacturersCategories(menuItems: any[]): Promise<any[]> {
  // Просто возвращаем исходные элементы без статического добавления детей
  // Дочерние элементы будут загружаться динамически через API catalog-subgroups

  return menuItems
}