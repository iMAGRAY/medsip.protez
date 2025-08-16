// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { withCache, invalidateApiCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, cacheRemember, CACHE_TTL, invalidateCache, cachePatterns } from '@/lib/cache/cache-utils'
import { guardDbOr503, tablesExist } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

function _isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export const GET = withCache(async function GET(request: NextRequest) {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_categories'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {
      return NextResponse.json(
        { success: true, data: [] },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(request.url);
    const flat = searchParams.get('flat') === 'true';
    const includeStats = searchParams.get('include_stats') === 'true';
    const nocache = searchParams.get('nocache') === 'true';

    const cacheKey = flat ? cacheKeys.categoryList() : cacheKeys.categoryTree();
    const ttl = CACHE_TTL.DAILY;

    const fetchCategories = async () => {

    const query = `
      SELECT
        id,
        name,
        description,
        parent_id,
        is_active,
        sort_order as display_order,
        created_at,
        updated_at
      FROM product_categories
      WHERE (is_deleted = false OR is_deleted IS NULL)
        AND is_active = true
      ORDER BY sort_order, name
    `;

    const result = await executeQuery(query);
    let categories = result.rows;

    if (includeStats && categories.length > 0) {
      const need = await tablesExist(['products'])
      if (need.products) {
        const categoryIds = categories.map(c => c.id);

        const statsQuery = `
          SELECT
            c.id as category_id,
            COUNT(DISTINCT p.id) as products_count,
            COUNT(DISTINCT CASE WHEN (p.is_deleted = false OR p.is_deleted IS NULL) THEN p.id END) as active_products_count
          FROM product_categories c
          LEFT JOIN products p ON c.id = p.category_id
          WHERE c.id = ANY($1)
          GROUP BY c.id
        `;

        const statsResult = await executeQuery(statsQuery, [categoryIds]);
        const statsMap = new Map();

        statsResult.rows.forEach(stat => {
          statsMap.set(stat.category_id, {
            productsCount: parseInt(stat.products_count) || 0,
            activeProductsCount: parseInt(stat.active_products_count) || 0
          });
        });

        categories.forEach(category => {
          const stats = statsMap.get(category.id) || {
            productsCount: 0,
            activeProductsCount: 0
          };
          category.stats = stats;
        });
      } else {
        categories.forEach(category => {
          category.stats = { productsCount: 0, activeProductsCount: 0 };
        })
      }
    }

    if (!flat) {
      const categoriesMap = new Map();
      categories.forEach(cat => {
        categoriesMap.set(cat.id, { ...cat, children: [] });
      });

      const rootCategories = [];
      categories.forEach(cat => {
        if (cat.parent_id) {
          const parent = categoriesMap.get(cat.parent_id);
          if (parent) {
            parent.children.push(categoriesMap.get(cat.id));
          }
        } else {
          rootCategories.push(categoriesMap.get(cat.id));
        }
      });

      categories = rootCategories;
    }

      return {
        success: true,
        data: categories
      };
    };

    if (nocache) {
      const data = await fetchCategories();
      return NextResponse.json(data);
    }

    const responseData = await cacheRemember(
      cacheKey,
      ttl,
      fetchCategories,
      'category'
    );

    return NextResponse.json(responseData);

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch categories', success: false, details: (error as any).message },
      { status: 500 }
    );
  }
})

export async function POST(request: NextRequest) {

  try {
    const data = await request.json();

    // Валидация обязательных полей
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO product_categories (
        name, description, parent_id, is_active, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5
      ) RETURNING *
    `;

    const values = [
      data.name.trim(),
      data.description?.trim() || null,
      data.parent_id || null,
      data.is_active ?? true,
      data.sort_order || 0
    ];

    const result = await executeQuery(query, values);
    const category = result.rows[0];

    // Инвалидируем кеш после создания
    await invalidateCache([
      cachePatterns.allCategories,
      'api:*categories*'
    ]);
    await invalidateApiCache(['/categories']);

    return NextResponse.json(category, { status: 201 });

  } catch (error) {
    console.error('❌ Categories API POST Error:', error);

    // Обработка дубликатов
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

// PUT /api/categories - Обновить категорию
export async function PUT(request: NextRequest) {

  try {
    const body = await request.json();
    const { id, name, description, parent_id, image_url: _image_url, sort_order } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'ID и название категории обязательны' },
        { status: 400 }
      );
    }

    const result = await executeQuery(
      `UPDATE product_categories
       SET name = $2, description = $3, parent_id = $4, sort_order = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id, name, description || null, parent_id || null, sort_order || 0]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Категория не найдена' },
        { status: 404 }
      );
    }

    // Инвалидируем кеш после обновления
    await invalidateCache([
      cachePatterns.allCategories,
      cachePatterns.category(id),
      'api:*categories*'
    ]);
    await invalidateApiCache(['/categories']);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Categories API PUT Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления категории' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories - Удалить категорию
export async function DELETE(request: NextRequest) {

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID категории обязателен' },
        { status: 400 }
      );
    }

    const categoryInfo = await executeQuery(
      'SELECT name FROM product_categories WHERE id = $1 AND is_active = true',
      [id]
    );

    if (categoryInfo.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Категория не найдена' },
        { status: 404 }
      );
    }

    // Проверяем, есть ли дочерние категории
    const childrenCheck = await executeQuery(
      'SELECT id, name FROM product_categories WHERE parent_id = $1 AND is_active = true ORDER BY name',
      [id]
    );

    const childrenCount = childrenCheck.rows.length;
    const categoryName = categoryInfo.rows[0].name;

    if (childrenCount > 0 && !force) {
      const childrenNames = childrenCheck.rows.map(row => row.name).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: `Нельзя удалить категорию "${categoryName}", так как у неё есть дочерние категории: ${childrenNames}. Сначала удалите дочерние категории или используйте каскадное удаление.`,
          hasChildren: true,
          childrenCount: childrenCount,
          childrenNames: childrenCheck.rows.map(row => row.name)
        },
        { status: 400 }
      );
    }

    // Проверяем, есть ли товары в этой категории
    const productsCheck = await executeQuery(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [id]
    );

    const productsCount = parseInt(productsCheck.rows[0].count);

    if (productsCount > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Нельзя удалить категорию "${categoryName}", так как в ней есть ${productsCount} товар(ов). Сначала переместите товары в другую категорию или используйте каскадное удаление.`,
          hasProducts: true,
          productsCount: productsCount
        },
        { status: 400 }
      );
    }

    // При каскадном удалении обрабатываем товары
    if (force && productsCount > 0) {
      // Находим категорию "Аксессуары" для перемещения товаров
      const defaultCategoryResult = await executeQuery(
        'SELECT id FROM product_categories WHERE name = $1 AND is_active = true LIMIT 1',
        ['Аксессуары']
      );

      if (defaultCategoryResult.rows.length > 0) {
        const defaultCategoryId = defaultCategoryResult.rows[0].id;

        // Перемещаем товары в категорию "Аксессуары"
        await executeQuery(
          'UPDATE products SET category_id = $1, updated_at = CURRENT_TIMESTAMP WHERE category_id = $2',
          [defaultCategoryId, id]
        );

      } else {
        // Если категория "Аксессуары" не найдена, помечаем товары как неактивные
        await executeQuery(
          'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE category_id = $1',
          [id]
        );

      }
    }

    // Мягкое удаление категории
    await executeQuery(
      'UPDATE product_categories SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    let message = `Категория "${categoryName}" успешно удалена`;
    let productsAction = 'none';

    if (force && productsCount > 0) {
      const defaultCategoryResult = await executeQuery(
        'SELECT id FROM product_categories WHERE name = $1 AND is_active = true LIMIT 1',
        ['Аксессуары']
      );

      if (defaultCategoryResult.rows.length > 0) {
        message += `. ${productsCount} товар(ов) перемещено в категорию "Аксессуары"`;
        productsAction = 'moved';
      } else {
        message += `. ${productsCount} товар(ов) помечено как неактивные`;
        productsAction = 'deactivated';
      }
    }

    // Инвалидируем кеш после удаления
    await invalidateCache([
      cachePatterns.allCategories,
      cachePatterns.category(parseInt(id)),
      'api:*categories*'
    ]);
    await invalidateApiCache(['/categories']);

    return NextResponse.json({
      success: true,
      message,
      deletedData: {
        categoryName,
        childrenCount,
        productsCount,
        cascadeDelete: force,
        productsAction
      }
    });

  } catch (error) {
    console.error('❌ Categories API DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления категории' },
      { status: 500 }
    );
  }
}