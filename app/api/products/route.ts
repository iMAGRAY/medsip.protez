import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { requireAuth, hasPermission } from '@/lib/database-auth'
import { logger } from '@/lib/logger'
import { withCache, invalidateApiCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, cacheRemember, CACHE_TTL, invalidateCache, cachePatterns } from '@/lib/cache/cache-utils'
import { guardDbOr503, tablesExist, okEmpty } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withCache(async function GET(request: NextRequest) {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const { searchParams } = new URL(request.url);
    const fast = searchParams.get('fast') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const _detailed = searchParams.get('detailed') === 'true';
    const nocache = searchParams.get('nocache') === 'true';

    // Если нет нужных таблиц — возвращаем пустой успешный ответ, не 500
    const needed = await tablesExist(['products'])
    if (!needed.products) {
      return okEmpty('data', { success: true, count: 0 })
    }

    // Генерируем ключ кеша
    const cacheParams = { fast, limit, detailed: _detailed };
    const cacheKey = cacheKeys.productList(cacheParams);

    // Определяем TTL в зависимости от типа запроса
    const ttl = fast ? CACHE_TTL.SHORT : CACHE_TTL.MEDIUM;

    // Используем cacheRemember для автоматического кеширования
    const fetchProducts = async () => {
      let query;
      let queryParams: any[] = [];

    if (fast) {
      // Быстрый запрос без JOIN'ов
      query = `
        SELECT
          p.id, p.name, p.short_name, p.description, p.sku, p.article_number, p.price, p.discount_price,
          p.image_url, p.in_stock, p.stock_quantity, p.stock_status, p.show_price,
          p.category_id, p.manufacturer_id, p.series_id,
          p.created_at, p.updated_at,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM product_variants pv 
              WHERE pv.master_id = p.id AND pv.is_active = true AND pv.is_deleted = false
              AND (pv.name IS NULL OR pv.name NOT ILIKE '%standard%')
            ) THEN true
            ELSE false
          END as has_variants,
          (
            SELECT COUNT(*) 
            FROM product_variants pv 
            WHERE pv.master_id = p.id AND pv.is_active = true AND pv.is_deleted = false
            AND (pv.name IS NULL OR pv.name NOT ILIKE '%standard%')
          )::int as variants_count,
          (
            SELECT json_agg(
              json_build_object(
                'id', ps.id,
                'price', ps.price,
                'discountPrice', ps.discount_price,
                'isAvailable', ps.is_available
              ) ORDER BY ps.sort_order, ps.size_name
            )
            FROM product_sizes ps
            WHERE ps.product_id = p.id
          ) as variants
        FROM products p
        WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
        ORDER BY p.created_at DESC
      `;
    } else {
      // Полный запрос с JOIN'ами включая характеристики из простой системы
      // Если нет таблиц характеристик — падать не должны. Проверим отдельно.
      const charTables = await tablesExist(['product_characteristics_simple','characteristics_values_simple','characteristics_groups_simple'])

      const joinSimple = charTables.product_characteristics_simple && charTables.characteristics_values_simple && charTables.characteristics_groups_simple

      query = `
        SELECT
          p.*,
          ms.name as model_line_name,
          m.name as manufacturer_name,
          pc.name as category_name,
          ${joinSimple ? `COALESCE(
            JSON_AGG(
              CASE WHEN prch.id IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                  'spec_name', cg.name,
                  'spec_value', cv.value,
                  'group_name', cg.name,
                  'group_id', cg.id,
                  'spec_type', 'simple'
                )
              END
            ) FILTER (WHERE prch.id IS NOT NULL),
            '[]'::json
          ) as specifications,` : `('[]'::json) as specifications,`}
          (
            SELECT json_agg(
              json_build_object(
                'id', ps.id,
                'price', ps.price,
                'discountPrice', ps.discount_price,
                'isAvailable', ps.is_available
              ) ORDER BY ps.sort_order, ps.size_name
            )
            FROM product_sizes ps
            WHERE ps.product_id = p.id
          ) as variants
        FROM products p
        LEFT JOIN model_series ms ON p.series_id = ms.id
        LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        ${joinSimple ? `LEFT JOIN product_characteristics_simple prch ON p.id = prch.product_id
        LEFT JOIN characteristics_values_simple cv ON prch.value_id = cv.id AND cv.is_active = true
        LEFT JOIN characteristics_groups_simple cg ON cv.group_id = cg.id AND cg.is_active = true` : ''}
        WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
        ${joinSimple ? `GROUP BY p.id, ms.name, m.name, pc.name` : ''}
        ORDER BY p.created_at DESC
      `;
    }

    if (limit) {
      query += ` LIMIT $1`;
      queryParams.push(limit);
    }

      const result = await executeQuery(query, queryParams);

      const responseData = {
        success: true,
        count: result.rows.length,
        data: result.rows
      };

      logger.info('Products loaded successfully', {
        count: result.rows.length,
        fast,
        detailed: _detailed
      });

      return responseData;
    };

    // Если nocache=true, не используем кеш
    if (nocache) {
      const data = await fetchProducts();
      return NextResponse.json(data);
    }

    // Получаем данные из кеша или выполняем запрос
    const responseData = await cacheRemember(
      cacheKey,
      ttl,
      fetchProducts,
      'product'
    );

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('Failed to fetch products:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: (error as any).message,
        stack: process.env.NODE_ENV === 'development' ? (error as any).stack : undefined
      },
      { status: 500 }
    );
  }
})

export async function POST(request: NextRequest) {
  let requestData: any;

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.create') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    requestData = await request.json();
    logger.info('Product POST request', { name: requestData.name });

    const query = `
      INSERT INTO products (
        name, short_name, description, sku, article_number, price, discount_price,
        image_url, images, series_id, manufacturer_id, category_id,
        in_stock, stock_quantity, stock_status, weight, battery_life, warranty,
        show_price, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `;

    // Валидация и преобразование числовых полей
    const validateAndParseNumber = (value: any, fieldName: string, maxValue: number) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new Error(`Поле "${fieldName}" должно быть числом`);
      }
      if (parsed < 0) {
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        const formattedMax = maxValue.toLocaleString('ru-RU');
        throw new Error(`Поле "${fieldName}" не может превышать ${formattedMax}`);
      }
      return parsed;
    };

    const validateAndParseInteger = (value: any, fieldName: string, maxValue: number = 2147483647) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseInt(value);
      if (isNaN(parsed)) {
        throw new Error(`Поле "${fieldName}" должно быть целым числом`);
      }
      if (parsed < 0) {
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        const formattedMax = maxValue.toLocaleString('ru-RU');
        throw new Error(`Поле "${fieldName}" не может превышать ${formattedMax}`);
      }
      return parsed;
    };

    const values = [
      requestData.name,
      requestData.short_name || requestData.name, // Если short_name не указан, используем name
      requestData.description || null,
      requestData.sku || null,
      requestData.article_number || null,
      validateAndParseNumber(requestData.price, 'цена', 99999999.99),
      validateAndParseNumber(requestData.discount_price, 'цена со скидкой', 99999999.99),
      requestData.image_url || null,
      JSON.stringify(requestData.images || []),
      validateAndParseInteger(requestData.series_id || requestData.model_line_id, 'линейка модели'),
      validateAndParseInteger(requestData.manufacturer_id, 'производитель'),
      validateAndParseInteger(requestData.category_id, 'категория'),
      requestData.in_stock ?? true,
      validateAndParseInteger(requestData.stock_quantity, 'количество на складе') || 0,
      requestData.stock_status || 'in_stock',
      requestData.weight || null,
      requestData.battery_life || null,
      requestData.warranty || null,
      requestData.show_price ?? true,
      validateAndParseInteger(requestData.created_by, 'создатель')
    ];

    const result = await executeQuery(query, values);
    const product = result.rows[0];

    // Инвалидируем кэш после создания товара
    try {
      logger.info('Invalidating product cache after creation', { productId: product.id })

      // Инвалидируем кеш продуктов
      await invalidateCache([
        cachePatterns.allProducts,
        cachePatterns.product(product.id),
        'api:*products*',
        'api:*search*'
      ])

      // Инвалидируем API кеш
      await invalidateApiCache(['/products', '/search'])

      logger.info('Cache invalidated successfully after creation', { productId: product.id })
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache after product creation', {
        productId: product.id,
        error: cacheError.message
      })
    }

    // Если есть характеристики, добавляем их
    if (requestData.characteristics && Array.isArray(requestData.characteristics) && requestData.characteristics.length > 0) {
      logger.info(`Adding ${requestData.characteristics.length} characteristics to product ${product.id}`);

      // Подготавливаем запрос для массового добавления характеристик
      const characteristicsValues = [];
      const characteristicsPlaceholders = [];
      let paramIndex = 1;

      for (const char of requestData.characteristics) {
        if (char.value_id) {
          characteristicsPlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
          characteristicsValues.push(
            product.id,
            char.value_id,
            char.additional_value || null
          );
          paramIndex += 3;
        }
      }

      if (characteristicsPlaceholders.length > 0) {
        const characteristicsQuery = `
          INSERT INTO product_characteristics_simple (product_id, value_id, additional_value)
          VALUES ${characteristicsPlaceholders.join(', ')}
        `;

        await executeQuery(characteristicsQuery, characteristicsValues);
        logger.info(`Successfully added ${characteristicsPlaceholders.length} characteristics to product ${product.id}`);
      }
    }

    logger.info('Product created successfully', { productId: product.id });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Failed to create product:', error);

    // Ошибки валидации данных
    if (error.message && (
      error.message.includes('должно быть числом') ||
      error.message.includes('не может быть отрицательным') ||
      error.message.includes('не может превышать') ||
      error.message.includes('должно быть целым числом')
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Ошибки ограничений базы данных
    if (error.code === '23514') {
      if (error.constraint === 'check_stock_status_new') {
        return NextResponse.json(
          { error: 'Недопустимое значение статуса склада. Допустимые значения: В наличии, Нет в наличии, На заказ, Дальний склад, Ближний склад' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'Данные не соответствуют ограничениям базы данных' },
          { status: 400 }
        );
      }
    }

    // Ошибки уникальности
    if (error.code === '23505') {
      if (error.constraint === 'unique_product_name_manufacturer') {
        // Получаем информацию о существующем продукте для более детального сообщения
        try {
          const existingProductQuery = `
            SELECT p.id, p.name, p.manufacturer_id, m.name as manufacturer_name
            FROM products p
            LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
            WHERE p.name = $1 AND p.manufacturer_id = $2
          `;
          const existingProduct = await executeQuery(existingProductQuery, [requestData?.name, requestData?.manufacturer_id]);

          if (existingProduct.rows.length > 0) {
            const existing = existingProduct.rows[0];
            return NextResponse.json(
              {
                error: `Продукт с именем "${requestData?.name}" уже существует у производителя "${existing.manufacturer_name}" (ID: ${existing.id})`,
                suggestion: 'Используйте другое имя продукта или выберите другого производителя',
                existingProduct: {
                  id: existing.id,
                  name: existing.name,
                  manufacturer: existing.manufacturer_name
                }
              },
              { status: 409 }
            );
          }
        } catch (lookupError) {
          logger.warn('Failed to lookup existing product for detailed error message', { error: lookupError.message });
        }

        return NextResponse.json(
          {
            error: 'Продукт с таким именем уже существует у данного производителя',
            suggestion: 'Используйте другое имя продукта или выберите другого производителя'
          },
          { status: 409 }
        );
      } else if (error.detail?.includes('sku')) {
        return NextResponse.json(
          {
            error: 'Продукт с таким SKU уже существует',
            suggestion: 'Используйте другой SKU'
          },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          {
            error: 'Продукт с такими данными уже существует',
            suggestion: 'Проверьте уникальность всех полей'
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create product',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let data: any;
  
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    data = await request.json();
    const productId = data.id;

    if (!productId) {
      logger.error('Product PUT request without ID', { data });
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    logger.info('Product PUT request', { 
      productId, 
      name: data.name, 
      dataKeys: Object.keys(data),
      hasCustomFields: !!data.custom_fields,
      configurableCharacteristics: data.custom_fields?.configurableCharacteristics?.length || 0
    });

    const query = `
      UPDATE products SET
        name = $1,
        short_name = $2,
        description = $3,
        sku = $4,
        article_number = $5,
        price = $6,
        discount_price = $7,
        image_url = $8,
        images = $9,
        series_id = $10,
        manufacturer_id = $11,
        category_id = $12,
        in_stock = $13,
        stock_quantity = $14,
        stock_status = $15,
        weight = $16,
        battery_life = $17,
        warranty = $18,
        show_price = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `;

    // Валидация и преобразование числовых полей
    const validateAndParseNumber = (value: any, fieldName: string, maxValue: number) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        logger.error(`Validation error: ${fieldName} is not a number`, { value, fieldName });
        throw new Error(`Поле "${fieldName}" должно быть числом`);
      }
      if (parsed < 0) {
        logger.error(`Validation error: ${fieldName} is negative`, { value: parsed, fieldName });
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        logger.error(`Validation error: ${fieldName} exceeds max value`, { value: parsed, fieldName, maxValue });
        throw new Error(`Поле "${fieldName}" не может быть больше ${maxValue}`);
      }
      return parsed;
    };

    const values = [
      data.name,
      data.short_name || data.name, // Если short_name не указан, используем name
      data.description || null,
      data.sku || null,
      data.article_number || null,
      validateAndParseNumber(data.price, 'price', 999999999.99),
      validateAndParseNumber(data.discount_price, 'discount_price', 999999999.99),
      data.image_url || null,
      JSON.stringify(data.images || []),
      data.series_id || null,
      data.manufacturer_id || null,
      data.category_id || null,
      data.in_stock !== undefined ? data.in_stock : true,
      validateAndParseNumber(data.stock_quantity, 'stock_quantity', 999999),
      data.stock_status || 'in_stock',
      validateAndParseNumber(data.weight, 'weight', 999999.999),
      validateAndParseNumber(data.battery_life, 'battery_life', 999999),
      data.warranty || null,
      data.show_price !== undefined ? data.show_price : true,
      productId
    ];

    const result = await executeQuery(query, values);
    const updatedProduct = result.rows[0];

    if (!updatedProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    logger.info('Product updated successfully', { productId: updatedProduct.id });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update product:', error);
    logger.error('Product update error details:', {
      productId: data?.id,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      requestDataKeys: data ? Object.keys(data) : [],
      hasId: !!data?.id
    });
    
    return NextResponse.json(
      {
        error: 'Failed to update product',
        details: error.message
      },
      { status: 500 }
    );
  }
}
