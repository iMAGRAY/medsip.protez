"use client"

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Warehouse,
  Package,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MapPin,
  Thermometer,
  Calendar,
  BarChart3
} from 'lucide-react'

interface WarehouseZone {
  id: number
  name: string
  description: string
  location: 'near' | 'far'
  capacity: number
  temperature_min: string
  temperature_max: string
  humidity_min: string
  humidity_max: string
  last_inspection: string
  is_active: boolean
  sections_count: string
  total_items: string
  utilization_percentage: string
}

interface WarehouseSection {
  id: number
  zone_id: number
  name: string
  description: string
  capacity: number
  row_number: number
  shelf_number: number
  is_active: boolean
  zone_name?: string
  items_count?: number
  utilization?: number
}

interface WarehouseInventory {
  id: number
  sku: string
  name: string
  description: string
  section_id: number
  quantity: number
  min_stock: number
  max_stock: number
  unit_price: string
  total_value: string
  status: 'active' | 'low_stock' | 'out_of_stock' | 'discontinued'
  supplier: string
  batch_number: string
  expiry_date: string
  section_name?: string
}

export function WarehouseSection() {
  const [zones, setZones] = useState<WarehouseZone[]>([])
  const [sections, setSections] = useState<WarehouseSection[]>([])
  const [inventory, setInventory] = useState<WarehouseInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('near')

  useEffect(() => {
    fetchWarehouseData()
  }, [fetchWarehouseData])

  const fetchWarehouseData = useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        // Загружаем зоны
        const zonesResponse = await fetch('/api/warehouse/zones')
        if (!zonesResponse.ok) {
          throw new Error('Ошибка загрузки зон склада')
        }
        const zonesData = await zonesResponse.json()
        setZones(zonesData.data || [])

        // Загружаем секции
        const sectionsResponse = await fetch('/api/warehouse/sections')
        if (!sectionsResponse.ok) {
          throw new Error('Ошибка загрузки секций склада')
        }
        const sectionsData = await sectionsResponse.json()
        setSections(sectionsData.data || [])

        // Загружаем инвентарь
        const inventoryResponse = await fetch('/api/warehouse/inventory')
        if (!inventoryResponse.ok) {
          throw new Error('Ошибка загрузки инвентаря')
        }
        const inventoryData = await inventoryResponse.json()
        setInventory(inventoryData.data || [])

      } catch (error) {
        console.error('Ошибка загрузки данных склада:', error)
        setError(error instanceof Error ? error.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }, [])

  const getUtilizationColor = (percentage: number) => {
    if (percentage < 70) return 'text-green-600'
    if (percentage < 90) return 'text-orange-600'
    return 'text-red-600'
  }

  const getUtilizationBadge = (percentage: number) => {
    if (percentage < 70) return { variant: 'default' as const, text: 'Оптимально' }
    if (percentage < 90) return { variant: 'secondary' as const, text: 'Предупреждение' }
    return { variant: 'destructive' as const, text: 'Критично' }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { variant: 'default' as const, text: 'В наличии', icon: CheckCircle }
      case 'low_stock':
        return { variant: 'secondary' as const, text: 'Мало', icon: AlertTriangle }
      case 'out_of_stock':
        return { variant: 'destructive' as const, text: 'Нет в наличии', icon: AlertTriangle }
      case 'discontinued':
        return { variant: 'outline' as const, text: 'Снято', icon: Package }
      default:
        return { variant: 'outline' as const, text: status, icon: Package }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const _formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(parseFloat(price))
  }

  const nearZones = zones.filter(zone => zone.location === 'near')
  const farZones = zones.filter(zone => zone.location === 'far')

  const getSectionsForZone = (zoneId: number) => {
    return sections.filter(section => section.zone_id === zoneId)
  }

  const getInventoryForSection = (sectionId: number) => {
    return inventory.filter(item => item.section_id === sectionId)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="w-5 h-5" />
            Склад
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Загрузка данных склада...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="w-5 h-5" />
            Склад
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertTriangle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
          <div className="flex justify-center mt-4">
            <Button onClick={fetchWarehouseData} variant="outline">
              Повторить попытку
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="w-5 h-5" />
          Управление складом
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="near" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ближний склад ({nearZones.length} зон)
            </TabsTrigger>
            <TabsTrigger value="far" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Дальний склад ({farZones.length} зон)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="near" className="space-y-6 mt-6">
            {nearZones.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Зоны ближнего склада не найдены</p>
              </div>
            ) : (
              nearZones.map((zone) => (
                <div key={zone.id} className="border rounded-lg p-4 space-y-4">
                  {/* Заголовок зоны */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{zone.name}</h3>
                      <p className="text-sm text-gray-500">{zone.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getUtilizationColor(parseFloat(zone.utilization_percentage))}`}>
                          {zone.utilization_percentage}% заполнено
                        </span>
                        <Badge {...getUtilizationBadge(parseFloat(zone.utilization_percentage))}>
                          {getUtilizationBadge(parseFloat(zone.utilization_percentage)).text}
                        </Badge>
                      </div>
                      <Progress
                        value={parseFloat(zone.utilization_percentage)}
                        className="w-32 h-2 mt-1"
                      />
                    </div>
                  </div>

                  {/* Информация о зоне */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span>{zone.total_items} товаров</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span>{zone.sections_count} секций</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-gray-400" />
                      <span>{zone.temperature_min}°-{zone.temperature_max}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Проверка: {formatDate(zone.last_inspection)}</span>
                    </div>
                  </div>

                  {/* Секции зоны */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Секции зоны</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getSectionsForZone(zone.id).map((section) => {
                        const sectionInventory = getInventoryForSection(section.id)
                        const totalItems = sectionInventory.reduce((sum, item) => sum + item.quantity, 0)
                        const utilization = section.capacity > 0 ? Math.round((totalItems / section.capacity) * 100) : 0

                        return (
                          <div key={section.id} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-sm">{section.name}</h5>
                              <Badge variant="outline" className="text-xs">
                                Ряд {section.row_number}, Полка {section.shelf_number}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex justify-between">
                                <span>Товаров:</span>
                                <span>{totalItems} из {section.capacity}</span>
                              </div>
                              <Progress value={utilization} className="h-1" />
                              <div className="flex justify-between">
                                <span>Заполнено:</span>
                                <span className={getUtilizationColor(utilization)}>{utilization}%</span>
                              </div>
                            </div>

                            {/* Товары в секции */}
                            {sectionInventory.length > 0 && (
                              <div className="mt-3 space-y-1">
                                <div className="text-xs font-medium text-gray-700">Товары:</div>
                                {sectionInventory.slice(0, 3).map((item) => {
                                  const statusBadge = getStatusBadge(item.status)
                                  const StatusIcon = statusBadge.icon

                                  return (
                                    <div key={item.id} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <StatusIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                        <span className="truncate">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="text-gray-600">{item.quantity} шт</span>
                                        <Badge variant={statusBadge.variant} className="text-xs px-1 py-0">
                                          {statusBadge.text}
                                        </Badge>
                                      </div>
                                    </div>
                                  )
                                })}
                                {sectionInventory.length > 3 && (
                                  <div className="text-xs text-gray-500 text-center">
                                    и ещё {sectionInventory.length - 3} товаров...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="far" className="space-y-6 mt-6">
            {farZones.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Зоны дальнего склада не найдены</p>
              </div>
            ) : (
              farZones.map((zone) => (
                <div key={zone.id} className="border rounded-lg p-4 space-y-4">
                  {/* Заголовок зоны */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{zone.name}</h3>
                      <p className="text-sm text-gray-500">{zone.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getUtilizationColor(parseFloat(zone.utilization_percentage))}`}>
                          {zone.utilization_percentage}% заполнено
                        </span>
                        <Badge {...getUtilizationBadge(parseFloat(zone.utilization_percentage))}>
                          {getUtilizationBadge(parseFloat(zone.utilization_percentage)).text}
                        </Badge>
                      </div>
                      <Progress
                        value={parseFloat(zone.utilization_percentage)}
                        className="w-32 h-2 mt-1"
                      />
                    </div>
                  </div>

                  {/* Информация о зоне */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span>{zone.total_items} товаров</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span>{zone.sections_count} секций</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-gray-400" />
                      <span>{zone.temperature_min}°-{zone.temperature_max}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Проверка: {formatDate(zone.last_inspection)}</span>
                    </div>
                  </div>

                  {/* Секции зоны */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Секции зоны</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getSectionsForZone(zone.id).map((section) => {
                        const sectionInventory = getInventoryForSection(section.id)
                        const totalItems = sectionInventory.reduce((sum, item) => sum + item.quantity, 0)
                        const utilization = section.capacity > 0 ? Math.round((totalItems / section.capacity) * 100) : 0

                        return (
                          <div key={section.id} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-sm">{section.name}</h5>
                              <Badge variant="outline" className="text-xs">
                                Ряд {section.row_number}, Полка {section.shelf_number}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex justify-between">
                                <span>Товаров:</span>
                                <span>{totalItems} из {section.capacity}</span>
                              </div>
                              <Progress value={utilization} className="h-1" />
                              <div className="flex justify-between">
                                <span>Заполнено:</span>
                                <span className={getUtilizationColor(utilization)}>{utilization}%</span>
                              </div>
                            </div>

                            {/* Товары в секции */}
                            {sectionInventory.length > 0 && (
                              <div className="mt-3 space-y-1">
                                <div className="text-xs font-medium text-gray-700">Товары:</div>
                                {sectionInventory.slice(0, 3).map((item) => {
                                  const statusBadge = getStatusBadge(item.status)
                                  const StatusIcon = statusBadge.icon

                                  return (
                                    <div key={item.id} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <StatusIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                        <span className="truncate">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="text-gray-600">{item.quantity} шт</span>
                                        <Badge variant={statusBadge.variant} className="text-xs px-1 py-0">
                                          {statusBadge.text}
                                        </Badge>
                                      </div>
                                    </div>
                                  )
                                })}
                                {sectionInventory.length > 3 && (
                                  <div className="text-xs text-gray-500 text-center">
                                    и ещё {sectionInventory.length - 3} товаров...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
