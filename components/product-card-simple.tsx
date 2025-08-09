"use client"

import type React from "react"
import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Prosthetic } from "@/lib/data"
import { Eye, Plus } from "lucide-react"
import { InstantLink } from "@/components/instant-link"
import { useState } from "react"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { useCart } from "@/lib/cart-context"
import { isProductOutOfStock, isProductAvailable, getActualPrice } from "@/lib/utils"
import Link from "next/link"
import { ProductTagsDisplay } from "@/components/product-tags-display"

interface ProductCardSimpleProps {
  product: Prosthetic & {
    variants?: Array<{
      id: number
      price?: number
      discountPrice?: number
      isAvailable: boolean
    }>
  }
  onQuickView: (product: Prosthetic) => void
  className?: string
}

export function ProductCardSimple({ product, onQuickView, className = "" }: ProductCardSimpleProps) {
  const { addItem } = useCart()
  const { items } = useCart()

  const inCart = items.some((item) => item.id === product.id)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    addItem({
      id: String(product.id),
      name: product.name,
      price: getActualPrice(product),
      image_url: product.imageUrl || product.image_url || (product.images && product.images.length > 0 ? product.images[0] : '') || '',
      category: product.category_name || product.category || '',
      sku: product.sku || '',
      article_number: product.article_number || '',
      is_on_request: product.show_price === false || (!product.price && !product.discount_price),
      show_price: product.show_price
    })
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onQuickView(product)
  }

  const handleQuickViewTouch = (e: React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onQuickView(product)
  }

  return (
    <div className={`group relative ${className}`}>
      {/* Фоновый градиент */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/30 to-blue-100/40 rounded-xl blur-sm transform group-hover:scale-105 transition-transform duration-300"></div>

      <div className="relative flex flex-col h-full min-h-[350px] overflow-hidden bg-white/90 backdrop-blur-lg border border-cyan-200/50 rounded-xl shadow-lg shadow-cyan-100/20 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-200/30 hover:border-cyan-300/60">

        {/* Изображение */}
        <div className="relative w-full aspect-square bg-gradient-to-br from-cyan-50 to-blue-50 overflow-hidden">
          <SafeImage
            src={product.imageUrl || product.image_url || (product.images && product.images.length > 0 ? product.images[0] : null) || PROSTHETIC_FALLBACK_IMAGE}
                            alt={product.short_name || product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
          />

          {/* Элегантный overlay градиент */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/20 via-transparent to-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Кнопка быстрого просмотра */}
          <div className="absolute top-3 right-3">
            <button
              onClick={handleQuickView}
              onTouchEnd={handleQuickViewTouch}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-cyan-200/50 text-cyan-700 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-cyan-50 hover:scale-110 touch-manipulation"
              aria-label="Быстрый просмотр"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Статус наличия - скрыто, так как все товары доступны для заказа */}
          {/* {isProductOutOfStock(product) && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
              <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 px-4 py-2 text-sm font-medium shadow-lg">
                Нет в наличии
              </Badge>
            </div>
          )} */}
        </div>

        {/* Серая линия между изображением и контентом */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>

        {/* Контент */}
        <div className="flex flex-col flex-grow p-3">
          {/* Заголовок - ссылка на страницу товара */}
          <InstantLink
            href={`/products/${product.id}`}
            className="block text-base sm:text-base font-semibold text-slate-800 line-clamp-2 mb-2 min-h-[2.5rem] leading-tight hover:text-cyan-700 transition-colors touch-manipulation"
          >
            {product.short_name || product.name}
          </InstantLink>

          {/* Категория */}
          <div className="mb-3">
            <Badge
              variant="outline"
              className="text-xs border-cyan-200 text-cyan-600 bg-cyan-50/50"
            >
              {product.category_name || product.category}
            </Badge>
          </div>

          {/* Теги товара */}
          <ProductTagsDisplay 
            productId={parseInt(String(product.id))} 
            variant="compact" 
            maxTags={2}
            className="mb-3"
          />

          {/* Цена */}
          <div className="mb-3 flex-grow flex items-end">
            {(() => {
              // Если есть варианты, показываем диапазон цен
              if (product.variants && product.variants.length > 0) {
                const availableVariants = product.variants.filter(v => v.isAvailable)
                if (availableVariants.length === 0) {
                  return <span className="text-base font-bold text-slate-600">Нет в наличии</span>
                }
                
                const prices = availableVariants.map(v => v.discountPrice || v.price || 0).filter(p => p > 0)
                if (prices.length === 0) {
                  return <span className="text-base font-bold text-slate-600">По запросу</span>
                }
                
                const minPrice = Math.min(...prices)
                const maxPrice = Math.max(...prices)
                
                if (minPrice === maxPrice) {
                  return (
                    <span className="text-base font-bold text-cyan-600 truncate block">
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0
                      }).format(minPrice)}
                    </span>
                  )
                } else {
                  return (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">от</span>
                      <span className="text-base font-bold text-cyan-600 truncate block">
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0
                        }).format(minPrice)}
                      </span>
                    </div>
                  )
                }
              }
              
              // Стандартная логика для товаров без вариантов
              if (product.show_price === false || (!product.price && !product.discount_price)) {
                return <span className="text-base font-bold text-slate-600">По запросу</span>
              } else if (product.price || product.discount_price) {
                if (product.discount_price && product.price && product.discount_price < product.price) {
                  return (
                    <div className="space-y-1">
                      <span className="text-base font-bold text-cyan-600 truncate block">
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0
                        }).format(product.discount_price)}
                      </span>
                      <span className="text-xs line-through text-slate-400 truncate block">
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0
                        }).format(product.price)}
                      </span>
                    </div>
                  )
                } else {
                  return (
                    <span className="text-base font-bold text-slate-800 truncate block">
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0
                      }).format((product.price || product.discount_price) ?? 0)}
                    </span>
                  )
                }
              } else {
                return <span className="text-base font-bold text-slate-600">По запросу</span>
              }
            })()}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2 sm:flex-row flex-col">
            {/* Кнопка добавления в заявку */}
            {!inCart && (
              <Button
                onClick={handleAddToCart}
                size="sm"
                className="w-full sm:flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 rounded-lg font-medium text-xs touch-manipulation"
              >
                В заявку
              </Button>
            )}

            {inCart && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const btn = document.getElementById('cart-button') as HTMLButtonElement | null
                  btn?.click()
                }}
                className="w-full sm:w-auto px-3 py-2 bg-cyan-100/60 border-cyan-300 text-cyan-700 hover:bg-cyan-200/60 transition-colors rounded-lg text-xs touch-manipulation"
              >
                В заявке
              </Button>
            )}

            {/* Кнопка подробнее - переход на страницу товара */}
            <Link
              href={`/products/${product.id}`}
              className="inline-flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-300 hover:shadow-lg touch-manipulation"
              onClick={(e) => e.stopPropagation()}
            >
              Подробнее
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}