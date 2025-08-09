import { ProductCard } from "./product-card"
import { ProductCardList } from "./product-card-list"
import type { Prosthetic } from "@/lib/data"

interface ProductGridProps {
  products: Prosthetic[]
  view: "grid" | "list"
  onQuickView: (product: Prosthetic) => void
  isLoading?: boolean
}

// Компонент скелетона для карточки товара
function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full animate-pulse">
      {/* Изображение */}
      <div className="aspect-square w-full bg-slate-200"></div>

      {/* Контент */}
      <div className="p-4 space-y-3">
        {/* Название */}
        <div className="h-5 bg-slate-200 rounded w-3/4"></div>

        {/* Цена */}
        <div className="h-6 bg-slate-200 rounded w-1/3"></div>

        {/* Категория */}
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>

        {/* Кнопки */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 bg-slate-200 rounded w-full"></div>
        </div>
      </div>
    </div>
  )
}

// Компонент скелетона для списочного отображения товара
function ProductCardListSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="flex flex-col sm:flex-row">
        {/* Изображение */}
        <div className="w-full sm:w-48 h-48 bg-slate-200"></div>

        {/* Контент */}
        <div className="p-4 space-y-3 flex-1">
          {/* Название */}
          <div className="h-6 bg-slate-200 rounded w-3/4"></div>

          {/* Цена */}
          <div className="h-7 bg-slate-200 rounded w-1/4"></div>

          {/* Описание */}
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded w-4/6"></div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-2 pt-3">
            <div className="h-9 bg-slate-200 rounded w-32"></div>
            <div className="h-9 bg-slate-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProductGrid({ products, view, onQuickView, isLoading = false }: ProductGridProps) {
  // Если загрузка, показываем скелетоны
  if (isLoading) {
    if (view === "list") {
      return (
        <div className="space-y-6">
          {Array(4).fill(0).map((_, index) => (
            <ProductCardListSkeleton key={`skeleton-list-${index}`} />
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-8">
        {Array(8).fill(0).map((_, index) => (
          <ProductCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="relative">
        {/* Фоновый градиент */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/20 to-blue-100/30 rounded-2xl blur-sm"></div>

        <div className="relative text-center py-16 bg-white/60 backdrop-blur-lg rounded-2xl border border-cyan-200/40 shadow-lg shadow-cyan-100/20">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-full"></div>
          </div>
          <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
            Товары не найдены
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Попробуйте изменить поиск или фильтры, чтобы найти подходящие протезы
          </p>
        </div>
      </div>
    )
  }

  if (view === "list") {
    return (
      <div className="space-y-6">
        {products.map((product) => (
          <ProductCardList key={product.id} product={product} onQuickView={onQuickView} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-8">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onQuickView={onQuickView} />
      ))}
    </div>
  )
}
