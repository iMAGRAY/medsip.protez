import type {
  Region,
  City,
  WarehouseItem,
  WarehouseAnalyticsData,
  BulkItem,
  TreeNode
} from '@/lib/types/warehouse'

import { apiClient } from '@/lib/unified-api-client'
import { RUNTIME_CONFIG } from '@/lib/app-config'

export class WarehouseService {
  private static instance: WarehouseService

  static getInstance(): WarehouseService {
    if (!WarehouseService.instance) {
      WarehouseService.instance = new WarehouseService()
    }
    return WarehouseService.instance
  }

  // Загрузка всех данных склада
  async fetchAllData(): Promise<{
    regions: Region[]
    cities: City[]
    warehouses: WarehouseItem[]
    zones: any[]
    sections: any[]
  }> {
    try {
      const [regionsResponse, citiesResponse, warehousesResponse, zonesResponse, sectionsResponse] = await Promise.all([
        fetch('/api/warehouse/regions', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/warehouse/cities', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/warehouse/warehouses', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/warehouse/zones', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/warehouse/sections', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      ])
      // Проверяем что все запросы успешны
      if (!regionsResponse.ok) {
        const errorText = await regionsResponse.text()
        throw new Error(`Regions API error: ${regionsResponse.status} - ${errorText}`)
      }
      if (!citiesResponse.ok) {
        const errorText = await citiesResponse.text()
        throw new Error(`Cities API error: ${citiesResponse.status} - ${errorText}`)
      }
      if (!warehousesResponse.ok) {
        const errorText = await warehousesResponse.text()
        throw new Error(`Warehouses API error: ${warehousesResponse.status} - ${errorText}`)
      }
      if (!zonesResponse.ok) {
        const errorText = await zonesResponse.text()
        throw new Error(`Zones API error: ${zonesResponse.status} - ${errorText}`)
      }
      if (!sectionsResponse.ok) {
        const errorText = await sectionsResponse.text()
        throw new Error(`Sections API error: ${sectionsResponse.status} - ${errorText}`)
      }

      const [regionsData, citiesData, warehousesData, zonesData, sectionsData] = await Promise.all([
        regionsResponse.json(),
        citiesResponse.json(),
        warehousesResponse.json(),
        zonesResponse.json(),
        sectionsResponse.json()
      ])
      return {
        regions: regionsData.data || [],
        cities: citiesData.data || [],
        warehouses: warehousesData.data || [],
        zones: zonesData.data || [],
        sections: sectionsData.data || []
      }
    } catch (error) {
      console.error('❌ Детальная ошибка загрузки данных склада:', error)
      if (error instanceof Error) {
        throw new Error(`Детальная ошибка: ${error.message}`)
      }
      throw new Error('Неизвестная ошибка при загрузке данных склада')
    }
  }

  // Загрузка аналитических данных
  async fetchAnalyticsData(): Promise<WarehouseAnalyticsData> {
    try {
      const data = await apiClient.api.warehouse.analytics()
      return data.data || {
        summary: {
          total_regions: 0,
          total_cities: 0,
          total_warehouses: 0,
          total_capacity: 0,
          used_capacity: 0,
          overall_efficiency: 0,
          active_warehouses: 0,
          total_alerts: 0,
          total_items: 0,
          total_quantity: 0,
          low_stock_items: 0,
          out_of_stock_items: 0,
          total_movements: 0,
          recent_movements: 0,
          monthly_growth: 0,
          revenue_growth: 0
        },
        regionMetrics: [],
        warehouseMetrics: []
      }
    } catch (error) {
      console.error('Ошибка загрузки аналитики:', error)
      throw error
    }
  }

  // Загрузка данных для массовых операций
  async fetchBulkOperationsData(): Promise<BulkItem[]> {
    try {
      const [regionsRes, citiesRes, warehousesRes, zonesRes, sectionsRes] = await Promise.all([
        fetch('/api/warehouse/regions'),
        fetch('/api/warehouse/cities'),
        fetch('/api/warehouse/warehouses'),
        fetch('/api/warehouse/zones'),
        fetch('/api/warehouse/sections')
      ])

      const [regions, cities, warehouses, zones, sections] = await Promise.all([
        regionsRes.json(),
        citiesRes.json(),
        warehousesRes.json(),
        zonesRes.json(),
        sectionsRes.json()
      ])

      const allData = [
        ...(regions.data || []).map((item: any) => ({ ...item, type: 'region' })),
        ...(cities.data || []).map((item: any) => ({ ...item, type: 'city' })),
        ...(warehouses.data || []).map((item: any) => ({ ...item, type: 'warehouse' })),
        ...(zones.data || []).map((item: any) => ({ ...item, type: 'zone' })),
        ...(sections.data || []).map((item: any) => ({ ...item, type: 'section' }))
      ]

      return this.transformDataForBulkOperations(allData)
    } catch (error) {
      console.error('Ошибка загрузки данных для массовых операций:', error)
      return []
    }
  }

  // Создание региона
  async createRegion(data: Partial<Region>): Promise<Region> {
    const response = await fetch('/api/warehouse/regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Не удалось создать регион')
    }

    const result = await response.json()
    return result.data
  }

  // Создание города
  async createCity(data: Partial<City>): Promise<City> {
    const response = await fetch('/api/warehouse/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Не удалось создать город')
    }

    const result = await response.json()
    return result.data
  }

  // Создание склада
  async createWarehouse(data: Partial<WarehouseItem>): Promise<WarehouseItem> {
    const response = await fetch('/api/warehouse/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Не удалось создать склад')
    }

    const result = await response.json()
    return result.data
  }

  // Создание зоны
  async createZone(data: any): Promise<any> {
    const response = await fetch('/api/warehouse/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Не удалось создать зону')
    }

    const result = await response.json()
    return result.data
  }

  // Создание секции
  async createSection(data: any): Promise<any> {
    const response = await fetch('/api/warehouse/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Не удалось создать секцию')
    }

    const result = await response.json()
    return result.data
  }

  // Удаление узла
  async deleteNode(node: TreeNode): Promise<void> {
    const endpoints = {
      region: '/api/warehouse/regions',
      city: '/api/warehouse/cities',
      warehouse: '/api/warehouse/warehouses',
      zone: '/api/warehouse/zones',
      section: '/api/warehouse/sections'
    }

    const endpoint = endpoints[node.type]
    if (!endpoint) {
      throw new Error(`Неизвестный тип узла: ${node.type}`)
    }

    const response = await fetch(`${endpoint}/${node.data.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Не удалось удалить ${node.type}`)
    }
  }

  // Выполнение массовых операций
  async executeBulkOperation(
    operation: string,
    itemIds: string[],
    params?: any
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await fetch('/api/warehouse/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          itemIds,
          params
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка выполнения массовой операции')
      }

      return await response.json()
    } catch (error) {
      console.error('Ошибка массовой операции:', error)
      throw error
    }
  }

  // Преобразование данных для массовых операций
  private transformDataForBulkOperations(data: any[]): BulkItem[] {
    return data.map(item => ({
      id: `${item.type}-${item.id}`,
      type: item.type as 'region' | 'city' | 'warehouse' | 'zone' | 'section',
      name: item.name || 'Без названия',
      code: item.code || '',
      status: this.getItemStatus(item),
      parent: this.getParentInfo(item),
      children_count: this.getChildrenCount(item),
      metrics: {
        capacity: item.total_capacity || item.capacity || 0,
        used: item.used_capacity || item.used || 0,
        items_count: parseInt(item.items_count || '0')
      },
      can_edit: true,
      can_delete: this.canDelete(item),
      data: { ...item },
      originalId: item.id.toString(),
      originalData: item
    }))
  }

  private getItemStatus(item: any): 'active' | 'inactive' | 'maintenance' {
    if (item.is_active === false) return 'inactive'
    if (item.status) return item.status
    return 'active'
  }

  private getParentInfo(item: any): string {
    if (item.type === 'city' && item.region_name) {
      return item.region_name
    }
    if (item.type === 'warehouse' && item.city_name) {
      return `${item.city_name}, ${item.region_name}`
    }
    return ''
  }

  private getChildrenCount(item: any): number {
    switch (item.type) {
      case 'region':
        return parseInt(item.cities_count || '0')
      case 'city':
        return parseInt(item.warehouses_count || '0')
      case 'warehouse':
        return parseInt(item.zones_count || '0') + parseInt(item.sections_count || '0')
      default:
        return 0
    }
  }

  private canDelete(item: any): boolean {
    return this.getChildrenCount(item) === 0
  }

  // Конвертация в CSV
  convertToCSV(data: any[]): string {
    if (!data.length) return ''

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        }).join(',')
      )
    ].join('\n')

    return csvContent
  }
}