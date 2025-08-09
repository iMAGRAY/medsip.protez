// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { executeQuery, testConnection } from "@/lib/db-connection"

export const dynamic = 'force-dynamic'

// Add a simple handler for all methods to debug
export async function GET(request: NextRequest) {

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in site-settings GET")
      return NextResponse.json(getFallbackSettings(), {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Проверяем наличие таблицы site_settings, не выполняя DDL
    const exists = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'site_settings'
      ) AS exist
    `)
    if (!exists.rows?.[0]?.exist) {
      return NextResponse.json(getFallbackSettings(), {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    const result = await executeQuery("SELECT * FROM site_settings ORDER BY id DESC LIMIT 1")

    if (result.rows.length === 0) {
      // Return default settings if none exist

      return NextResponse.json(getFallbackSettings(), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Map database fields to camelCase format for frontend consistency
    const settings = result.rows[0]
    const mappedSettings = {
      id: settings.id,
      siteName: settings.site_name,
      siteDescription: settings.site_description,
      heroTitle: settings.hero_title,
      heroSubtitle: settings.hero_subtitle,
      contactEmail: settings.contact_email,
      contactPhone: settings.contact_phone,
      address: settings.address,
      socialMedia: settings.social_media,
      additionalContacts: settings.additional_contacts || [],
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
    }

    return NextResponse.json(mappedSettings, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error("Database error in site-settings GET:", error)
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Return default settings if database is unavailable
    return NextResponse.json(getFallbackSettings(), {
      status: 503,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
}

export async function POST(request: NextRequest) {
// Treat POST as PUT for compatibility
  return PUT(request)
}

export async function PUT(request: NextRequest) {

  let body
  try {
    body = await request.json()

  } catch (error) {
    console.error("🔧 Site Settings API: Failed to parse request body:", error)
    return NextResponse.json({ error: "Invalid JSON body" }, {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    // Проверяем соединение с базой данных
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error("Database connection failed in site-settings PUT")
      return NextResponse.json({
        ...body,
        id: 1,
        updated_at: new Date().toISOString(),
        error: "Database connection failed, changes not saved"
      }, {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    const updateFields = []
    const values = []
    let paramCount = 1

    // Обработка полей как в camelCase (от фронтенда), так и в snake_case (для совместимости)
    if (body.siteName || body.site_name) {
      updateFields.push(`site_name = $${paramCount}`)
      values.push(body.siteName || body.site_name)
      paramCount++
    }
    if (body.siteDescription !== undefined || body.site_description !== undefined) {
      updateFields.push(`site_description = $${paramCount}`)
      values.push(body.siteDescription !== undefined ? body.siteDescription : body.site_description)
      paramCount++
    }
    if (body.heroTitle || body.hero_title) {
      updateFields.push(`hero_title = $${paramCount}`)
      values.push(body.heroTitle || body.hero_title)
      paramCount++
    }
    if (body.heroSubtitle || body.hero_subtitle) {
      updateFields.push(`hero_subtitle = $${paramCount}`)
      values.push(body.heroSubtitle || body.hero_subtitle)
      paramCount++
    }
    if (body.contactEmail || body.contact_email) {
      updateFields.push(`contact_email = $${paramCount}`)
      values.push(body.contactEmail || body.contact_email)
      paramCount++
    }
    if (body.contactPhone || body.contact_phone) {
      updateFields.push(`contact_phone = $${paramCount}`)
      values.push(body.contactPhone || body.contact_phone)
      paramCount++
    }
    if (body.address) {
      updateFields.push(`address = $${paramCount}`)
      values.push(body.address)
      paramCount++
    }
    if (body.socialMedia || body.social_media) {
      updateFields.push(`social_media = $${paramCount}`)
      values.push(JSON.stringify(body.socialMedia || body.social_media))
      paramCount++
    }
    if (body.additionalContacts || body.additional_contacts) {
      updateFields.push(`additional_contacts = $${paramCount}`)
      values.push(JSON.stringify(body.additionalContacts || body.additional_contacts))
      paramCount++
    }

    if (updateFields.length === 0) {

      return NextResponse.json({ error: "No fields to update" }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Проверяем существование таблицы site_settings
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'site_settings'
      )
    `

    const tableExists = await executeQuery(tableCheckQuery)

    if (!tableExists.rows[0].exists) {

      // Создаем таблицу если она не существует
      await executeQuery(`
        CREATE TABLE site_settings (
          id SERIAL PRIMARY KEY,
          site_name VARCHAR(255) NOT NULL DEFAULT 'МедСИП Протезирование',
          site_description TEXT,
          hero_title TEXT,
          hero_subtitle TEXT,
          contact_email VARCHAR(255),
          contact_phone VARCHAR(255),
          address TEXT,
          social_media JSONB DEFAULT '{}',
          additional_contacts JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }

    // Try to update existing record first
    const updateQuery = `
      UPDATE site_settings
      SET ${updateFields.join(", ")}, updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `

    let result = await executeQuery(updateQuery, values)

    // If no record was updated, insert a new one
    if (result.rows.length === 0) {
      const insertQuery = `
        INSERT INTO site_settings (
          site_name, site_description, hero_title, hero_subtitle,
          contact_email, contact_phone, address, social_media, additional_contacts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
      `

      const insertValues = [
        body.siteName || body.site_name || "МедСИП Протезирование",
        body.siteDescription || body.site_description || "",
        body.heroTitle || body.hero_title || "",
        body.heroSubtitle || body.hero_subtitle || "",
        body.contactEmail || body.contact_email || "",
        body.contactPhone || body.contact_phone || "",
        body.address || "",
        JSON.stringify(body.socialMedia || body.social_media || {}),
        JSON.stringify(body.additionalContacts || body.additional_contacts || []),
      ]

      result = await executeQuery(insertQuery, insertValues)
    }

    // Преобразуем результат из snake_case в camelCase для фронтенда
    const settings = result.rows[0]
    const mappedSettings = {
      id: settings.id,
      siteName: settings.site_name,
      siteDescription: settings.site_description,
      heroTitle: settings.hero_title,
      heroSubtitle: settings.hero_subtitle,
      contactEmail: settings.contact_email,
      contactPhone: settings.contact_phone,
      address: settings.address,
      socialMedia: settings.social_media,
      additionalContacts: settings.additional_contacts || [],
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
    }

    return NextResponse.json(mappedSettings, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error("Database error in site-settings PUT:", error)
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Return fallback response
    const fallbackSettings = {
      id: 1,
      ...body,
      updated_at: new Date().toISOString(),
      error: "Database error, changes not saved"
    }

    return NextResponse.json(fallbackSettings, {
      status: 503,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
}

export async function OPTIONS(request: NextRequest) {

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

function getFallbackSettings() {
  return {
    id: 1,
    siteName: "МедСИП Протезирование",
    siteDescription: "Расширяем возможности жизни через инновационные протезные технологии и заботливый уход.",
    heroTitle: "Передовые протезы, персонализированная забота",
    heroSubtitle: "Откройте для себя инновационные решения, созданные для комфорта, функциональности и обновленного чувства возможностей.",
    contactEmail: "info@medsip-prosthetics.ru",
    contactPhone: "+7 (495) 123-45-67",
    address: "ул. Медицинская, 15, Москва, 119991",
    socialMedia: {
      vk: "https://vk.com/medsip_prosthetics",
      telegram: "https://t.me/medsip_prosthetics",
      youtube: "https://youtube.com/@medsip_prosthetics",
      ok: "https://ok.ru/medsip.prosthetics"
    },
    additionalContacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
