import { useReducer, useCallback, useMemo } from 'react'
import type {
  WarehouseState,
  WarehouseAction,
  WarehouseAnalyticsData,
  Region,
  City,
  WarehouseItem,
  TreeNode,
  BulkItem
} from '@/lib/types/warehouse'

const initialAnalyticsData: WarehouseAnalyticsData = {
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

const initialState: WarehouseState = {
  activeTab: 'tree',
  loading: true,
  error: null,

  // Основные данные
  regions: [],
  cities: [],
  warehouses: [],
  zones: [],
  sections: [],
  selectedNode: null,

  // Аналитика
  analyticsData: initialAnalyticsData,

  // Диалоги
  dialogs: {
    region: false,
    city: false,
    warehouse: false,
    zone: false,
    section: false,
    edit: false
  },
  editingItem: null,

  // Выбранные элементы
  selectedIds: {
    region: 0,
    city: 0,
    warehouse: 0,
    zone: 0
  },

  // Bulk операции
  bulkOperationsData: [],
  bulkOperationsLoading: true
}

function warehouseReducer(state: WarehouseState, action: WarehouseAction): WarehouseState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload }

    case 'SET_REGIONS':
      return { ...state, regions: action.payload }

    case 'SET_CITIES':
      return { ...state, cities: action.payload }

    case 'SET_WAREHOUSES':
      return { ...state, warehouses: action.payload }

    case 'SET_ZONES':
      return { ...state, zones: action.payload }

    case 'SET_SECTIONS':
      return { ...state, sections: action.payload }

    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.payload }

    case 'SET_ANALYTICS_DATA':
      return { ...state, analyticsData: action.payload }

    case 'SET_DIALOG':
      return {
        ...state,
        dialogs: { ...state.dialogs, [action.payload.type]: action.payload.open }
      }

    case 'SET_EDITING_ITEM':
      return { ...state, editingItem: action.payload }

    case 'SET_SELECTED_ID':
      return {
        ...state,
        selectedIds: { ...state.selectedIds, [action.payload.type]: action.payload.id }
      }

    case 'SET_BULK_DATA':
      return { ...state, bulkOperationsData: action.payload }

    case 'SET_BULK_LOADING':
      return { ...state, bulkOperationsLoading: action.payload }

    case 'RESET_DIALOGS':
      return {
        ...state,
        dialogs: {
          region: false,
          city: false,
          warehouse: false,
          zone: false,
          section: false,
          edit: false
        }
      }

    case 'RESET_SELECTED_IDS':
      return {
        ...state,
        selectedIds: {
          region: 0,
          city: 0,
          warehouse: 0,
          zone: 0
        }
      }

    default:
      return state
  }
}

export function useWarehouseState() {
  const [state, dispatch] = useReducer(warehouseReducer, initialState)

  // Стабильные useCallback
  const setLoading = useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const setActiveTab = useCallback((tab: string) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })
  }, [])

  const setRegions = useCallback((regions: Region[]) => {
      dispatch({ type: 'SET_REGIONS', payload: regions })
  }, [])

  const setCities = useCallback((cities: City[]) => {
      dispatch({ type: 'SET_CITIES', payload: cities })
  }, [])

  const setWarehouses = useCallback((warehouses: WarehouseItem[]) => {
      dispatch({ type: 'SET_WAREHOUSES', payload: warehouses })
  }, [])

  const setZones = useCallback((zones: any[]) => {
      dispatch({ type: 'SET_ZONES', payload: zones })
  }, [])

  const setSections = useCallback((sections: any[]) => {
      dispatch({ type: 'SET_SECTIONS', payload: sections })
  }, [])

  const setSelectedNode = useCallback((node: TreeNode | null) => {
      dispatch({ type: 'SET_SELECTED_NODE', payload: node })
  }, [])

  const setAnalyticsData = useCallback((data: WarehouseAnalyticsData) => {
      dispatch({ type: 'SET_ANALYTICS_DATA', payload: data })
  }, [])

  const setDialog = useCallback((_type: keyof WarehouseState['dialogs'], _open: boolean) => {
      dispatch({ type: 'SET_DIALOG', payload: { type, open } })
  }, [])

  const setEditingItem = useCallback((item: any | null) => {
      dispatch({ type: 'SET_EDITING_ITEM', payload: item })
  }, [])

  const setSelectedId = useCallback((_type: keyof WarehouseState['selectedIds'], _id: number) => {
      dispatch({ type: 'SET_SELECTED_ID', payload: { type, id } })
  }, [])

  const setBulkData = useCallback((data: BulkItem[]) => {
      dispatch({ type: 'SET_BULK_DATA', payload: data })
  }, [])

  const setBulkLoading = useCallback((loading: boolean) => {
      dispatch({ type: 'SET_BULK_LOADING', payload: loading })
  }, [])

  const resetDialogs = useCallback(() => {
      dispatch({ type: 'RESET_DIALOGS' })
  }, [])

  const resetSelectedIds = useCallback(() => {
      dispatch({ type: 'RESET_SELECTED_IDS' })
    }, [])

  // Стабильный объект actions через useMemo
  const _actions = useMemo(() => ({
    setLoading,
    setError,
    setActiveTab,
    setRegions,
    setCities,
    setWarehouses,
    setZones,
    setSections,
    setSelectedNode,
    setAnalyticsData,
    setDialog,
    setEditingItem,
    setSelectedId,
    setBulkData,
    setBulkLoading,
    resetDialogs,
    resetSelectedIds
  }), [
    setLoading,
    setError,
    setActiveTab,
    setRegions,
    setCities,
    setWarehouses,
    setZones,
    setSections,
    setSelectedNode,
    setAnalyticsData,
    setDialog,
    setEditingItem,
    setSelectedId,
    setBulkData,
    setBulkLoading,
    resetDialogs,
    resetSelectedIds
  ])

  return { state, actions }
}