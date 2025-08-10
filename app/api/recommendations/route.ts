import { NextRequest, NextResponse } from 'next/server'
import { RecommendationEngine } from '@/lib/recommendation-engine'

export async function POST(request: NextRequest) {
  try {
    const { productId, allProducts, limit = 4, type = 'mixed' } = await request.json()

    if (!productId || !allProducts || !Array.isArray(allProducts)) {
      return NextResponse.json(
        { success: false, error: 'Необходимы productId и allProducts' },
        { status: 400 }
      )
    }

    // Находим текущий товар
    const currentProduct = allProducts.find((p: any) => p.id === productId)
    if (!currentProduct) {
      return NextResponse.json(
        { success: false, error: 'Товар не найден' },
        { status: 404 }
      )
    }

    // Создаем экземпляр движка рекомендаций
    const engine = new RecommendationEngine(allProducts)

    let recommendations
    switch (type) {
      case 'smart':
        recommendations = engine.getRecommendations(currentProduct, limit)
        break
      case 'category':
        recommendations = engine.getSameCategoryProducts(currentProduct, limit).map(product => ({
          ...product,
          recommendation_score: 0.8,
          reasons: ['Похожие товары']
        }))
        break
      case 'manufacturer':
        recommendations = engine.getSameManufacturerProducts(currentProduct, limit).map(_product => ({
          product,
          score: 0,
          reasons: ['Тот же производитель']
        }))
        break
      case 'price':
        recommendations = engine.getSimilarPriceProducts(currentProduct, limit).map(_product => ({
          product,
          score: 0,
          reasons: ['Похожая цена']
        }))
        break
      case 'mixed':
      default:
        recommendations = engine.getMixedRecommendations(currentProduct, limit)
        break
    }

    // Возвращаем рекомендации
    return NextResponse.json({
      success: true,
      data: {
        currentProduct,
        recommendations,
        type,
        total: recommendations.length
      }
    })

  } catch (error) {
    console.error('Ошибка при получении рекомендаций:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const _limit = Number(searchParams.get('limit') || '4')
    const _type = searchParams.get('type') || 'mixed'

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Необходим параметр productId' },
        { status: 400 }
      )
    }

    // В реальном приложении здесь бы был запрос к базе данных
    // Пока возвращаем заглушку
    return NextResponse.json({
      success: true,
      data: {
        message: 'Для получения рекомендаций используйте POST метод с данными о всех товарах',
        productId,
        limit,
        type
      }
    })

  } catch (error) {
    console.error('Ошибка при обработке GET запроса рекомендаций:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}