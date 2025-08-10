import { useEffect, useMemo, useCallback, createElement } from 'react'
import { useWarehouseState } from './use-warehouse-state'
import { WarehouseService } from '@/services/warehouse-service'
import type { TreeNode, BulkOperation } from '@/lib/types/warehouse'
import { toast } from 'sonner'
import {
  Edit,
  Trash2,
  Copy,
  Move,
  Download,
  Users,
  Settings,
  ToggleLeft
} from 'lucide-react'

export function useWarehouse() {
  const { state, actions } = useWarehouseState()
  const warehouseService = WarehouseService.getInstance()

  // Стабилизируем массивы состояния
  const stableRegions = useMemo(() => state.regions || [], [state.regions])
  const stableCities = useMemo(() => state.cities || [], [state.cities])
  const stableWarehouses = useMemo(() => state.warehouses || [], [state.warehouses])

  // Загрузка всех данных
  const loadAllData = useCallback(async () => {
    try {
      actions.setLoading(true)
      actions.setError(null)

      const data = await warehouseService.fetchAllData()

      actions.setRegions(data.regions)
      actions.setCities(data.cities)
      actions.setWarehouses(data.warehouses)
      actions.setZones(data.zones)
      actions.setSections(data.sections)

    } catch (error) {
      console.error('❌ Ошибка загрузки данных склада:', error)
      actions.setError(error instanceof Error ? error.message : 'Неизвестная ошибка')
      toast.error('Не удалось загрузить данные склада')
    } finally {
      actions.setLoading(false)
    }
  }, [actions, warehouseService])

  // Загрузка аналитики
  const loadAnalyticsData = useCallback(async () => {
    try {
      const analyticsData = await warehouseService.fetchAnalyticsData()
      actions.setAnalyticsData(analyticsData)

    } catch (error) {
      console.error('❌ Ошибка загрузки аналитики:', error)
      toast.error('Не удалось загрузить аналитику')
    }
  }, [actions, warehouseService])

  // Загрузка данных для массовых операций
  const loadBulkOperationsData = useCallback(async () => {
    try {
      actions.setBulkLoading(true)
      const bulkData = await warehouseService.fetchBulkOperationsData()

      // Удаляем дубликаты по ID
      const uniqueData = bulkData.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      )

      actions.setBulkData(uniqueData)

    } catch (error) {
      console.error('❌ Ошибка загрузки bulk данных:', error)
      toast.error('Не удалось загрузить данные для массовых операций')
    } finally {
      actions.setBulkLoading(false)
    }
  }, [actions, warehouseService])

  // Создание элементов
  const _createRegion = useCallback(async (data: any) => {
    try {
      await warehouseService.createRegion(data)
      await loadAllData()
      actions.setDialog('region', false)
      toast.success('Регион успешно создан')
    } catch (error) {
      console.error('Ошибка создания региона:', error)
      toast.error('Не удалось создать регион')
    }
  }, [actions, loadAllData, warehouseService])

  const _createCity = useCallback(async (data: any) => {
    try {
      await warehouseService.createCity(data)
      await loadAllData()
      actions.setDialog('city', false)
      toast.success('Город успешно создан')
    } catch (error) {
      console.error('Ошибка создания города:', error)
      toast.error('Не удалось создать город')
    }
  }, [actions, loadAllData, warehouseService])

  const _createWarehouse = useCallback(async (data: any) => {
    try {
      await warehouseService.createWarehouse(data)
      await loadAllData()
      actions.setDialog('warehouse', false)
      toast.success('Склад успешно создан')
    } catch (error) {
      console.error('Ошибка создания склада:', error)
      toast.error('Не удалось создать склад')
    }
  }, [actions, loadAllData, warehouseService])

  const _createZone = useCallback(async (data: any) => {
    try {
      await warehouseService.createZone(data)
      await loadAllData()
      actions.setDialog('zone', false)
      toast.success('Зона успешно создана')
    } catch (error) {
      console.error('Ошибка создания зоны:', error)
      toast.error('Не удалось создать зону')
    }
  }, [actions, loadAllData, warehouseService])

  const _createSection = useCallback(async (data: any) => {
    try {
      await warehouseService.createSection(data)
      await loadAllData()
      actions.setDialog('section', false)
      toast.success('Секция успешно создана')
    } catch (error) {
      console.error('Ошибка создания секции:', error)
      toast.error('Не удалось создать секцию')
    }
  }, [actions, loadAllData, warehouseService])

  // Удаление узла
  const deleteNode = useCallback(async (node: TreeNode) => {
    try {
      await warehouseService.deleteNode(node)
      await loadAllData()
      toast.success(`${node.type} успешно удален`)
    } catch (error) {
      console.error('Ошибка удаления:', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить элемент')
    }
  }, [loadAllData, warehouseService])

  // Массовые операции
  const _executeBulkOperation = useCallback(async (
    operation: string,
    itemIds: string[],
    params?: any
  ) => {
    try {
      if (operation === 'export') {
        const itemsToExport = state.bulkOperationsData.filter(item =>
          itemIds.includes(item.id)
        ).map(item => item.originalData)

        const csvContent = warehouseService.convertToCSV(itemsToExport)
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute('download', `warehouse_export_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast.success(`Экспортировано ${itemIds.length} элементов`)
        return
      }

      const result = await warehouseService.executeBulkOperation(operation, itemIds, params)

      if (result.success) {
        await loadAllData()
        await loadBulkOperationsData()
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Ошибка массовой операции:', error)
      toast.error('Не удалось выполнить операцию')
    }
  }, [state.bulkOperationsData, warehouseService, loadAllData, loadBulkOperationsData])

  // Хендлеры для управления узлами
  const _handleNodeSelect = useCallback((node: TreeNode | null) => {
    actions.setSelectedNode(node)
  }, [actions])

  const _handleNodeCreate = useCallback((parentId: string, type: string) => {
    // Извлекаем ID родительского элемента
    const [parentType, id] = parentId.split('-')
    const parentIdNum = parseInt(id)

    // Устанавливаем выбранные ID для создания дочерних элементов
    switch (type) {
      case 'city':
        actions.setSelectedId('region', parentIdNum)
        actions.setDialog('city', true)
        break
      case 'warehouse':
        actions.setSelectedId('city', parentIdNum)
        actions.setDialog('warehouse', true)
        break
      case 'zone':
        actions.setSelectedId('warehouse', parentIdNum)
        actions.setDialog('zone', true)
        break
      case 'section':
        actions.setSelectedId('zone', parentIdNum)
        actions.setDialog('section', true)
        break
      default:
        actions.setDialog(type as any, true)
    }
  }, [actions])

  const _handleNodeEdit = useCallback((node: TreeNode) => {
    actions.setEditingItem(node.data)
    actions.setDialog('edit', true)
  }, [actions])

  const _handleNodeDelete = useCallback(async (node: TreeNode) => {
    if (confirm(`Вы уверены, что хотите удалить ${node.name}?`)) {
      await deleteNode(node)
    }
  }, [deleteNode])

  const _handleNodeMove = useCallback(async (_nodeId: string, _newParentId: string) => {

    toast.info('Функция перемещения в разработке')
  }, [])

  // Иерархические данные для дерева
  const _treeData = useMemo(() => {
    const buildTreeData = () => {
      return stableRegions.map(region => ({
        id: `region-${region.id}`,
        type: 'region' as const,
        name: region.name,
        code: region.code,
        description: region.description,
        status: region.is_active ? 'active' as const : 'inactive' as const,
        data: region,
        children: stableCities
          .filter(city => city.region_id === region.id)
          .map(city => ({
            id: `city-${city.id}`,
            type: 'city' as const,
            name: city.name,
            code: city.code,
            description: city.description,
            status: city.is_active ? 'active' as const : 'inactive' as const,
            data: city,
            children: stableWarehouses
              .filter(warehouse => warehouse.city_name === city.name)
              .map(warehouse => ({
                id: `warehouse-${warehouse.id}`,
                type: 'warehouse' as const,
                name: warehouse.name,
                code: warehouse.code,
                description: warehouse.address,
                status: warehouse.is_active ? 'active' as const : 'inactive' as const,
                data: warehouse,
                metrics: {
                  capacity: warehouse.total_capacity,
                  used: 0,
                  efficiency: 85,
                  items_count: parseInt(warehouse.items_count || '0'),
                  alerts: 0
                },
                children: []
              }))
          }))
      }))
    }

    return buildTreeData()
  }, [stableRegions, stableCities, stableWarehouses])

  // Операции для массовых действий
  const _bulkOperations: BulkOperation[] = useMemo(() => [
    {
      id: 'edit',
      type: 'edit',
      label: 'Редактировать',
      icon: createElement(Edit, { className: 'w-4 h-4' }),
      color: 'default',
      confirmationRequired: false
    },
    {
      id: 'status_change',
      type: 'status_change',
      label: 'Изменить статус',
      icon: createElement(ToggleLeft, { className: 'w-4 h-4' }),
      color: 'default',
      confirmationRequired: false
    },
    {
      id: 'move',
      type: 'move',
      label: 'Переместить',
      icon: createElement(Move, { className: 'w-4 h-4' }),
      color: 'default',
      confirmationRequired: false
    },
    {
      id: 'copy',
      type: 'copy',
      label: 'Копировать',
      icon: createElement(Copy, { className: 'w-4 h-4' }),
      color: 'default',
      confirmationRequired: false
    },
    {
      id: 'export',
      type: 'export',
      label: 'Экспорт',
      icon: createElement(Download, { className: 'w-4 h-4' }),
      color: 'default',
      confirmationRequired: false
    },
    {
      id: 'delete',
      type: 'delete',
      label: 'Удалить',
      icon: createElement(Trash2, { className: 'w-4 h-4' }),
      color: 'destructive',
      confirmationRequired: true
    }
  ], [])

  // Инициализация данных при монтировании
  useEffect(() => {
    loadAllData()
    loadAnalyticsData()
  }, [loadAllData, loadAnalyticsData])

  useEffect(() => {
    loadBulkOperationsData()
  }, [loadBulkOperationsData])

  return {
    // Состояние
    activeTab: state.activeTab,
    loading: state.loading,
    error: state.error,
    regions: stableRegions,
    cities: stableCities,
    warehouses: stableWarehouses,
    zones: state.zones || [],
    sections: state.sections || [],
    selectedNode: state.selectedNode,
    analyticsData: state.analyticsData,
    dialogs: state.dialogs,
    bulkOperationsLoading: state.bulkOperationsLoading,
    bulkOperationsData: state.bulkOperationsData || [],

    // Производные данные
    treeData,
    bulkOperations,

    // Экшены состояния
    actions,

    // Комплексные операции
    loadAllData,
    loadAnalyticsData,
    loadBulkOperationsData,

    // CRUD операции
    createRegion,
    createCity,
    createWarehouse,
    createZone,
    createSection,
    deleteNode,

    // Хендлеры
    handleNodeSelect,
    handleNodeCreate,
    handleNodeEdit,
    handleNodeDelete,
    handleNodeMove,
    executeBulkOperation
  }
}