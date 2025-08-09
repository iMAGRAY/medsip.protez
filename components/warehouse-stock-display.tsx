"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, MapPin, Loader2 } from 'lucide-react'

interface WarehouseStock {
  warehouse_id: number
  warehouse_name: string
  warehouse_code: string
  city: string
  quantity: number
  reserved_quantity: number
}

interface WarehouseStockDisplayProps {
  productId?: string | number
  variantId?: string | number
  className?: string
}

export function WarehouseStockDisplay({
  productId,
  variantId,
  className = ""
}: WarehouseStockDisplayProps) {
  const [stocks, setStocks] = useState<WarehouseStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (productId || variantId) {
      fetchStocks()
    }
  }, [productId, variantId])

  const fetchStocks = async () => {
    setLoading(true)
    try {
      let url = ''
      if (variantId) {
        url = `/api/variants/${variantId}/warehouse-stock`
      } else if (productId) {
        url = `/api/products/${productId}/warehouse-stock`
      }

      if (url) {
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          // Фильтруем только склады с остатками
          setStocks(data.filter((stock: WarehouseStock) => stock.quantity > 0))
        }
      }
    } catch (error) {
      console.error('Error fetching warehouse stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (stocks.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Наличие на складах</CardTitle>
          <Badge variant="secondary">
            Всего: {totalQuantity} шт.
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {stocks.map((stock) => (
            <div
              key={stock.warehouse_id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium text-sm">{stock.warehouse_name}</div>
                  {stock.city && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span>{stock.city}</span>
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="font-mono">
                {stock.quantity} шт.
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}