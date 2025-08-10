"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Package, MapPin, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Warehouse {
  id: number
  name: string
  code: string
  city: string
}

interface WarehouseStock {
  warehouse_id: number
  warehouse_name: string
  warehouse_code: string
  city: string
  quantity: number
  reserved_quantity: number
}

interface VariantWarehouseStockManagerProps {
  variantId?: string | number | null
  variantName?: string
  onTotalChange?: (total: number) => void
  disabled?: boolean
}

export function VariantWarehouseStockManager({
  variantId,
  variantName,
  onTotalChange,
  disabled = false
}: VariantWarehouseStockManagerProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Загрузка списка складов
  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  // Загрузка остатков при изменении variantId
  useEffect(() => {
    if (variantId) {
      fetchWarehouseStocks()
    } else {
      // Для нового варианта показываем склады с нулевыми остатками
      setWarehouseStocks(warehouses.map(w => ({
        warehouse_id: w.id,
        warehouse_name: w.name,
        warehouse_code: w.code,
        city: w.city,
        quantity: 0,
        reserved_quantity: 0
      })))
    }
  }, [variantId, warehouses])

  const fetchWarehouses = useCallback(async () => {
      try {
        const response = await fetch('/api/warehouses')
        if (response.ok) {
          const data = await response.json()
          setWarehouses(data)
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error)
        toast.error('Ошибка загрузки складов')
      }
    }, [])

  const fetchWarehouseStocks = async () => {
    if (!variantId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/variants/${variantId}/warehouse-stock`)
      if (response.ok) {
        const data = await response.json()
        setWarehouseStocks(data)
        setIsDirty(false)
      }
    } catch (error) {
      console.error('Error fetching warehouse stocks:', error)
      toast.error('Ошибка загрузки остатков')
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityChange = (warehouseId: number, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0
    setWarehouseStocks(prev => 
      prev.map(stock => 
        stock.warehouse_id === warehouseId
          ? { ...stock, quantity: numQuantity }
          : stock
      )
    )
    setIsDirty(true)

    // Вычисляем общее количество
    const total = warehouseStocks.reduce((sum, stock) => {
      return sum + (stock.warehouse_id === warehouseId ? numQuantity : stock.quantity)
    }, 0)
    onTotalChange?.(total)
  }

  const handleSave = async () => {
    if (!variantId) {
      toast.error('Сначала сохраните вариант')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/variants/${variantId}/warehouse-stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(warehouseStocks)
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Остатки по складам сохранены')
        setIsDirty(false)
        onTotalChange?.(result.totalQuantity)
      } else {
        toast.error('Ошибка сохранения остатков')
      }
    } catch (error) {
      console.error('Error saving warehouse stocks:', error)
      toast.error('Ошибка сохранения остатков')
    } finally {
      setSaving(false)
    }
  }

  const totalQuantity = warehouseStocks.reduce((sum, stock) => sum + stock.quantity, 0)

  if (loading && variantId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Остатки по складам</CardTitle>
            <CardDescription>
              {variantName ? `Управление остатками варианта "${variantName}"` : 'Настройте количество варианта на каждом складе'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Всего: {totalQuantity} шт.
            </Badge>
            {isDirty && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Не сохранено
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!variantId && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Сохраните вариант, чтобы настроить остатки по складам</span>
          </div>
        )}

        <div className="space-y-3">
          {warehouseStocks.map((stock) => (
            <div
              key={stock.warehouse_id}
              className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{stock.warehouse_name}</span>
                  {stock.warehouse_code && (
                    <Badge variant="outline" className="text-xs">
                      {stock.warehouse_code}
                    </Badge>
                  )}
                </div>
                {stock.city && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span>{stock.city}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-32">
                  <Label htmlFor={`quantity-${stock.warehouse_id}`} className="sr-only">
                    Количество на складе {stock.warehouse_name}
                  </Label>
                  <Input
                    id={`quantity-${stock.warehouse_id}`}
                    type="number"
                    min="0"
                    value={stock.quantity}
                    onChange={(e) => handleQuantityChange(stock.warehouse_id, e.target.value)}
                    disabled={disabled || !variantId}
                    className="text-center"
                    placeholder="0"
                  />
                </div>
                <span className="text-sm text-gray-500 w-8">шт.</span>
              </div>
            </div>
          ))}
        </div>

        {variantId && isDirty && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving || disabled}
              size="sm"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить остатки
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}