"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Package,
  CheckCircle,
  X,
  AlertTriangle,
  Loader2
} from 'lucide-react'

interface Product {
  id: number
  name: string
  description: string
  category_id: number
  category_name: string
  manufacturer_id: number
  manufacturer_name: string
  model_line_id: number
  model_line_name: string
  article_number: string
  price: string
  is_active: boolean
  stock_quantity: number
  inventory_count: string
  total_warehouse_quantity: string
  has_warehouse_sku: boolean
}

interface ProductSelectorProps {
  selectedProduct?: Product
  onProductSelect: (product: Product | null) => void
  trigger?: React.ReactNode
}

export function ProductSelector({ selectedProduct, onProductSelect, trigger }: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [manufacturerFilter, setManufacturerFilter] = useState('all')
  const [showOnlyWithoutSku, setShowOnlyWithoutSku] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchProducts = async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: reset ? '1' : page.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(categoryFilter && categoryFilter !== 'all' && { category: categoryFilter }),
        ...(manufacturerFilter && manufacturerFilter !== 'all' && { manufacturer: manufacturerFilter }),
        ...(showOnlyWithoutSku && { with_inventory: 'false' })
      })

      const response = await fetch(`/api/warehouse/articles?${params}`)
      if (!response.ok) throw new Error('Ошибка загрузки товаров')

      const data = await response.json()

      if (reset) {
        setProducts(data.data || [])
        setPage(2)
      } else {
        setProducts(prev => [...prev, ...(data.data || [])])
        setPage(prev => prev + 1)
      }

      setHasMore(data.pagination?.page < data.pagination?.totalPages)
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error)
      setError(error instanceof Error ? error.message : 'Ошибка загрузки товаров')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchProducts(true)
    }
  }, [isOpen, searchTerm, categoryFilter, manufacturerFilter, showOnlyWithoutSku])

  const handleProductSelect = (product: Product) => {
    onProductSelect(product)
    setIsOpen(false)
  }

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(parseFloat(price))
  }

  const getAvailabilityBadge = (product: Product) => {
    if (product.has_warehouse_sku) {
      return <Badge variant="outline" className="text-xs">Уже на складе</Badge>
    }
    if (parseInt(product.stock_quantity.toString()) > 0) {
      return <Badge variant="default" className="text-xs">В наличии ({product.stock_quantity})</Badge>
    }
    return <Badge variant="destructive" className="text-xs">Нет в наличии</Badge>
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start">
            {selectedProduct ? (
              <div className="flex items-center gap-2 truncate">
                <Package className="w-4 h-4 text-green-600" />
                <span className="truncate">{selectedProduct.name}</span>
                <Badge variant="secondary" className="text-xs">{selectedProduct.article_number}</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span>Выбрать товар</span>
              </div>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Выбор товара для склада
          </DialogTitle>
          <DialogDescription>
            Выберите товар из каталога для добавления на склад
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Фильтры */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Поиск</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Название, артикул, описание..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Категория</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Все категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  <SelectItem value="Протезы рук">Протезы рук</SelectItem>
                  <SelectItem value="Протезы ног">Протезы ног</SelectItem>
                  <SelectItem value="Ортезы">Ортезы</SelectItem>
                  <SelectItem value="Компоненты">Компоненты</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="manufacturer">Производитель</Label>
              <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Все производители" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все производители</SelectItem>
                  <SelectItem value="Ottobock">Ottobock</SelectItem>
                  <SelectItem value="Ossur">Ossur</SelectItem>
                  <SelectItem value="Blatchford">Blatchford</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="withoutSku"
              checked={showOnlyWithoutSku}
              onChange={(e) => setShowOnlyWithoutSku(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="withoutSku" className="text-sm">
              Показать только товары без складских артикулов
            </Label>
          </div>

          {/* Список товаров */}
          <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
            {error ? (
              <div className="flex items-center justify-center p-8 text-red-600">
                <AlertTriangle className="w-6 h-6 mr-2" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProduct?.id === product.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleProductSelect(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <Package className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {product.name}
                              </h3>
                              {product.description && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {product.description}
                                </p>
                              )}

                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {product.article_number}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {product.category_name}
                                </Badge>
                                {product.manufacturer_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {product.manufacturer_name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {product.price && (
                            <span className="font-semibold text-gray-900">
                              {formatPrice(product.price)}
                            </span>
                          )}
                          {getAvailabilityBadge(product)}

                          {selectedProduct?.id === product.id && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Выбран</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {loading && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Загрузка товаров...</span>
                  </div>
                )}

                {!loading && hasMore && products.length > 0 && (
                  <div className="flex justify-center p-4">
                    <Button
                      variant="outline"
                      onClick={() => fetchProducts(false)}
                      disabled={loading}
                    >
                      Загрузить еще
                    </Button>
                  </div>
                )}

                {!loading && products.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                    <Package className="w-12 h-12 mb-4 text-gray-300" />
                    <p>Товары не найдены</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Попробуйте изменить фильтры поиска
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Отмена
          </Button>
          {selectedProduct && (
            <Button variant="outline" onClick={() => onProductSelect(null)}>
              <X className="w-4 h-4 mr-1" />
              Очистить выбор
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}