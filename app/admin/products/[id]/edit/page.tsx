'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { ProductFormModern } from '@/components/admin/product-form-modern'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, AlertCircle, Shield } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAdminStore } from '@/lib/admin-store'
import { useAuth } from '@/components/admin/auth-guard'

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { loadProducts } = useAdminStore()

  const productId = params?.id as string

  // Проверяем права доступа
  const canUpdateProducts = hasPermission('products.update') || hasPermission('products.*') || hasPermission('*')

  // Если нет прав на редактирование продуктов, показываем сообщение об ошибке
  if (!canUpdateProducts) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="w-16 h-16 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Доступ запрещен</h2>
              <p className="text-gray-600 text-center">
                У вас нет прав для редактирования товаров
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) {
        setError('ID товара не указан')
        setLoading(false)
        return
      }

      try {

        const response = await fetch(`/api/products/${productId}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to load product')
        }

        setProduct(data.data)
      } catch (err) {
        console.error('❌ Error loading product:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load product'
        setError(errorMessage)
        toast.error(`Ошибка загрузки товара: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [productId])

  const handleSave = async (savedProduct: any, isManualSave?: boolean) => {

            // Обновляем данные товара в состоянии

    setProduct(savedProduct)

    // ОПТИМИЗАЦИЯ: Обновляем админ store только при ручном сохранении
    if (isManualSave !== false) {
    try {

      await loadProducts()

    } catch (err) {
      console.error('⚠️ Failed to refresh admin store:', err)
      }
    } else {

    }

    // Не делаем редирект - остаемся на странице редактирования
  }

  const handleCancel = () => {
    router.push('/admin/products')
  }

  if (loading) {
    return (
      <AdminLayout>
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Загрузка товара...</span>
            </div>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ошибка загрузки товара: {error}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  if (!product) {
    return (
      <AdminLayout>
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Товар не найден
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <ProductFormModern
        product={product}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </AdminLayout>
  )
}