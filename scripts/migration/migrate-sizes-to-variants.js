const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://gen_user:Q1w2e3r4t5!%40@212.113.118.141:5432/default_db'
});

async function migrateSizesToVariants() {
  console.log('🔄 Начало миграции product_sizes → product_variants\n');
  
  try {
    await pool.query('BEGIN');
    
    // 1. Получаем все записи из product_sizes
    const sizesResult = await pool.query(`
      SELECT * FROM product_sizes 
      ORDER BY product_id, id
    `);
    
    console.log(`📊 Найдено ${sizesResult.rows.length} записей в product_sizes`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const size of sizesResult.rows) {
      try {
        // Проверяем, нет ли уже такого варианта
        const existingCheck = await pool.query(`
          SELECT id FROM product_variants 
          WHERE master_id = $1 AND (sku = $2 OR (name = $3 AND sku IS NULL))
        `, [size.product_id, size.sku, size.name]);
        
        if (existingCheck.rows.length > 0) {
          console.log(`⏭️  Пропуск: вариант для товара ${size.product_id} с SKU "${size.sku}" уже существует`);
          skipped++;
          continue;
        }
        
        // Подготавливаем данные для миграции
        const variantData = {
          master_id: size.product_id,
          name: size.name || size.size_name || 'Без названия',
          sku: size.sku,
          description: size.description,
          price: size.price,
          discount_price: size.discount_price,
          stock_quantity: size.stock_quantity || 0,
          weight: size.weight,
          primary_image_url: size.image_url,
          images: size.images || [],
          is_featured: size.is_featured || false,
          is_new: size.is_new || false,
          is_bestseller: size.is_bestseller || false,
          is_active: size.is_available !== false,
          sort_order: size.sort_order || 0,
          warranty_months: size.warranty ? parseInt(size.warranty) : null,
          battery_life_hours: size.battery_life ? parseInt(size.battery_life) : null,
          meta_title: size.meta_title,
          meta_description: size.meta_description,
          meta_keywords: size.meta_keywords,
          custom_fields: size.custom_fields || {},
          attributes: {
            ...size.specifications,
            size_name: size.size_name,
            size_value: size.size_value,
            dimensions: size.dimensions
          }
        };
        
        // Генерируем slug
        const slug = await generateUniqueSlug(variantData.name);
        
        // Вставляем в product_variants
        const insertResult = await pool.query(`
          INSERT INTO product_variants (
            master_id, name, slug, sku, description,
            price, discount_price, stock_quantity, weight,
            primary_image_url, images, is_featured, is_new, is_bestseller,
            is_active, sort_order, warranty_months, battery_life_hours,
            meta_title, meta_description, meta_keywords,
            custom_fields, attributes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23
          ) RETURNING id
        `, [
          variantData.master_id,
          variantData.name,
          slug,
          variantData.sku,
          variantData.description,
          variantData.price,
          variantData.discount_price,
          variantData.stock_quantity,
          variantData.weight,
          variantData.primary_image_url,
          JSON.stringify(variantData.images),
          variantData.is_featured,
          variantData.is_new,
          variantData.is_bestseller,
          variantData.is_active,
          variantData.sort_order,
          variantData.warranty_months,
          variantData.battery_life_hours,
          variantData.meta_title,
          variantData.meta_description,
          variantData.meta_keywords,
          JSON.stringify(variantData.custom_fields),
          JSON.stringify(variantData.attributes)
        ]);
        
        const newVariantId = insertResult.rows[0].id;
        
        // Мигрируем характеристики, если они есть
        if (size.characteristics && typeof size.characteristics === 'object') {
          const characteristics = Array.isArray(size.characteristics) 
            ? size.characteristics 
            : Object.values(size.characteristics);
            
          for (const char of characteristics) {
            if (char.value_id) {
              try {
                await pool.query(`
                  INSERT INTO variant_characteristics_simple (variant_id, value_id, additional_value)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (variant_id, value_id) DO NOTHING
                `, [newVariantId, char.value_id, char.additional_value || null]);
              } catch (charError) {
                console.error(`⚠️  Ошибка миграции характеристики для варианта ${newVariantId}:`, charError.message);
              }
            }
          }
        }
        
        console.log(`✅ Мигрирован: ${variantData.name} (SKU: ${variantData.sku || 'нет'})`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Ошибка миграции записи ${size.id}:`, error.message);
        errors++;
      }
    }
    
    await pool.query('COMMIT');
    
    console.log('\n📊 ИТОГИ МИГРАЦИИ:');
    console.log(`✅ Успешно мигрировано: ${migrated}`);
    console.log(`⏭️  Пропущено (уже существуют): ${skipped}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📋 Всего обработано: ${sizesResult.rows.length}`);
    
    // Показываем рекомендации
    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    console.log('1. Проверьте мигрированные данные в таблице product_variants');
    console.log('2. Обновите все API endpoints для использования product_variants вместо product_sizes');
    console.log('3. После проверки можно удалить таблицу product_sizes');
    console.log('4. Обновите фронтенд для работы с новым API');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Критическая ошибка миграции:', error);
  } finally {
    await pool.end();
  }
}

// Функция генерации уникального slug
async function generateUniqueSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  let slug = baseSlug;
  let counter = 0;
  
  while (true) {
    const existing = await pool.query(
      'SELECT id FROM product_variants WHERE slug = $1',
      [slug]
    );
    
    if (existing.rows.length === 0) {
      return slug;
    }
    
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

// Запуск миграции
if (require.main === module) {
  migrateSizesToVariants();
}