"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Package,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Tag,
  Ruler,
  Battery,
  Shield,
  Search,
  Grid3X3,
  List,
  LayoutGrid,
  Square,
  Filter,
  RussianRuble
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"

interface ModelLine {
  id: number
  name: string
  description: string | null
  manufacturer_id: number
  manufacturer_name: string
  launch_year: number | null
  is_active: boolean
}

interface Product {
  id: number
  name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  model_line_id: number
  model_line_name: string
  manufacturer_name: string
  price: number | null
  weight: number | null
  battery_life: string | null
  warranty: string | null
  in_stock: boolean
  image_url: string | null
  primary_image_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export default function ModelLineProductsPage() {
  const params = useParams()
  const router = useRouter()
  const modelLineId = params?.id as string

  const [modelLine, setModelLine] = useState<ModelLine | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'large' | 'small'>('grid')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<{id: number, name: string}[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: 'null',
    in_stock: true,
    is_active: true,
    image_url: ''
  })

  useEffect(() => {
    loadData()
  }, [modelLineId])

          // Фильтрация товаров по поисковому запросу
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products)
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredProducts(filtered)
    }
  }, [products, searchQuery])

  // Загрузка категорий для выпадающего списка
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        const data = await response.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch (error) {
        console.error('Ошибка загрузки категорий:', error)
      }
    }

    loadCategories()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)

      const response = await fetch(`/api/model-lines/${modelLineId}/products`)

      const data = await response.json()

      if (data.success) {
        setModelLine(data.data.modelLine)
        setProducts(data.data.products || [])
        setFilteredProducts(data.data.products || [])

      } else {
        console.error('Ошибка API:', data.error)
        setMessage({ type: 'error', text: data.error || 'Ошибка загрузки данных' })
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить товар "${name}"? Это действие нельзя отменить.`)) {
      return
    }

    try {
      // Оптимистично удаляем из UI
      const currentProducts = products.filter(p => p.id !== id);
      setProducts(currentProducts);
      setFilteredProducts(currentProducts);

      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Товар удален' })

        // Принудительно перезагружаем данные для полной синхронизации
        setTimeout(() => {
          loadData();
        }, 200);
      } else {
        // Возвращаем товар в список при ошибке
        loadData();
        setMessage({ type: 'error', text: data.error || 'Ошибка удаления' })
      }
    } catch (_error) {
      // Возвращаем товар в список при ошибке
      loadData();
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'Цена не указана'
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price)
  }

  const openCreateDialog = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: 'null',
      in_stock: true,
      is_active: true,
      image_url: ''
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Название товара обязательно для заполнения' })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: formData.price ? parseFloat(formData.price) : null,
          category_id: formData.category_id && formData.category_id !== "null" ? parseInt(formData.category_id) : null,
          series_id: parseInt(modelLineId),
          manufacturer_id: modelLine?.manufacturer_id,
          in_stock: formData.in_stock,
          is_active: formData.is_active,
          image_url: formData.image_url.trim() || null
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Товар успешно создан' })
        setIsDialogOpen(false)
        loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка создания товара' })
      }
    } catch (error) {
      console.error('Error creating product:', error)
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Компонент для отображения продуктов в виде сетки (по умолчанию)
  const GridView = ({ products }: { products: Product[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          {/* Product Image */}
          <div className="h-48 bg-slate-50 flex items-center justify-center">
            {product.primary_image_url || product.image_url ? (
              <img
                src={product.primary_image_url || product.image_url || ''}
                alt={product.name}
                className="max-h-full max-w-full object-contain p-4"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            ) : (
              <Package className="w-16 h-16 text-slate-300" />
            )}
          </div>

          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Просмотр продукта">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Редактировать">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteProduct(product.id, product.name)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Status & Category */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={product.is_active ? "default" : "secondary"}>
                {product.is_active ? "Активен" : "Неактивен"}
              </Badge>
              <Badge variant={product.in_stock ? "outline" : "destructive"}>
                {product.in_stock ? "В наличии" : "Нет в наличии"}
              </Badge>
              {product.category_name && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {product.category_name}
                </Badge>
              )}
            </div>

            {/* Price */}
            {product.price && (
              <div className="flex items-center gap-2 text-lg font-semibold text-teal-600">
                <RussianRuble className="h-4 w-4" />
                {formatPrice(product.price)}
              </div>
            )}

            {/* Specifications */}
            <div className="space-y-2 text-sm">
              {product.weight && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Ruler className="h-4 w-4" />
                  Вес: {product.weight} кг
                </div>
              )}

              {product.battery_life && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Battery className="h-4 w-4" />
                  Батарея: {product.battery_life}
                </div>
              )}

              {product.warranty && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="h-4 w-4" />
                  Гарантия: {product.warranty}
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-slate-700 line-clamp-3">
                {product.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Компонент для отображения продуктов списком
  const ListView = ({ products }: { products: Product[] }) => (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Image */}
              <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-lg flex-shrink-0">
                {product.primary_image_url || product.image_url ? (
                  <img
                    src={product.primary_image_url || product.image_url || ''}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain p-2"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <Package className="w-8 h-8 text-slate-300" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-slate-600 line-clamp-2 mt-1">{product.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Активен" : "Неактивен"}
                      </Badge>
                      <Badge variant={product.in_stock ? "outline" : "destructive"}>
                        {product.in_stock ? "В наличии" : "Нет в наличии"}
                      </Badge>
                      {product.category_name && (
                        <Badge variant="outline">{product.category_name}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {product.price && (
                      <div className="text-lg font-semibold text-teal-600 mr-4">
                        {formatPrice(product.price)}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Просмотр">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Редактировать">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Компонент для отображения больших карточек
  const LargeView = ({ products }: { products: Product[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {products.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          {/* Large Image */}
          <div className="h-64 bg-slate-50 flex items-center justify-center">
            {product.primary_image_url || product.image_url ? (
              <img
                src={product.primary_image_url || product.image_url || ''}
                alt={product.name}
                className="max-h-full max-w-full object-contain p-6"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            ) : (
              <Package className="w-24 h-24 text-slate-300" />
            )}
          </div>

          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl">{product.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Просмотр">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Редактировать">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteProduct(product.id, product.name)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status & Category */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={product.is_active ? "default" : "secondary"}>
                {product.is_active ? "Активен" : "Неактивен"}
              </Badge>
              <Badge variant={product.in_stock ? "outline" : "destructive"}>
                {product.in_stock ? "В наличии" : "Нет в наличии"}
              </Badge>
              {product.category_name && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {product.category_name}
                </Badge>
              )}
            </div>

            {/* Price */}
            {product.price && (
              <div className="flex items-center gap-2 text-xl font-semibold text-teal-600">
                <RussianRuble className="h-5 w-5" />
                {formatPrice(product.price)}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-slate-700">{product.description}</p>
            )}

            {/* Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {product.weight && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Ruler className="h-4 w-4" />
                  Вес: {product.weight} кг
                </div>
              )}

              {product.battery_life && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Battery className="h-4 w-4" />
                  Батарея: {product.battery_life}
                </div>
              )}

              {product.warranty && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="h-4 w-4" />
                  Гарантия: {product.warranty}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Компонент для отображения маленьких карточек
  const SmallView = ({ products }: { products: Product[] }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {products.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          {/* Small Image */}
          <div className="h-32 bg-slate-50 flex items-center justify-center">
            {product.primary_image_url || product.image_url ? (
              <img
                src={product.primary_image_url || product.image_url || ''}
                alt={product.name}
                className="max-h-full max-w-full object-contain p-2"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            ) : (
              <Package className="w-8 h-8 text-slate-300" />
            )}
          </div>

          <CardContent className="p-3">
            <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 mb-2">{product.name}</h3>

            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                  {product.is_active ? "Активен" : "Неактивен"}
                </Badge>
                <Badge variant={product.in_stock ? "outline" : "destructive"} className="text-xs">
                  {product.in_stock ? "В наличии" : "Нет в наличии"}
                </Badge>
              </div>

              {product.price && (
                <div className="text-sm font-semibold text-teal-600">
                  {formatPrice(product.price)}
                </div>
              )}

              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Просмотр">
                  <Eye className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="Редактировать">
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteProduct(product.id, product.name)}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  title="Удалить"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Button>

          <div className="flex-1">
            {modelLine && (
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {modelLine.name}
                </h1>
                <p className="text-slate-600 mt-1">
                  Товары модельного ряда • {modelLine.manufacturer_name}
                </p>
              </div>
            )}
          </div>

          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={openCreateDialog}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить товар
          </Button>
        </div>

        {/* Messages */}
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="text-slate-600 mt-2">Загрузка товаров...</p>
          </div>
        )}

        {/* Model Line Info */}
        {!isLoading && modelLine && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Информация о модельном ряде
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-600">Производитель</dt>
                  <dd className="text-sm text-slate-900">{modelLine.manufacturer_name}</dd>
                </div>

                {modelLine.launch_year && (
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Год запуска</dt>
                    <dd className="text-sm text-slate-900">{modelLine.launch_year}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-slate-600">Статус</dt>
                  <dd>
                    <Badge variant={modelLine.is_active ? "default" : "secondary"}>
                      {modelLine.is_active ? "Активен" : "Неактивен"}
                    </Badge>
                  </dd>
                </div>
              </div>

              {modelLine.description && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-slate-600 mb-1">Описание</dt>
                  <dd className="text-sm text-slate-900">{modelLine.description}</dd>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Products Section */}
        {!isLoading && (
          <div className="space-y-6">
            {/* Header with Search and View Controls */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      Товары ({filteredProducts.length} из {products.length})
                    </h2>

                    {/* Search */}
                    <div className="relative max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Поиск товаров..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* View Mode Controls */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 mr-2">Вид:</span>
                    <div className="flex rounded-lg border border-slate-300 p-1">
                      <Button
                        variant={viewMode === 'small' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('small')}
                        className="h-8 px-2"
                        title="Маленькие карточки"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="h-8 px-2"
                        title="Сетка"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'large' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('large')}
                        className="h-8 px-2"
                        title="Большие карточки"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-8 px-2"
                        title="Список"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Search Results Info */}
                {searchQuery && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        {filteredProducts.length > 0
                          ? `Найдено ${filteredProducts.length} товаров по запросу "${searchQuery}"`
                          : `Ничего не найдено по запросу "${searchQuery}"`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products Display */}
            {filteredProducts.length > 0 ? (
              <div>
                {viewMode === 'grid' && <GridView products={filteredProducts} />}
                {viewMode === 'list' && <ListView products={filteredProducts} />}
                {viewMode === 'large' && <LargeView products={filteredProducts} />}
                {viewMode === 'small' && <SmallView products={filteredProducts} />}
              </div>
            ) : searchQuery ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Ничего не найдено
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Попробуйте изменить поисковый запрос или очистить фильтры
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                  >
                    Очистить поиск
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Товары не найдены
                  </h3>
                  <p className="text-slate-600 mb-4">
                    В этом модельном ряду пока нет товаров
                  </p>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={openCreateDialog}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить первый товар
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Create Product Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Создать товар</DialogTitle>
              <DialogDescription>
                Добавьте новый товар в модельный ряд {modelLine?.name}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите название товара"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание товара (необязательно)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Цена</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Цена товара"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Категория</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Без категории</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="in_stock">Наличие</Label>
                  <Select
                    value={formData.in_stock ? "true" : "false"}
                    onValueChange={(value) => setFormData({ ...formData, in_stock: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">В наличии</SelectItem>
                      <SelectItem value="false">Нет в наличии</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="is_active">Статус</Label>
                  <Select
                    value={formData.is_active ? "true" : "false"}
                    onValueChange={(value) => setFormData({ ...formData, is_active: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Активен</SelectItem>
                      <SelectItem value="false">Неактивен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">URL изображения</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="URL изображения товара (необязательно)"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {isSubmitting ? 'Создание...' : 'Создать'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}