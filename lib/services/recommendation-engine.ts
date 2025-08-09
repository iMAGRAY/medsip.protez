import type { Prosthetic } from '../data'

export interface RecommendationScore {
  product: Prosthetic
  score: number
  reasons: string[]
}

export class RecommendationEngine {
  private products: Prosthetic[]

  constructor(products: Prosthetic[]) {
    this.products = products
  }

  /**
   * Получить рекомендации для конкретного товара
   */
  getRecommendations(
    currentProduct: Prosthetic,
    limit: number = 4,
    excludeCurrentProduct: boolean = true
  ): RecommendationScore[] {
    let candidates = this.products

    // Исключаем текущий товар из рекомендаций
    if (excludeCurrentProduct) {
      candidates = candidates.filter(p => {
        // Строгое сравнение ID с учетом разных типов
        return String(p.id) !== String(currentProduct.id) && 
               p.id !== currentProduct.id
      })
    }

    // Вычисляем оценки для каждого кандидата
    const scoredProducts = candidates.map(product => {
      const score = this.calculateRecommendationScore(currentProduct, product)
      return score
    })

    // Сортируем по убыванию оценки и возвращаем топ результаты
    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Получить товары той же категории
   */
  private getCategory(p: Prosthetic): string {
    return (p.category_name || p.category || '').toLowerCase()
  }

  /**
   * Получить товары того же производителя
   */
  private getManufacturer(p: Prosthetic): string {
    return (p.manufacturer_name || p.manufacturer || '').toLowerCase()
  }

  /**
   * Получить товары той же категории
   */
  getSameCategoryProducts(currentProduct: Prosthetic, limit: number = 4): Prosthetic[] {
    const currCat = this.getCategory(currentProduct)
    return this.products
      .filter(p => {
        // Исключаем текущий товар и фильтруем по категории
        return (String(p.id) !== String(currentProduct.id) && p.id !== currentProduct.id) && 
               this.getCategory(p) === currCat
      })
      .slice(0, limit)
  }

  /**
   * Получить товары того же производителя
   */
  getSameManufacturerProducts(currentProduct: Prosthetic, limit: number = 4): Prosthetic[] {
    const currMan = this.getManufacturer(currentProduct)
    return this.products
      .filter(p => {
        // Исключаем текущий товар и фильтруем по производителю
        return (String(p.id) !== String(currentProduct.id) && p.id !== currentProduct.id) && 
               this.getManufacturer(p) === currMan
      })
      .slice(0, limit)
  }

  /**
   * Получить товары в похожем ценовом диапазоне
   */
  getSimilarPriceProducts(currentProduct: Prosthetic, limit: number = 4): Prosthetic[] {
    const currentPrice = currentProduct.price || currentProduct.discount_price || 0
    if (currentPrice === 0) return []

    const priceRange = currentPrice * 0.3 // 30% диапазон

    return this.products
      .filter(p => {
        // Исключаем текущий товар
        if (String(p.id) === String(currentProduct.id) || p.id === currentProduct.id) return false
        const productPrice = p.price || p.discount_price || 0
        return Math.abs(productPrice - currentPrice) <= priceRange
      })
      .slice(0, limit)
  }

  /**
   * Вычисляет оценку рекомендации на основе различных факторов
   */
  private calculateRecommendationScore(current: Prosthetic, candidate: Prosthetic): RecommendationScore {
    let score = 0
    const reasons: string[] = []

    // 1. Категория (средний приоритет, снижен для разнообразия рекомендаций)
    if (this.getCategory(current) === this.getCategory(candidate) && this.getCategory(current) !== '') {
      score += 25 // Снижено с 40 до 25
      reasons.push('Похожие товары')
    } else {
      // Бонус для разнообразия - товары из других категорий
      score += 10
      reasons.push('Интересное из других категорий')
    }

    // 2. Производитель (средний приоритет)
    if (this.getManufacturer(current) === this.getManufacturer(candidate) && this.getManufacturer(current) !== '') {
      score += 25
      reasons.push('Тот же производитель')
    }

    // 3. Модельная линия (высокий приоритет если есть)
    if ((current.model_line_name || current.modelLine) && (candidate.model_line_name || candidate.modelLine) &&
        (current.model_line_name || current.modelLine) === (candidate.model_line_name || candidate.modelLine)) {
      score += 35
      reasons.push('Та же модельная линия')
    }

    // 4. Похожие характеристики (повышен приоритет для разнообразия)
    const commonSpecs = this.findCommonSpecifications(current, candidate)
    if (commonSpecs.length > 0) {
      score += commonSpecs.length * 8 // Увеличено с 5 до 8
      reasons.push(`${commonSpecs.length} общих характеристик`)
    }

    // 5. Цена (небольшой бонус за схожую цену)
    const priceScore = this.calculatePriceSimilarity(current, candidate)
    if (priceScore > 0) {
      score += priceScore
      reasons.push('Похожая цена')
    }

    // 6. Доступность (бонус за товары в наличии)
    if (this.isProductAvailable(candidate)) {
      score += 15 // Увеличено с 10 до 15
      reasons.push('В наличии')
    }

    // 7. Популярность (если есть данные о просмотрах)
    // TODO: Добавить метрики популярности когда будут доступны

    // 8. Случайный фактор для разнообразия (1-5 баллов)
    const randomBonus = 1 + Math.floor(Math.random() * 5)
    score += randomBonus

    return {
      product: candidate,
      score,
      reasons
    }
  }

  /**
   * Находит общие характеристики между двумя товарами
   */
  private findCommonSpecifications(product1: Prosthetic, product2: Prosthetic): string[] {
    const specs1 = product1.specifications || []
    const specs2 = product2.specifications || []

    const common: string[] = []

    specs1.forEach(spec1 => {
      const matchingSpec = specs2.find(spec2 =>
        spec2.spec_name === spec1.spec_name &&
        spec2.spec_value === spec1.spec_value
      )
      if (matchingSpec) {
        common.push(spec1.spec_name)
      }
    })

    return common
  }

  /**
   * Вычисляет схожесть цен (возвращает 0-15 баллов)
   */
  private calculatePriceSimilarity(product1: Prosthetic, product2: Prosthetic): number {
    const price1 = product1.price || product1.discount_price || 0
    const price2 = product2.price || product2.discount_price || 0

    if (price1 === 0 || price2 === 0) return 0

    const priceDiff = Math.abs(price1 - price2)
    const avgPrice = (price1 + price2) / 2
    const diffPercentage = priceDiff / avgPrice

    // Чем меньше разница в процентах, тем выше оценка
    if (diffPercentage <= 0.1) return 15      // До 10% разницы
    if (diffPercentage <= 0.2) return 10      // До 20% разницы
    if (diffPercentage <= 0.3) return 5       // До 30% разницы

    return 0
  }

  /**
   * Проверяет доступность товара
   */
  private isProductAvailable(product: Prosthetic): boolean {
    // Проверяем различные поля, которые могут указывать на наличие
    return Boolean(product.inStock) &&
           product.stock_status !== 'out_of_stock' &&
           (product.stock_quantity === undefined || product.stock_quantity > 0)
  }

  /**
   * Получить товары из разных категорий
   */
  getDifferentCategoryProducts(currentProduct: Prosthetic, limit: number = 4): Prosthetic[] {
    const currCat = this.getCategory(currentProduct)
    return this.products
      .filter(p => {
        // Исключаем текущий товар и товары той же категории
        return (String(p.id) !== String(currentProduct.id) && p.id !== currentProduct.id) && 
               this.getCategory(p) !== currCat
      })
      .sort(() => 0.5 - Math.random()) // Случайная сортировка
      .slice(0, limit)
  }

  /**
   * Получить смешанные рекомендации с разными алгоритмами
   */
  getMixedRecommendations(currentProduct: Prosthetic, limit: number = 6): {
    type: 'smart' | 'category' | 'manufacturer' | 'price' | 'diverse'
    products: Prosthetic[]
    title: string
  }[] {
    const recommendations = []

    // 1. Умные рекомендации (40% от лимита)
    const smartLimit = Math.max(1, Math.ceil(limit * 0.4))
    const smartRecs = this.getRecommendations(currentProduct, smartLimit * 2) // Берем больше для лучшего выбора
    if (smartRecs.length > 0) {
      // Фильтруем и перемешиваем для разнообразия
      const filteredSmart = smartRecs
        .filter(rec => rec.score > 15) // Снижено с 20 до 15 для большего разнообразия
        .slice(0, smartLimit)
        .map(rec => rec.product)

      if (filteredSmart.length > 0) {
        recommendations.push({
          type: 'smart' as const,
          products: this.shuffleArray(filteredSmart),
          title: 'Рекомендуем для вас'
        })
      }
    }

    // 2. Товары той же категории (20% от лимита - уменьшено с 30%)
    const categoryLimit = Math.max(1, Math.ceil(limit * 0.2))
    const categoryRecs = this.getSameCategoryProducts(currentProduct, categoryLimit * 2)
    if (categoryRecs.length > 0) {
      // Исключаем товары, уже включенные в умные рекомендации, и текущий товар
      const usedIds = new Set([
        ...smartRecs.map(r => String(r.product.id)),
        String(currentProduct.id)
      ])
      const filteredCategory = categoryRecs
        .filter(product => !usedIds.has(String(product.id)) && 
                          String(product.id) !== String(currentProduct.id))
        .slice(0, categoryLimit)

      if (filteredCategory.length > 0) {
        recommendations.push({
          type: 'category' as const,
          products: this.shuffleArray(filteredCategory),
          title: `Другие товары в категории "${currentProduct.category_name || currentProduct.category}"`
        })
      }
    }

    // 3. Товары того же производителя (20% от лимита)
    const manufacturerLimit = Math.max(1, Math.ceil(limit * 0.2))
    const manufacturerRecs = this.getSameManufacturerProducts(currentProduct, manufacturerLimit * 2)
    if (manufacturerRecs.length > 0) {
      // Исключаем уже использованные товары и текущий товар
      const usedIds = new Set([
        ...smartRecs.map(r => String(r.product.id)),
        ...categoryRecs.map(p => String(p.id)),
        String(currentProduct.id)
      ])
      const filteredManufacturer = manufacturerRecs
        .filter(product => !usedIds.has(String(product.id)) && 
                          String(product.id) !== String(currentProduct.id))
        .slice(0, manufacturerLimit)

      if (filteredManufacturer.length > 0) {
        const manufacturerName = currentProduct.manufacturer_name || currentProduct.manufacturer
        recommendations.push({
          type: 'manufacturer' as const,
          products: this.shuffleArray(filteredManufacturer),
          title: `Другие товары ${manufacturerName}`
        })
      }
    }

    // 4. Товары из других категорий (20% от лимита)
    const diverseLimit = Math.max(1, Math.ceil(limit * 0.2))
    const diverseRecs = this.getDifferentCategoryProducts(currentProduct, diverseLimit * 2)
    if (diverseRecs.length > 0) {
      // Исключаем уже использованные товары и текущий товар
      const usedIds = new Set([
        ...smartRecs.map(r => String(r.product.id)),
        ...categoryRecs.map(p => String(p.id)),
        ...manufacturerRecs.map(p => String(p.id)),
        String(currentProduct.id)
      ])
      const filteredDiverse = diverseRecs
        .filter(product => !usedIds.has(String(product.id)) && 
                          String(product.id) !== String(currentProduct.id))
        .slice(0, diverseLimit)

      if (filteredDiverse.length > 0) {
        recommendations.push({
          type: 'diverse' as const,
          products: this.shuffleArray(filteredDiverse),
          title: 'Вам также может понравиться'
        })
      }
    }

    return recommendations
  }

  /**
   * Перемешивает массив для разнообразия
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

/**
 * Хук для использования системы рекомендаций
 */
export function useRecommendations(products: Prosthetic[]) {
  const engine = new RecommendationEngine(products)

  return {
    getRecommendations: (currentProduct: Prosthetic, limit?: number) =>
      engine.getRecommendations(currentProduct, limit),
    getSameCategoryProducts: (currentProduct: Prosthetic, limit?: number) =>
      engine.getSameCategoryProducts(currentProduct, limit),
    getSameManufacturerProducts: (currentProduct: Prosthetic, limit?: number) =>
      engine.getSameManufacturerProducts(currentProduct, limit),
    getMixedRecommendations: (currentProduct: Prosthetic, limit?: number) =>
      engine.getMixedRecommendations(currentProduct, limit)
  }
}