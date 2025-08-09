require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function updateSettings() {
  const pool = new Pool({
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'medsip_db',
    ssl: false
  });

  try {
    await pool.query(`
      UPDATE site_settings SET
        site_name = 'МедСИП - Современное протезирование',
        site_description = 'Ведущий производитель высокотехнологичных протезов и ортопедических изделий в России. Инновационные решения для восстановления качества жизни.',
        hero_title = 'Технологии будущего уже сегодня',
        hero_subtitle = 'Революционные протезы с AI-управлением, миоэлектрическим контролем и сенсорной обратной связью',
        contact_email = 'info@medsip.ru',
        contact_phone = '+7 (495) 123-45-67',
        address = 'г. Москва, ул. Инновационная, д. 15, офис 501',
        social_media = '{
          "vk": "https://vk.com/medsip_russia",
          "telegram": "https://t.me/medsip_official",
          "youtube": "https://youtube.com/@medsip"
        }'::jsonb,
        additional_contacts = '[
          {
            "type": "Отдел продаж",
            "phone": "+7 (495) 123-45-68",
            "email": "sales@medsip.ru"
          },
          {
            "type": "Техническая поддержка",
            "phone": "+7 (495) 123-45-69",
            "email": "support@medsip.ru"
          },
          {
            "type": "Сервисный центр",
            "phone": "+7 (495) 123-45-70",
            "email": "service@medsip.ru"
          }
        ]'::jsonb,
        updated_at = NOW()
      WHERE id = 1
    `);
    // Проверяем результат
    const result = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    const settings = result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

updateSettings();