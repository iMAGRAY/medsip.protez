import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'

// GET - скачать каталог с подсчетом статистики
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const catalogId = parseInt(resolvedParams.id)

    if (isNaN(catalogId)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный ID каталога' },
        { status: 400 }
      )
    }

    // Получаем информацию о каталоге
    const catalogQuery = `
      SELECT * FROM catalog_files
      WHERE id = $1 AND is_active = true
    `
    const catalogResult = await executeQuery(catalogQuery, [catalogId])

    if (catalogResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Каталог не найден или неактивен' },
        { status: 404 }
      )
    }

    const catalog = catalogResult.rows[0]

    // Увеличиваем счетчик скачиваний
    const updateQuery = `
      UPDATE catalog_files
      SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `
    await executeQuery(updateQuery, [catalogId])

    // Проверяем, запрашивается ли прямая загрузка файла
    const direct = request.nextUrl.searchParams.get('direct') === 'true'
    
    if (direct && catalog.file_url) {
      // Для прямой загрузки делаем редирект на файл
      return NextResponse.redirect(catalog.file_url, { status: 302 })
    }

    // Возвращаем информацию для скачивания
    return NextResponse.json({
      success: true,
      data: {
        id: catalog.id,
        title: catalog.title,
        file_url: catalog.file_url,
        file_name: catalog.file_name,
        file_size: catalog.file_size,
        file_type: catalog.file_type,
        download_count: catalog.download_count + 1
      }
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка скачивания каталога' },
      { status: 500 }
    )
  }
}