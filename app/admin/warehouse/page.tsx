"use client"

import React from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Warehouse,
  BarChart3,
  Settings,
  RefreshCw,
  Navigation,
  TrendingUp,
  MapPin,
  Building2,
  Package2,
  Grid3x3,
  AlertTriangle,
  Zap,
  Plus
} from 'lucide-react'

// Импорт компонентов
import { WarehouseTreeManager } from '@/components/admin/warehouse-tree-manager'
import { WarehouseAnalyticsDashboard } from '@/components/admin/warehouse-analytics-dashboard'
import { WarehouseBulkOperations } from '@/components/admin/warehouse-bulk-operations'
import { WarehouseDialogs } from '@/components/admin/warehouse-dialogs'
// Диалоги будут созданы позже в процессе рефакторинга

// Рефакторированный хук
import { useWarehouse } from '@/hooks/use-warehouse'

export default function WarehousePage() {
  // Использование рефакторированного хука вместо всех состояний
  const {
    // Состояние
    activeTab,
    loading,
    error,
    analyticsData,
    dialogs,
    bulkOperationsLoading,

    // Производные данные
    treeData,
    bulkOperations,
    bulkOperationsData,

    // Экшены
    actions,

    // Операции
    loadAllData,

    // Хендлеры
    handleNodeSelect,
    handleNodeCreate,
    handleNodeEdit,
    handleNodeDelete,
    handleNodeMove,
    executeBulkOperation,

    // CRUD операции
    createRegion,
    createCity,
    createWarehouse,
    createZone,
    createSection
  } = useWarehouse()

  // Показать ошибку если есть
  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Ошибка загрузки</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadAllData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Попробовать снова
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Заголовок */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Управление складской системой
              </h1>
              <p className="text-gray-600 mt-1">
                Эффективное управление межгородской складской сетью
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="flex items-center gap-2">
                <Warehouse className="w-4 h-4" />
                {analyticsData.summary.active_warehouses} активных складов
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {analyticsData.summary.overall_efficiency.toFixed(1)}% эффективность
              </Badge>
              <Button onClick={loadAllData} disabled={loading} size="sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button onClick={() => actions.setDialog('region', true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Добавить регион
              </Button>
            </div>
          </div>

          {/* Быстрые метрики */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Регионы</p>
                    <p className="text-2xl font-bold">{analyticsData.summary.total_regions}</p>
                  </div>
                  <MapPin className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Города</p>
                    <p className="text-2xl font-bold">{analyticsData.summary.total_cities}</p>
                  </div>
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Склады</p>
                    <p className="text-2xl font-bold">{analyticsData.summary.total_warehouses}</p>
                  </div>
                  <Warehouse className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Общая вместимость</p>
                    <p className="text-2xl font-bold">{analyticsData.summary.total_capacity.toLocaleString()}</p>
                  </div>
                  <Package2 className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Основной контент */}
          <Tabs value={activeTab} onValueChange={actions.setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tree" className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Иерархия склада
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Аналитика
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Массовые операции
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tree" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3x3 className="w-5 h-5" />
                    Структура складской системы
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-lg">Загрузка структуры склада...</span>
                      </div>
                    </div>
                  ) : (
                    <WarehouseTreeManager
                      data={treeData}
                      loading={loading}
                      onNodeSelect={handleNodeSelect}
                      onNodeCreate={handleNodeCreate}
                      onNodeEdit={handleNodeEdit}
                      onNodeDelete={handleNodeDelete}
                      onNodeMove={handleNodeMove}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <WarehouseAnalyticsDashboard
                summary={analyticsData.summary}
                regions={analyticsData.regionMetrics}
                warehouses={analyticsData.warehouseMetrics}
                loading={loading}
                onRefresh={loadAllData}
              />
            </TabsContent>

            <TabsContent value="bulk" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Массовые операции
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WarehouseBulkOperations
                    items={bulkOperationsData}
                    operations={bulkOperations}
                    onBulkOperation={executeBulkOperation}
                    onItemUpdate={loadAllData}
                    loading={bulkOperationsLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Диалоги создания и редактирования */}
          <WarehouseDialogs
            isRegionDialogOpen={dialogs.region}
            isCityDialogOpen={dialogs.city}
            isWarehouseDialogOpen={dialogs.warehouse}
            isArticleDialogOpen={false}
            isZoneDialogOpen={dialogs.zone}
            isSectionDialogOpen={dialogs.section}
            isEditRegionDialogOpen={dialogs.edit}
            isEditCityDialogOpen={dialogs.edit}
            isEditWarehouseDialogOpen={dialogs.edit}
            isEditArticleDialogOpen={false}
            isDeleteDialogOpen={false}
            deleteTarget={null}
            onCloseRegionDialog={() => actions.setDialog('region', false)}
            onCloseCityDialog={() => actions.setDialog('city', false)}
            onCloseWarehouseDialog={() => actions.setDialog('warehouse', false)}
            onCloseArticleDialog={() => {}}
            onCloseZoneDialog={() => actions.setDialog('zone', false)}
            onCloseSectionDialog={() => actions.setDialog('section', false)}
            onCloseEditDialog={() => actions.setDialog('edit', false)}
            onCloseDeleteDialog={() => {}}
            onCreateRegion={createRegion}
            onCreateCity={createCity}
            onCreateWarehouse={createWarehouse}
            onCreateArticle={async () => {}}
            onCreateZone={createZone}
            onCreateSection={createSection}
            onEditItem={async () => {}}
            onDeleteItem={async () => {}}
            editingItem={null}
            regions={[]}
            cities={[]}
            warehouses={[]}
            zones={[]}
            selectedRegionId={0}
            selectedCityId={0}
            selectedWarehouseId={0}
            selectedZoneId={0}
          />
        </div>
      </TooltipProvider>
    </AdminLayout>
  )
}