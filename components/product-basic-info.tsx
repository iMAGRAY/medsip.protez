'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Building, Shield, FileText, ChevronDown } from "lucide-react"

interface ProductBasicInfoProps {
  product: {
    id: string
    name: string
    description?: string
    price?: number
    discount_price?: number
    weight?: string | number
    warranty?: string
    batteryLife?: string
    inStock?: boolean
    in_stock?: boolean
    category?: string
    category_name?: string
    category_full_path?: string
    manufacturer?: string
    manufacturer_name?: string
    model_line_name?: string
    show_price?: boolean
    stock_status?: string
    stock_quantity?: number
    article_number?: string
  }
}

export function ProductBasicInfo({ product }: ProductBasicInfoProps) {

  return (
    <Card className="w-full bg-white/80 backdrop-blur-sm border-cyan-200/40 shadow-lg shadow-cyan-100/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
          Основная информация
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Описание товара */}
        {product.description && (
          <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/30 rounded-xl border border-cyan-200/40 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-cyan-200/30 bg-gradient-to-r from-white/90 to-cyan-50/50">
              <h3 className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Описание товара
              </h3>
            </div>
            <div className="relative">
              <div className="p-4 max-h-60 sm:max-h-96 overflow-y-auto overflow-x-hidden">
                <div className="text-sm text-slate-700 leading-relaxed break-words max-w-full whitespace-pre-wrap"
                     style={{
                       wordWrap: 'break-word',
                       overflowWrap: 'break-word',
                       hyphens: 'none'
                     }}>
                  {product.description}
                </div>
              </div>
              {/* Индикатор скролла для мобильных */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none sm:hidden">
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                  <ChevronDown className="w-5 h-5 text-cyan-600 animate-bounce" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Basic info items */}
          {product.article_number && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/50 to-gray-50/30 rounded-lg border border-slate-200/30">
              <Package className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Артикул</p>
                <p className="text-xs text-slate-500">{product.article_number}</p>
              </div>
            </div>
          )}

          {(product.category_name || product.category_full_path) && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/50 to-gray-50/30 rounded-lg border border-slate-200/30">
              <Package className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Категория</p>
                <p className="text-xs text-slate-500">{product.category_full_path || product.category_name}</p>
              </div>
            </div>
          )}

          {product.manufacturer_name && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/50 to-gray-50/30 rounded-lg border border-slate-200/30">
              <Building className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Производитель</p>
                <p className="text-xs text-slate-500">{product.manufacturer_name}</p>
              </div>
            </div>
          )}

          {product.model_line_name && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/50 to-gray-50/30 rounded-lg border border-slate-200/30">
              <Package className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Модельная линия</p>
                <p className="text-xs text-slate-500">{product.model_line_name}</p>
              </div>
            </div>
          )}

          {product.weight && product.weight !== 'null' && product.weight !== 'undefined' && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50/50 to-gray-50/30 rounded-lg border border-slate-200/30">
              <Package className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">Вес</p>
                <p className="text-xs text-slate-500">{product.weight}</p>
              </div>
            </div>
          )}

          {product.warranty && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50/70 to-green-50/50 rounded-lg border border-emerald-200/40 shadow-sm">
              <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Гарантия</p>
                <p className="text-sm font-semibold text-emerald-700">{product.warranty}</p>
              </div>
            </div>
          )}


        </div>

      </CardContent>
    </Card>
  )
}