"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Building2,
  Globe,
  MapPin
} from 'lucide-react'

// Интерфейсы для данных
interface StatsData {
  regions: number
  cities: number
  warehouses: number
  zones: number
  sections: number
  articles: number
  totalCapacity: number
  usedCapacity: number
  activeWarehouses: number
  inactiveWarehouses: number
}

interface WarehouseStatsProps {
  data: StatsData
  loading?: boolean
}

export const WarehouseStats: React.FC<WarehouseStatsProps> = ({ data, loading = false }) => {
  const utilizationPercentage = data.totalCapacity > 0
    ? Math.round((data.usedCapacity / data.totalCapacity) * 100)
    : 0

  const warehouseActivePercentage = data.warehouses > 0
    ? Math.round((data.activeWarehouses / data.warehouses) * 100)
    : 0

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-300 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-300 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-6 bg-gray-300 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Основная статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Регионы</CardTitle>
            <Globe className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.regions}</div>
            <p className="text-xs text-muted-foreground">
              Общее количество регионов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Города</CardTitle>
            <MapPin className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.cities}</div>
            <p className="text-xs text-muted-foreground">
              Городов с складами
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Склады</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.warehouses}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={data.activeWarehouses === data.warehouses ? "default" : "secondary"} className="text-xs">
                {data.activeWarehouses} активных
              </Badge>
              {data.inactiveWarehouses > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {data.inactiveWarehouses} неактивных
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Товары</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.articles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Различных артикулов
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Статистика использования */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Использование складов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Общая загрузка</span>
                <span className="text-sm text-muted-foreground">{utilizationPercentage}%</span>
              </div>
              <Progress
                value={utilizationPercentage}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Использовано: {data.usedCapacity.toLocaleString()}</span>
                <span>Всего: {data.totalCapacity.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Активные склады</span>
                <span className="text-sm text-muted-foreground">{warehouseActivePercentage}%</span>
              </div>
              <Progress
                value={warehouseActivePercentage}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Структура системы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm">Зоны</span>
                </div>
                <span className="text-sm font-medium">{data.zones}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                  <span className="text-sm">Секции</span>
                </div>
                <span className="text-sm font-medium">{data.sections}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Среднее на склад:</span>
                <div className="text-right text-xs">
                  <div>{data.warehouses > 0 ? Math.round(data.zones / data.warehouses) : 0} зон</div>
                  <div>{data.warehouses > 0 ? Math.round(data.sections / data.warehouses) : 0} секций</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Индикаторы состояния */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Состояние системы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              {utilizationPercentage < 80 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : utilizationPercentage < 95 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="font-medium text-sm">Загрузка складов</div>
                <div className="text-xs text-muted-foreground">
                  {utilizationPercentage < 80 ? 'Нормальная' :
                   utilizationPercentage < 95 ? 'Высокая' : 'Критическая'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {warehouseActivePercentage === 100 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : warehouseActivePercentage >= 80 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="font-medium text-sm">Активность складов</div>
                <div className="text-xs text-muted-foreground">
                  {warehouseActivePercentage === 100 ? 'Все активны' :
                   warehouseActivePercentage >= 80 ? 'Частично неактивны' : 'Много неактивных'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {data.articles > 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <div className="font-medium text-sm">Номенклатура</div>
                <div className="text-xs text-muted-foreground">
                  {data.articles > 0 ? 'Товары добавлены' : 'Нет товаров'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}