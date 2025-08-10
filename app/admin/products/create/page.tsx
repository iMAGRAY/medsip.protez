"use client"

import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/admin-layout'
import { ProductFormModern } from '@/components/admin/product-form-modern'
import { useAuth } from '@/components/admin/auth-guard'
import { Card, CardContent } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function CreateProductPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()

  // Проверяем права доступа
  const canCreateProducts = hasPermission('products.create') || hasPermission('products.*') || hasPermission('*')

  // Если нет прав на создание продуктов, показываем сообщение об ошибке
  if (!canCreateProducts) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="w-16 h-16 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Доступ запрещен</h2>
              <p className="text-gray-600 text-center">
                У вас нет прав для создания товаров
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  const handleSave = async (_savedProduct: any) => {

    // Принудительно обновляем список товаров в admin store
    try {
      const { useAdminStore } = await import('@/lib/admin-store')
      const adminStore = useAdminStore.getState()

      // Сначала очищаем кэш

      const { apiClient } = await import('@/lib/api-client')
      apiClient.clearCache()

      // Принудительно очищаем Redis кэш
      try {
        const response = await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patterns: [
              'medsip:products:*',
              'products:*',
              'product:*',
              'products-fast:*',
              'products-full:*',
              'products-detailed:*',
              'products-basic:*'
            ]
          })
        })

        if (response.ok) {

        }
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear cache via API:', cacheError)
      }

      // Используем метод принудительного обновления
      setTimeout(async () => {
        try {
          await adminStore.forceRefresh()

        } catch (refreshError) {
          console.error('❌ Error refreshing products after creation:', refreshError)
        }
      }, 500)
    } catch (storeError) {
      console.error('❌ Error accessing admin store:', storeError)
    }

    // Перенаправляем на страницу товаров с большей задержкой
    setTimeout(() => {
      router.push('/admin/products?refresh=true')
    }, 1000)
  }

  const handleCancel = () => {
    router.push('/admin/products')
  }

  return (
    <AdminLayout>
      <ProductFormModern
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </AdminLayout>
  )
}