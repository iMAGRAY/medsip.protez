const XLSX = require('xlsx');
const { Pool } = require('pg');

// Подключение к базе данных
const pool = new Pool({
  host: '212.113.118.141',
  port: 5432,
  database: 'default_db',
  user: 'gen_user',
  password: 'Q1w2e3r4t5!@'
});

// ID уже созданных сущностей
const MANUFACTURER_ID = 6; // МедСИП
const MODEL_LINE_ID = 21; // МедСИП Протезы 2025

// Маппинг категорий
const CATEGORY_MAPPING = {
  'Стопа': 89,
  'Спортивная стопа': 89,
  'Коленный модуль': 90,
  'Универсальный': 91, // Лайнеры
  'Антибактериальный': 91,
  'Усиленный': 91,
  'гильзовый адаптер': 92,
  'Сдвижной двойной': 92,
  'Поворотный адаптер': 92,
  'Челночный замок': 92,
  'Автоматический': 92,
  'Бедренный ремень': 93
};

// ID групп характеристик
const SPEC_GROUPS = {
  material: 224,
  activity_level: 253,
  max_load: 254,
  profile: 255,
  sizes: 256,
  height: 257
};

async function main() {
  try {
    // Читаем Excel файл
    const workbook = XLSX.readFile('public/prosthesis_models_fixed.xlsx');
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    // Парсим товары
    const products = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const category = row[0];
      const model = row[1];
      const description = row[3];

      // Пропускаем служебные строки
      if (!category || !model ||
          category.includes('МедСИП | ПРОТЕЗИРОВАНИЕ') ||
          category.includes('TABLE') ||
          category.includes('---') ||
          model === '2025' ||
          typeof model !== 'string') {
        continue;
      }

      // Извлекаем характеристики
      const characteristics = {};
      for (let j = 4; j < row.length; j++) {
        const header = data[0][j];
        const value = row[j];

        if (header && value && typeof value === 'string' && value.trim() !== '') {
          const cleanHeader = header.toString().trim();
          if (cleanHeader.length > 0 && cleanHeader.length < 100 &&
              !cleanHeader.includes('_') &&
              !cleanHeader.includes('TABLE') &&
              !cleanHeader.includes('---')) {
            characteristics[cleanHeader] = value.toString().trim();
          }
        }
      }

      if (Object.keys(characteristics).length > 0) {
        products.push({
          category: category.toString().trim(),
          model: model.toString().trim(),
          description: description ? description.toString().trim() : '',
          characteristics
        });
      }
    }
    // Проверяем, какие товары уже есть в базе
    const existingProducts = await pool.query('SELECT sku FROM products WHERE sku IS NOT NULL');
    const existingSkus = new Set(existingProducts.rows.map(row => row.sku));

    // Фильтруем новые товары
    const newProducts = products.filter(p => !existingSkus.has(p.model));
    let addedCount = 0;
    let characteristicsCount = 0;

    // Импортируем товары пакетами
    for (const product of newProducts) {
      try {
        // Определяем категорию
        let categoryId = null;
        for (const [key, id] of Object.entries(CATEGORY_MAPPING)) {
          if (product.category.includes(key) || product.model.includes(key)) {
            categoryId = id;
            break;
          }
        }

        if (!categoryId) {
          // Если категория не найдена, используем "Комплектующие"
          categoryId = 93;
        }

        // Извлекаем основные характеристики из данных
        const weight = extractWeight(product.characteristics);
        const maxWeight = extractMaxWeight(product.characteristics);
        const material = extractMaterial(product.characteristics);
        const activityLevel = extractActivityLevel(product.characteristics);
        const profile = extractProfile(product.characteristics);
        const sizes = extractSizes(product.characteristics);
        const height = extractHeight(product.characteristics);

        // Создаем описание товара
        let description = product.description;
        if (description.length > 500) {
          description = description.substring(0, 497) + '...';
        }

        // Добавляем товар
        const productResult = await pool.query(`
          INSERT INTO products (
            name, description, category_id, manufacturer_id, model_line_id,
            sku, article_number, weight, in_stock, stock_quantity, stock_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          product.model,
          description,
          categoryId,
          MANUFACTURER_ID,
          MODEL_LINE_ID,
          product.model,
          product.model,
          weight,
          true,
          Math.floor(Math.random() * 20) + 5, // Случайное количество 5-25
          'in_stock'
        ]);

        const productId = productResult.rows[0].id;
        addedCount++;

        // Добавляем характеристики
        const characteristicsToAdd = [];

        if (material) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.material,
            type: 'text',
            label: 'Материал',
            valueText: material
          });
        }

        if (activityLevel) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.activity_level,
            type: 'text',
            label: 'Уровень активности',
            valueText: activityLevel
          });
        }

        if (maxWeight) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.max_load,
            type: 'numeric',
            label: 'Максимальный вес, кг',
            valueNumeric: maxWeight
          });
        }

        if (profile) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.profile,
            type: 'text',
            label: 'Профиль',
            valueText: profile
          });
        }

        if (sizes) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.sizes,
            type: 'text',
            label: 'Размеры',
            valueText: sizes
          });
        }

        if (height) {
          characteristicsToAdd.push({
            groupId: SPEC_GROUPS.height,
            type: 'numeric',
            label: 'Высота, мм',
            valueNumeric: height
          });
        }

        // Добавляем характеристики в базу
        for (const char of characteristicsToAdd) {
          await pool.query(`
            INSERT INTO product_characteristics (
              product_id, group_id, characteristic_type, value_text, value_numeric,
              label, is_active, is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            productId,
            char.groupId,
            char.type,
            char.valueText || null,
            char.valueNumeric || null,
            char.label,
            true,
            true
          ]);
          characteristicsCount++;
        }
      } catch (error) {
        console.error(`❌ Ошибка при добавлении товара ${product.model}:`, error.message);
      }
    }
    // Итоговая статистика
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
    const totalCharacteristics = await pool.query('SELECT COUNT(*) FROM product_characteristics');
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  } finally {
    await pool.end();
  }
}

// Функции извлечения характеристик
function extractWeight(characteristics) {
  const weightKeys = ['Вес (размер 27), гр.', 'Вес, гр.', 'Масса, гр.'];
  for (const key of weightKeys) {
    if (characteristics[key]) {
      const match = characteristics[key].match(/(\d+)/);
      if (match) return `${match[1]} гр`;
    }
  }
  return null;
}

function extractMaxWeight(characteristics) {
  const weightKeys = ['Максимальный вес пациента, кг.', 'Нагрузка, кг.'];
  for (const key of weightKeys) {
    if (characteristics[key]) {
      const match = characteristics[key].match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  return null;
}

function extractMaterial(characteristics) {
  if (characteristics['Материал']) {
    return characteristics['Материал'];
  }
  // Попробуем найти в других полях
  const text = Object.values(characteristics).join(' ');
  if (text.includes('Углеродное волокно') || text.includes('углеродного волокна')) {
    return 'Углеродное волокно';
  }
  if (text.includes('Полиуретан') || text.includes('полиуретан')) {
    return 'Полиуретан';
  }
  if (text.includes('Алюминий') || text.includes('алюминий')) {
    return 'Алюминий';
  }
  if (text.includes('Титан') || text.includes('титан')) {
    return 'Титан';
  }
  if (text.includes('Силикон') || text.includes('силикон')) {
    return 'Силикон';
  }
  if (text.includes('Гель') || text.includes('гель')) {
    return 'Гель';
  }
  return null;
}

function extractActivityLevel(characteristics) {
  const levelKeys = ['Уровень активности', 'Уровень активности 1', 'Уровень активности 3'];
  for (const key of levelKeys) {
    if (characteristics[key]) {
      return characteristics[key];
    }
  }
  return null;
}

function extractProfile(characteristics) {
  const profileKeys = ['Профиль', 'Профиль Низкий', 'Профиль Средний', 'Профиль Высокий'];
  for (const key of profileKeys) {
    if (characteristics[key]) {
      let value = characteristics[key];
      if (value.includes('Низкий')) return 'Низкий';
      if (value.includes('Средний')) return 'Средний';
      if (value.includes('Высокий')) return 'Высокий';
      return value;
    }
  }
  return null;
}

function extractSizes(characteristics) {
  const sizeKeys = ['Размеры', 'Размеры 22', 'Размеры L/R'];
  for (const key of sizeKeys) {
    if (characteristics[key]) {
      return characteristics[key];
    }
  }
  return null;
}

function extractHeight(characteristics) {
  const heightKeys = ['Высота стопы (размер 27), мм', 'Рабочая высота конструкции, мм.', 'Толщина, мм'];
  for (const key of heightKeys) {
    if (characteristics[key]) {
      const match = characteristics[key].match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  return null;
}

// Запускаем импорт
main().catch(console.error);