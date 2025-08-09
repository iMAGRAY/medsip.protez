"use client"

import { SafeImage } from "@/components/safe-image"
import { CustomDialog, CustomDialogContent, CustomDialogDescription, CustomDialogHeader, CustomDialogTitle } from "@/components/ui/custom-dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ProductRecommendationsSidebar } from "@/components/product-recommendations"
import { ProductVariantSelectorModal } from "@/components/product-variant-selector-modal"

import { useAdminStore } from "@/lib/admin-store"
import type { Prosthetic } from "@/lib/data"
import { Package, Clock, Shield, Tag, ChevronLeft, ChevronRight, X, Building } from "lucide-react"
import { useState, useMemo } from "react"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { isProductOutOfStock, isProductAvailable, getActualPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"

interface ProductQuickViewProps {
  product: Prosthetic | null
  isOpen: boolean
  onClose: () => void
  onProductChange?: (product: Prosthetic) => void
}

interface ProductVariant {
  id: number
  productId: number
  sizeName: string
  sizeValue?: string
  name?: string
  description?: string
  sku?: string
  price?: number
  discountPrice?: number
  stockQuantity?: number
  weight?: number
  dimensions?: any
  specifications?: any
  isAvailable: boolean
  sortOrder?: number
  imageUrl?: string
  images?: string[]
  warranty?: string
  batteryLife?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  isFeatured?: boolean
  isNew?: boolean
  isBestseller?: boolean
  customFields?: any
  characteristics?: any[]
  selectionTables?: any[]
}



export function ProductQuickView({ product, isOpen, onClose, onProductChange }: ProductQuickViewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const { addItem } = useCart()
  const { products } = useAdminStore()

  // Получаем изображения из выбранного варианта или товара
  const images = useMemo(() => {
    if (!product) return []
    
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images
    }
    if (selectedVariant?.imageUrl) {
      return [selectedVariant.imageUrl]
    }
    return product.images || (product.imageUrl ? [product.imageUrl] : [])
  }, [selectedVariant, product])

  // Вычисляем актуальную цену с учетом выбранного варианта
  const actualPrice = useMemo(() => {
    if (!product) return null
    
    if (selectedVariant) {
      return selectedVariant.discountPrice || selectedVariant.price || null
    }
    return getActualPrice(product)
  }, [selectedVariant, product])

  // Проверяем доступность с учетом выбранного варианта
  const isAvailable = useMemo(() => {
    if (!product) return false
    
    if (selectedVariant) {
      return selectedVariant.isAvailable && !isProductOutOfStock(selectedVariant as any)
    }
    return isProductAvailable(product)
  }, [selectedVariant, product])

  if (!product) return null

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleAddToCart = () => {
    if (!product) return
    
    const itemToAdd = {
      id: selectedVariant ? `${String(product.id)}-${selectedVariant.id}` : String(product.id),
      name: selectedVariant?.name || product.name,
      price: actualPrice || 0, // Используем 0 как fallback для null
      image_url: images[0] || '',
      category: product.category_name || product.category || '',
      sku: selectedVariant?.sku || product.sku || '',
      article_number: product.article_number || '',
      is_on_request: product.show_price === false || (!actualPrice),
      show_price: product.show_price,
      variant_id: selectedVariant?.id,
      variant_name: selectedVariant?.sizeName
    }
    
    addItem(itemToAdd)
    onClose()
  }

  const handleRecommendationSelect = (recommendedProduct: Prosthetic) => {
    // Сбрасываем состояние при переключении на другой товар
    setSelectedVariant(null)
    setCurrentImageIndex(0)
    
    // Сначала закрываем модальное окно
    onClose()
    
    // Небольшая задержка для завершения анимации закрытия
    setTimeout(() => {
      if (onProductChange) {
        onProductChange(recommendedProduct)
      }
    }, 100)
  }

  return (
    <CustomDialog open={isOpen} onOpenChange={onClose}>
      <CustomDialogContent className="max-w-4xl w-full sm:w-[95vw] max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto overflow-hidden flex flex-col p-0">
        {/* Заголовок с кнопкой закрытия */}
        <div className="relative flex-shrink-0 p-3 sm:p-4 lg:p-6 pb-2 sm:pb-4 border-b">
          <button
            onClick={onClose}
            className="absolute top-1 right-1 sm:top-2 sm:right-2 lg:top-3 lg:right-3 p-1.5 sm:p-2 rounded-full bg-gradient-to-r from-cyan-100/50 to-blue-100/50 text-cyan-700 hover:from-cyan-200/50 hover:to-blue-200/50 transition-all duration-300 hover:scale-110 z-10"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <CustomDialogHeader className="pr-8 sm:pr-10">
            <CustomDialogTitle className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-slate-800 line-clamp-2">
              {selectedVariant?.name || product.name}
            </CustomDialogTitle>
            <CustomDialogDescription className="text-xs sm:text-sm lg:text-base hidden sm:block">
              Быстрый просмотр характеристик и выбор вариантов товара
            </CustomDialogDescription>
          </CustomDialogHeader>
        </div>

        {/* Прокручиваемый контент */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {/* Основной контент товара */}
            <div className="xl:col-span-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <div className="space-y-2 sm:space-y-3 lg:space-y-4">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                    <SafeImage
                      src={images[currentImageIndex] || PROSTHETIC_FALLBACK_IMAGE}
                      alt={selectedVariant?.name || product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />

                    {/* Image navigation */}
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-1 sm:left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-1.5 sm:p-2 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-1.5 sm:p-2 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </>
                    )}

                    {/* Статус наличия - скрыто, так как все товары доступны для заказа */}
                    {/* {!isAvailable && (
                      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                        <Badge className="bg-slate-500 text-white border-0 px-4 py-2 text-sm font-medium shadow-lg">
                          Нет в наличии
                        </Badge>
                      </div>
                    )} */}
                  </div>

                  {/* Image thumbnails */}
                  {images.length > 1 && (
                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-md overflow-hidden border-2 ${
                            index === currentImageIndex ? "border-gray-500" : "border-slate-200"
                          }`}
                        >
                          <SafeImage
                            src={image || PROSTHETIC_FALLBACK_IMAGE}
                            alt={`${selectedVariant?.name || product.name} ${index + 1}`}
                            width={64}
                            height={64}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Селектор вариантов */}
                  {product.has_variants && (
                    <div className="pt-1 sm:pt-2">
                      <ProductVariantSelectorModal
                        productId={product.id}
                        masterProduct={{
                          id: product.id,
                          name: product.name,
                          primary_image_url: images[0] || product.imageUrl || product.image_url || '',
                          price: product.price,
                          discount_price: product.discount_price,
                          in_stock: (product as any).in_stock ?? (product as any).inStock ?? true,
                          stock_quantity: product.stock_quantity ?? 0,
                          warranty: product.warranty,
                          batteryLife: product.batteryLife
                        }}
                        onVariantChange={(variant) => {
                          if (variant) {
                            // Преобразуем формат данных из V2 в старый формат
                            const transformedVariant = {
                              id: variant.id,
                              productId: variant.master_id,
                              sizeName: variant.name || variant.attributes?.size || 'Вариант',
                              sizeValue: variant.attributes?.size_value || '',
                              name: variant.name,
                              description: variant.description,
                              sku: variant.sku,
                              price: variant.price,
                              discountPrice: variant.discount_price,
                              stockQuantity: variant.stock_quantity,
                              weight: variant.weight,
                              dimensions: { width: variant.width, height: variant.height, length: variant.length },
                              specifications: variant.attributes?.specifications,
                              isAvailable: variant.in_stock,
                              sortOrder: 0,
                              imageUrl: variant.primary_image_url,
                              images: variant.images || [],
                              warranty: variant.warranty_months ? `${variant.warranty_months} месяцев` : undefined,
                              batteryLife: variant.battery_life_hours ? `${variant.battery_life_hours} часов` : undefined,
                              characteristics: variant.characteristics || variant.attributes?.characteristics,
                              selectionTables: []
                            }
                            setSelectedVariant(transformedVariant)
                          } else {
                            setSelectedVariant(null)
                          }
                        }}
                        className="bg-white/60 backdrop-blur-sm rounded-lg border border-cyan-200/30"
                      />
                    </div>
                  )}



                  {/* Цена и кнопка добавления в заявку */}
                  <div className="pt-1 sm:pt-2 space-y-2 sm:space-y-3 bg-white/60 backdrop-blur-sm rounded-lg border border-cyan-200/30 p-2 sm:p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      {product.show_price === false || !actualPrice ? (
                        <span className="text-base sm:text-lg lg:text-xl font-bold text-slate-600">
                          По запросу
                        </span>
                      ) : selectedVariant && selectedVariant.discountPrice && selectedVariant.price && selectedVariant.discountPrice < selectedVariant.price ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="text-base sm:text-lg lg:text-xl font-bold text-cyan-600">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(selectedVariant.discountPrice)}
                          </span>
                          <span className="text-xs sm:text-sm line-through text-slate-400">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(selectedVariant.price)}
                          </span>
                        </div>
                      ) : product.discount_price && product.price && product.discount_price < product.price ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="text-base sm:text-lg lg:text-xl font-bold text-cyan-600">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.discount_price)}
                          </span>
                          <span className="text-xs sm:text-sm line-through text-slate-400">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.price)}
                          </span>
                        </div>
                      ) : actualPrice ? (
                        <span className="text-base sm:text-lg lg:text-xl font-bold text-slate-800">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(actualPrice)}
                        </span>
                      ) : (
                        <span className="text-base sm:text-lg lg:text-xl font-bold text-slate-600">
                          По запросу
                        </span>
                      )}
                    </div>

                    {/* Кнопка добавления в заявку */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Button
                        onClick={handleAddToCart}
                        className="w-full px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 rounded-lg font-medium"
                      >
                        <span>Добавить в заявку</span>
                      </Button>

                      {/* Кнопка Подробнее */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          onClose(); // Закрываем модальное окно
                          window.location.href = `/products/${product.id}`; // Переходим на страницу товара в той же вкладке
                        }}
                        className="w-full px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base border-cyan-300 bg-white/80 hover:bg-cyan-50 text-cyan-700 transition-all duration-300 rounded-lg font-medium"
                      >
                        <span>Подробнее</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <Badge variant="outline" className="border-teal-200 text-teal-600 text-[10px] sm:text-xs lg:text-sm">
                      <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                      {product.category_name || product.category}
                    </Badge>
                    {product.manufacturer && (
                      <Badge variant="outline" className="border-purple-200 text-purple-600 text-[10px] sm:text-xs lg:text-sm">
                        <Building className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                        {product.manufacturer}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-1.5 sm:mb-2 text-slate-800">Описание</h3>
                    <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {selectedVariant?.description || product.description || "Описание товара отсутствует"}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2 sm:mb-3 text-slate-800">Характеристики</h3>
                    <div className="space-y-1.5 sm:space-y-2">
                      {product.warranty && (
                        <div className="flex items-center text-xs sm:text-sm lg:text-base text-slate-600 bg-gradient-to-r from-green-50 to-emerald-50 p-1.5 sm:p-2 rounded-lg border border-green-200/50">
                          <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-green-600" />
                          <span className="font-medium text-green-700">Гарантия:</span>
                          <span className="ml-1">{product.warranty}</span>
                        </div>
                      )}
                      {product.batteryLife && (
                        <div className="flex items-center text-xs sm:text-sm lg:text-base text-slate-600 bg-gradient-to-r from-blue-50 to-sky-50 p-1.5 sm:p-2 rounded-lg border border-blue-200/50">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-blue-600" />
                          <span className="font-medium text-blue-700">Время работы:</span>
                          <span className="ml-1">{product.batteryLife}</span>
                        </div>
                      )}
                      {product.weight && (
                        <div className="flex items-center text-xs sm:text-sm lg:text-base text-slate-600 bg-gradient-to-r from-orange-50 to-amber-50 p-1.5 sm:p-2 rounded-lg border border-orange-200/50">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-orange-600" />
                          <span className="font-medium text-orange-700">Вес:</span>
                          <span className="ml-1">{product.weight} г</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                </div>
              </div>
            </div>

            {/* Боковая панель с рекомендациями - скрыта на мобильных */}
            <div className="hidden xl:block">
              <div className="sticky top-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
                <h3 className="text-base lg:text-lg font-semibold mb-3 lg:mb-4 text-slate-800">
                  Рекомендуем также
                </h3>
                <ProductRecommendationsSidebar
                  currentProduct={product}
                  allProducts={products}
                  onProductSelect={handleRecommendationSelect}
                />
              </div>
            </div>
          </div>

          {/* Рекомендации для мобильных устройств */}
          <div className="xl:hidden mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
            <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 text-slate-800">
              Рекомендуем также
            </h3>
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <ProductRecommendationsSidebar
                currentProduct={product}
                allProducts={products}
                onProductSelect={handleRecommendationSelect}
                className="flex gap-2 pb-2"
              />
            </div>
          </div>
        </div>
      </CustomDialogContent>
    </CustomDialog>
  )
}
