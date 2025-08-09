export interface Region {
  id: number
  name: string
  code: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
  cities_count: string
  warehouses_count: string
}

export interface City {
  id: number
  name: string
  code: string
  region_id: number
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WarehouseItem {
  id: number
  name: string
  code: string
  address: string
  phone: string
  email: string
  manager_name: string
  total_capacity: number
  warehouse_type: string
  is_active: boolean
  created_at: string
  updated_at: string
  city_name: string
  city_code: string
  region_name: string
  region_code: string
  zones_count: string
  sections_count: string
  items_count: string
  total_items: string
}

export interface TreeNode {
  id: string
  type: 'region' | 'city' | 'warehouse' | 'zone' | 'section'
  name: string
  code?: string
  description?: string
  status: 'active' | 'inactive' | 'maintenance'
  children: TreeNode[]
  data: any
  metrics?: {
    capacity?: number
    used?: number
    efficiency?: number
    items_count?: number
    alerts?: number
  }
}

export interface BulkItem {
  id: string
  type: 'region' | 'city' | 'warehouse' | 'zone' | 'section' | 'inventory'
  name: string
  code?: string
  status: 'active' | 'inactive' | 'maintenance'
  parent?: string
  children_count: number
  metrics: {
    capacity: number
    used: number
    items_count: number
  }
  can_edit: boolean
  can_delete: boolean
  data?: any
  originalId: string
  originalData: any
}

export interface BulkOperation {
  id: string
  type: 'edit' | 'delete' | 'move' | 'copy' | 'status_change' | 'export'
  label: string
  icon: React.ReactNode
  color: 'default' | 'destructive' | 'secondary'
  confirmationRequired: boolean
}

export interface WarehouseAnalyticsData {
  summary: {
    total_regions: number
    total_cities: number
    total_warehouses: number
    total_capacity: number
    used_capacity: number
    overall_efficiency: number
    active_warehouses: number
    total_alerts: number
    total_items: number
    total_quantity: number
    low_stock_items: number
    out_of_stock_items: number
    total_movements: number
    recent_movements: number
    monthly_growth: number
    revenue_growth: number
  }
  regionMetrics: Array<{
    id: number
    name: string
    total_capacity: number
    used_capacity: number
    efficiency: number
    alerts_count: number
    cities_count: number
    warehouses_count: number
    active_warehouses: number
  }>
  warehouseMetrics: Array<{
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
    alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string; timestamp: string }>
  }>
}

export interface WarehouseState {
  activeTab: string
  loading: boolean
  error: string | null

  // Основные данные
  regions: Region[]
  cities: City[]
  warehouses: WarehouseItem[]
  zones: any[]
  sections: any[]
  selectedNode: TreeNode | null

  // Аналитика
  analyticsData: WarehouseAnalyticsData

  // Диалоги
  dialogs: {
    region: boolean
    city: boolean
    warehouse: boolean
    zone: boolean
    section: boolean
    edit: boolean
  }
  editingItem: any | null

  // Выбранные элементы
  selectedIds: {
    region: number
    city: number
    warehouse: number
    zone: number
  }

  // Bulk операции
  bulkOperationsData: BulkItem[]
  bulkOperationsLoading: boolean
}

export type WarehouseAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_REGIONS'; payload: Region[] }
  | { type: 'SET_CITIES'; payload: City[] }
  | { type: 'SET_WAREHOUSES'; payload: WarehouseItem[] }
  | { type: 'SET_ZONES'; payload: any[] }
  | { type: 'SET_SECTIONS'; payload: any[] }
  | { type: 'SET_SELECTED_NODE'; payload: TreeNode | null }
  | { type: 'SET_ANALYTICS_DATA'; payload: WarehouseAnalyticsData }
  | { type: 'SET_DIALOG'; payload: { type: keyof WarehouseState['dialogs']; open: boolean } }
  | { type: 'SET_EDITING_ITEM'; payload: any | null }
  | { type: 'SET_SELECTED_ID'; payload: { type: keyof WarehouseState['selectedIds']; id: number } }
  | { type: 'SET_BULK_DATA'; payload: BulkItem[] }
  | { type: 'SET_BULK_LOADING'; payload: boolean }
  | { type: 'RESET_DIALOGS' }
  | { type: 'RESET_SELECTED_IDS' }