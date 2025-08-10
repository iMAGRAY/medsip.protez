import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { requireAuth, hasPermission } from '@/lib/database-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    // Get product images from the database
    const query = `
      SELECT
        p.images,
        p.image_url,
        p.name
      FROM products p
      WHERE p.id = $1 AND (p.is_deleted = false OR p.is_deleted IS NULL)
    `;

    const result = await executeQuery(query, [productId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = result.rows[0];
    let imageUrls = [];

    // Process images from JSON field or fallback to image_url
    try {
      if (product.images && Array.isArray(product.images)) {
        imageUrls = product.images.map((img, _index) =>
          typeof img === 'string' ? img : img.url || img.image_url
        ).filter(Boolean);
      } else if (product.image_url) {
        imageUrls = [product.image_url];
      }
    } catch (error) {
      console.warn('Could not parse product images:', error);
      imageUrls = product.image_url ? [product.image_url] : [];
    }

    return NextResponse.json({
      success: true,
      data: imageUrls
    });

  } catch (error) {
    console.error('Error fetching product images:', error);
    return NextResponse.json({
      error: 'Failed to fetch product images',
      details: error.message
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const productId = parseInt(params.id);
    const { images } = await request.json();

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    if (!Array.isArray(images)) {
      return NextResponse.json({ error: 'Images must be an array' }, { status: 400 });
    }

    // Update product images in JSON field and set primary image
    const updateQuery = `
      UPDATE products SET
        images = $1,
        image_url = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND (is_deleted = false OR is_deleted IS NULL)
      RETURNING id
    `;

    const primaryImage = images.length > 0 ? images[0] : null;
    const result = await executeQuery(updateQuery, [JSON.stringify(images), primaryImage, productId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Images updated successfully'
    });

  } catch (error) {
    console.error('Error updating product images:', error);
    return NextResponse.json({
      error: 'Failed to update product images',
      details: error.message
    }, { status: 500 });
  }
}