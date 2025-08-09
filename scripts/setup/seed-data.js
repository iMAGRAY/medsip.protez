require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function seedData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST,
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER,
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  try {
    // 1. Добавляем категории
    const categories = [
      ['Протезы рук', 'Современные протезы верхних конечностей'],
      ['Протезы ног', 'Протезы нижних конечностей'],
      ['Ортопедические изделия', 'Ортопедические приспособления и корсеты'],
      ['Экзоскелеты', 'Роботизированные экзоскелеты для реабилитации']
    ];

    for (const [name, description] of categories) {
      await pool.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, description]
      );
    }

    // 2. Добавляем материалы
    const materials = [
      ['Углеродное волокно', 'Легкий и прочный композитный материал'],
      ['Титан', 'Биосовместимый металл высокой прочности'],
      ['Силикон медицинский', 'Мягкий гипоаллергенный материал для комфорта'],
      ['Алюминиевый сплав', 'Легкий металлический сплав'],
      ['Полиуретан', 'Эластичный полимерный материал'],
      ['Нержавеющая сталь', 'Коррозионностойкий металл']
    ];

    for (const [name, description] of materials) {
      await pool.query(
        'INSERT INTO materials (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, description]
      );
    }

    // 3. Добавляем особенности
    const features = [
      ['Миоэлектрическое управление', 'Управление сигналами мышц'],
      ['Водонепроницаемость', 'Защита от влаги и пыли'],
      ['Быстрое крепление', 'Система быстрого снятия и установки'],
      ['Сенсорная обратная связь', 'Тактильные ощущения при касании'],
      ['Беспроводная зарядка', 'Зарядка без проводов'],
      ['AI-адаптация', 'Искусственный интеллект для обучения движениям'],
      ['Модульная конструкция', 'Возможность замены отдельных компонентов'],
      ['Амортизация', 'Система поглощения ударов']
    ];

    for (const [name, description] of features) {
      await pool.query(
        'INSERT INTO features (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, description]
      );
    }

    // 4. Получаем ID категорий
    const categoryResult = await pool.query('SELECT id, name FROM categories');
    const categoryMap = {};
    categoryResult.rows.forEach(row => {
      categoryMap[row.name] = row.id;
    });

    // 5. Добавляем продукты
    const products = [
      {
        name: 'МедСИП Pro X1',
        category: 'Протезы рук',
        description: 'Флагманский миоэлектрический протез руки с AI-управлением и сенсорной обратной связью. Революционная технология обучения движениям.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/prosthetic-arm-advanced.jpg',
        weight: '420 г',
        battery_life: '16 часов',
        warranty: '3 года',
        materials: ['Углеродное волокно', 'Титан', 'Силикон медицинский'],
        features: ['Миоэлектрическое управление', 'Сенсорная обратная связь', 'AI-адаптация', 'Беспроводная зарядка']
      },
      {
        name: 'МедСИП Flex A2',
        category: 'Протезы рук',
        description: 'Легкий механический протез руки с улучшенной эргономикой. Идеальный баланс функциональности и доступности.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/prosthetic-arm-mechanical.jpg',
        weight: '280 г',
        battery_life: null,
        warranty: '2 года',
        materials: ['Алюминиевый сплав', 'Полиуретан'],
        features: ['Быстрое крепление', 'Модульная конструкция']
      },
      {
        name: 'МедСИП Sprint L3',
        category: 'Протезы ног',
        description: 'Спортивный протез голени для активного образа жизни. Карбоновая пружина обеспечивает отличную амортизацию.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/prosthetic-leg-sport.jpg',
        weight: '1.2 кг',
        battery_life: null,
        warranty: '3 года',
        materials: ['Углеродное волокно', 'Титан'],
        features: ['Амортизация', 'Быстрое крепление', 'Водонепроницаемость']
      },
      {
        name: 'МедСИП Walk C4',
        category: 'Протезы ног',
        description: 'Комфортный протез стопы с микропроцессорным управлением. Автоматическая адаптация к различным поверхностям.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/prosthetic-foot-smart.jpg',
        weight: '1.8 кг',
        battery_life: '48 часов',
        warranty: '5 лет',
        materials: ['Углеродное волокно', 'Титан', 'Силикон медицинский'],
        features: ['AI-адаптация', 'Сенсорная обратная связь', 'Беспроводная зарядка', 'Амортизация']
      },
      {
        name: 'МедСИП Support B1',
        category: 'Ортопедические изделия',
        description: 'Корректирующий корсет для позвоночника с регулируемой жесткостью. Индивидуальная подгонка по размерам.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/orthotic-corset.jpg',
        weight: '650 г',
        battery_life: null,
        warranty: '1 год',
        materials: ['Полиуретан', 'Нержавеющая сталь'],
        features: ['Модульная конструкция', 'Быстрое крепление']
      },
      {
        name: 'МедСИП Exo R5',
        category: 'Экзоскелеты',
        description: 'Реабилитационный экзоскелет нижних конечностей. Помогает восстановить навыки ходьбы после травм.',

        image_url: 'https://s3.twcstorage.ru/b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5/exoskeleton-rehab.jpg',
        weight: '12 кг',
        battery_life: '6 часов',
        warranty: '2 года',
        materials: ['Углеродное волокно', 'Титан', 'Алюминиевый сплав'],
        features: ['AI-адаптация', 'Сенсорная обратная связь', 'Беспроводная зарядка', 'Миоэлектрическое управление']
      }
    ];

    for (const product of products) {
      // Вставляем продукт
      const productResult = await pool.query(`
        INSERT INTO products (
          name, category_id, description,
          image_url, weight, battery_life, warranty, in_stock, rating, review_count
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        product.name,
        categoryMap[product.category],
        product.description,

        product.image_url,
        product.weight,
        product.battery_life,
        product.warranty,
        true,
        Math.floor(Math.random() * 3) + 3, // рейтинг 3-5
        Math.floor(Math.random() * 50) + 10 // отзывы 10-60
      ]);

      const productId = productResult.rows[0].id;

      // Добавляем материалы
      for (const materialName of product.materials) {
        await pool.query(`
          INSERT INTO product_materials (product_id, material_id)
          SELECT $1, id FROM materials WHERE name = $2
        `, [productId, materialName]);
      }

      // Добавляем особенности
      for (const featureName of product.features) {
        await pool.query(`
          INSERT INTO product_features (product_id, feature_id)
          SELECT $1, id FROM features WHERE name = $2
        `, [productId, featureName]);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка добавления данных:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();