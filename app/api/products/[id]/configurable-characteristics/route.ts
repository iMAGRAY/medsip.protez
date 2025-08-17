import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db-connection';
import { logger } from '@/lib/logger';
import { requireAuth, hasPermission } from '@/lib/database-auth';

// GET - получить конфигурируемые характеристики
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params
    const id = parseInt(paramId);
    const pool = getPool();
    
    // Сначала проверяем, является ли это ID варианта товара
    const variantResult = await pool.query(
      'SELECT custom_fields FROM product_variants WHERE id = $1',
      [id]
    );
    
    if (variantResult.rows.length > 0) {
      const customFields = variantResult.rows[0].custom_fields || {};
      return NextResponse.json({
        success: true,
        data: {
          configurable_characteristics: customFields.configurableCharacteristics || []
        }
      });
    }
    
    // Если не вариант, проверяем в таблице конфигурируемых характеристик товара
    const productResult = await pool.query(
      'SELECT characteristic_data FROM product_configurable_characteristics WHERE product_id = $1',
      [id]
    );
    
    logger.info('Product configurable characteristics query result:', {
      productId: id,
      rowsFound: productResult.rows.length,
      data: productResult.rows[0]?.characteristic_data
    });
    
    if (productResult.rows.length > 0) {
      let characteristics = productResult.rows[0].characteristic_data || [];
      
      // Если это строка, пробуем распарсить
      if (typeof characteristics === 'string') {
        try {
          characteristics = JSON.parse(characteristics);
        } catch (e) {
          logger.error('Failed to parse characteristic_data:', e);
          characteristics = [];
        }
      }
      
      // Убедимся, что это массив
      if (!Array.isArray(characteristics)) {
        characteristics = [];
      }
      
      return NextResponse.json({
        success: true,
        data: {
          configurable_characteristics: characteristics
        }
      });
    }
    
    // Если ничего не найдено, возвращаем пустой массив
    return NextResponse.json({
      success: true,
      data: {
        configurable_characteristics: []
      }
    });
    
  } catch (error) {
    logger.error('Error fetching configurable characteristics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch configurable characteristics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST/PUT - сохранить конфигурируемые характеристики
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { id } = await params
    const productId = parseInt(id);
    const { configurableCharacteristics } = await request.json();
    const pool = getPool();
    
    logger.info('Saving configurable characteristics', { 
      productId, 
      count: configurableCharacteristics?.length,
      data: configurableCharacteristics 
    });
    
    // Проверяем, что данные корректные
    if (!Array.isArray(configurableCharacteristics)) {
      logger.error('Invalid configurableCharacteristics data - not an array:', configurableCharacteristics);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid data format - expected array of characteristics' 
        },
        { status: 400 }
      );
    }
    
    // Используем UPSERT для сохранения характеристик
    const query = `
      INSERT INTO product_configurable_characteristics (product_id, characteristic_data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (product_id) 
      DO UPDATE SET 
        characteristic_data = $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [productId, JSON.stringify(configurableCharacteristics)]);
    
    logger.info('Configurable characteristics saved:', {
      productId,
      savedData: result.rows[0]
    });
    
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Configurable characteristics saved successfully'
    });
    
  } catch (error) {
    logger.error('Error saving configurable characteristics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save configurable characteristics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, params: any) {
  return POST(request, params);
}