"use client"

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Warehouse,
  Package,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Globe,
  Zap,
  Target,
  DollarSign,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react'

// Интерфейсы для аналитических данных
interface RegionMetrics {
  id: number
  name: string
  cities_count: number
  warehouses_count: number
  total_capacity: number
  used_capacity: number
  efficiency: number
  active_warehouses: number
  alerts_count: number
  revenue?: number
  growth_rate?: number
}

interface WarehouseMetrics {
  id: number
  name: string
  city: string
  region: string
  capacity: number
  used: number
  efficiency: number
  status: 'active' | 'inactive' | 'maintenance'
  items_count: number
  zones_count: number
  sections_count: number
  last_activity: string
  alerts: Array<{
    type: 'critical' | 'warning' | 'info'
    message: string
    timestamp: string
  }>
}

interface AnalyticsSummary {
  total_regions: number
  total_cities: number
  total_warehouses: number
  total_capacity: number
  used_capacity: number
  overall_efficiency: number
  active_warehouses: number
  total_alerts: number
  monthly_growth: number
  revenue_growth: number
}

interface WarehouseAnalyticsDashboardProps {
  summary: AnalyticsSummary
  regions: RegionMetrics[]
  warehouses: WarehouseMetrics[]
  onRefresh: () => void
  loading?: boolean
}

export const WarehouseAnalyticsDashboard: React.FC<WarehouseAnalyticsDashboardProps> = ({
  summary,
  regions,
  warehouses,
  onRefresh,
  loading = false
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('month')

  // Вычисляемые метрики
  const computedMetrics = useMemo(() => {
    const filteredWarehouses = selectedRegion === 'all'
      ? warehouses
      : warehouses.filter(w => w.region === selectedRegion)

    const totalCapacity = filteredWarehouses.reduce((sum, w) => sum + w.capacity, 0)
    const totalUsed = filteredWarehouses.reduce((sum, w) => sum + w.used, 0)
    const avgEfficiency = filteredWarehouses.length > 0
      ? filteredWarehouses.reduce((sum, w) => sum + w.efficiency, 0) / filteredWarehouses.length
      : 0

    const criticalAlerts = filteredWarehouses.reduce((sum, w) =>
      sum + w.alerts.filter(a => a.type === 'critical').length, 0
    )

    const warningAlerts = filteredWarehouses.reduce((sum, w) =>
      sum + w.alerts.filter(a => a.type === 'warning').length, 0
    )

    return {
      totalCapacity,
      totalUsed,
      utilizationRate: totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0,
      avgEfficiency,
      criticalAlerts,
      warningAlerts,
      activeWarehouses: filteredWarehouses.filter(w => w.status === 'active').length,
      maintenanceWarehouses: filteredWarehouses.filter(w => w.status === 'maintenance').length
    }
  }, [warehouses, selectedRegion])

  // Метрические карточки
  const MetricCard: React.FC<{
    title: string
    value: string | number
    change?: number
    icon: React.ReactNode
    color?: 'default' | 'success' | 'warning' | 'danger'
  }> = ({ title, value, change, icon, color = 'default' }) => {
    const colorClasses = {
      default: 'text-blue-600 bg-blue-50',
      success: 'text-green-600 bg-green-50',
      warning: 'text-yellow-600 bg-yellow-50',
      danger: 'text-red-600 bg-red-50'
    }

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {change !== undefined && (
                <div className="flex items-center mt-1">
                  {change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(change)}%
                  </span>
                </div>
              )}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Компонент географической карты (упрощенная версия)
  const GeographicMap: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Географическое распределение
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {regions.map(region => (
            <div key={region.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium">{region.name}</p>
                  <p className="text-sm text-gray-500">
                    {region.cities_count} городов, {region.warehouses_count} складов
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={region.efficiency > 80 ? 'default' : region.efficiency > 60 ? 'secondary' : 'destructive'}
                  >
                    {region.efficiency}%
                  </Badge>
                  {region.alerts_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {region.alerts_count} уведомлений
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {Math.round(region.used_capacity / region.total_capacity * 100)}% загружен
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  // Компонент топ складов
  const TopWarehouses: React.FC = () => {
    const sortedWarehouses = [...warehouses]
      .filter(w => selectedRegion === 'all' || w.region === selectedRegion)
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 10)

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Топ складов по эффективности
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedWarehouses.map((warehouse, index) => (
              <div key={warehouse.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{warehouse.name}</p>
                    <Badge
                      variant={warehouse.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {warehouse.status === 'active' ? 'Активен' : warehouse.status === 'maintenance' ? 'Обслуживание' : 'Неактивен'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{warehouse.city}, {warehouse.region}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{warehouse.items_count} товаров</span>
                    <span>{warehouse.zones_count} зон</span>
                    <span>{warehouse.sections_count} секций</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{warehouse.efficiency}%</p>
                  <p className="text-sm text-gray-500">
                    {Math.round(warehouse.used / warehouse.capacity * 100)}% загружен
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Компонент алертов
  const AlertsPanel: React.FC = () => {
    const allAlerts = warehouses
      .filter(w => selectedRegion === 'all' || w.region === selectedRegion)
      .flatMap(w => w.alerts.map(alert => ({ ...alert, warehouse: w.name })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Системные уведомления
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allAlerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className={`
                  p-1 rounded-full
                  ${alert.type === 'critical' ? 'bg-red-100 text-red-600' :
                    alert.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'}
                `}>
                  {alert.type === 'critical' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : alert.type === 'warning' ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{alert.warehouse}</span>
                    <span>•</span>
                    <span>{new Date(alert.timestamp).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
                <Badge
                  variant={alert.type === 'critical' ? 'destructive' : alert.type === 'warning' ? 'secondary' : 'default'}
                  className="text-xs"
                >
                  {alert.type === 'critical' ? 'Критично' : alert.type === 'warning' ? 'Внимание' : 'Инфо'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок с фильтрами */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Аналитика складской системы</h1>
          <p className="text-gray-500">Мониторинг и анализ производительности складской сети</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="all">Все регионы</option>
            {regions.map(region => (
              <option key={region.id} value={region.name}>{region.name}</option>
            ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="day">Сегодня</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
            <option value="year">Год</option>
          </select>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Общая вместимость"
          value={`${(computedMetrics.totalCapacity / 1000).toFixed(1)}k м³`}
          change={summary.monthly_growth}
          icon={<Warehouse className="w-6 h-6" />}
          color="default"
        />
        <MetricCard
          title="Загрузка складов"
          value={`${computedMetrics.utilizationRate.toFixed(1)}%`}
          change={5.2}
          icon={<Package className="w-6 h-6" />}
          color={computedMetrics.utilizationRate > 80 ? 'warning' : 'success'}
        />
        <MetricCard
          title="Эффективность"
          value={`${computedMetrics.avgEfficiency.toFixed(1)}%`}
          change={3.1}
          icon={<TrendingUp className="w-6 h-6" />}
          color={computedMetrics.avgEfficiency > 75 ? 'success' : 'warning'}
        />
        <MetricCard
          title="Критические уведомления"
          value={computedMetrics.criticalAlerts}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={computedMetrics.criticalAlerts > 0 ? 'danger' : 'success'}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="geographic">География</TabsTrigger>
          <TabsTrigger value="performance">Производительность</TabsTrigger>
          <TabsTrigger value="alerts">Уведомления</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Статистика по статусам */}
            <Card>
              <CardHeader>
                <CardTitle>Статус складов</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Активные
                  </span>
                  <span className="font-medium">{computedMetrics.activeWarehouses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    На обслуживании
                  </span>
                  <span className="font-medium">{computedMetrics.maintenanceWarehouses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    Неактивные
                  </span>
                  <span className="font-medium">
                    {warehouses.length - computedMetrics.activeWarehouses - computedMetrics.maintenanceWarehouses}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Загрузка по регионам */}
            <Card>
              <CardHeader>
                <CardTitle>Загрузка по регионам</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {regions.slice(0, 5).map(region => (
                  <div key={region.id}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{region.name}</span>
                      <span className="text-sm text-gray-500">
                        {Math.round(region.used_capacity / region.total_capacity * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={region.used_capacity / region.total_capacity * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <TopWarehouses />
        </TabsContent>

        <TabsContent value="geographic">
          <GeographicMap />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* График эффективности по времени - заглушка */}
            <Card>
              <CardHeader>
                <CardTitle>Тренд эффективности</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>График будет здесь</p>
                    <p className="text-sm">Интеграция с Chart.js или Recharts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Распределение загрузки */}
            <Card>
              <CardHeader>
                <CardTitle>Распределение загрузки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <PieChart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Круговая диаграмма</p>
                    <p className="text-sm">Показать распределение по типам товаров</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}