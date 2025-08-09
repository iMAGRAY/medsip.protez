"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ManufacturersManager } from "@/components/admin/manufacturers-manager"
import { ModelLinesManager } from "@/components/admin/model-lines-manager"
import { ProductsManager } from "@/components/admin/products-manager"
import {
  Building,
  Layers,
  Package,
  BarChart3,
  Activity
} from "lucide-react"

export default function ModelLinesDashboard() {
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<number | undefined>(undefined);
  const [selectedModelLineId, setSelectedModelLineId] = useState<number | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("overview");

  const handleManufacturerSelect = (manufacturerId: number) => {
    setSelectedManufacturerId(manufacturerId);
    setSelectedModelLineId(undefined);
    setSelectedProductId(undefined);
    setActiveTab("model-lines");
  };

  const handleModelLineSelect = (modelLineId: number) => {
    setSelectedModelLineId(modelLineId);
    setSelectedProductId(undefined);
    setActiveTab("products");
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
  };

  const resetSelection = () => {
    setSelectedManufacturerId(undefined);
    setSelectedModelLineId(undefined);
    setSelectedProductId(undefined);
    setActiveTab("overview");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Управление каталогом</h1>
            <p className="text-muted-foreground">
              Производители, линейки моделей и товары
            </p>
          </div>

          {(selectedManufacturerId || selectedModelLineId || selectedProductId) && (
            <Button variant="outline" onClick={resetSelection}>
              Сбросить фильтры
            </Button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        {(selectedManufacturerId || selectedModelLineId || selectedProductId) && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedManufacturerId(undefined);
                    setSelectedModelLineId(undefined);
                    setSelectedProductId(undefined);
                    setActiveTab("manufacturers");
                  }}
                >
                  Все производители
                </Button>

                {selectedManufacturerId && (
                  <>
                    <span>/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedModelLineId(undefined);
                        setSelectedProductId(undefined);
                        setActiveTab("model-lines");
                      }}
                    >
                      Производитель #{selectedManufacturerId}
                    </Button>
                  </>
                )}

                {selectedModelLineId && (
                  <>
                    <span>/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProductId(undefined);
                        setActiveTab("products");
                      }}
                    >
                      Линейка #{selectedModelLineId}
                    </Button>
                  </>
                )}

                {selectedProductId && (
                  <>
                    <span>/</span>
                    <Badge variant="default">
                      Товар #{selectedProductId}
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="manufacturers" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Производители
            </TabsTrigger>
            <TabsTrigger value="model-lines" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Линейки моделей
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Товары
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Производители
                  </CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Всего производителей в системе
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Линейки моделей
                  </CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Общее количество линеек
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Товары
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">
                    Всего товаров в каталоге
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Быстрые действия</CardTitle>
                  <CardDescription>
                    Основные операции для управления каталогом
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab("manufacturers")}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Управление производителями
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab("model-lines")}
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Управление линейками моделей
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab("products")}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Управление товарами
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Статус системы</CardTitle>
                  <CardDescription>
                    Информация о состоянии каталога
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API состояние</span>
                    <Badge variant="default">
                      <Activity className="h-3 w-3 mr-1" />
                      Активно
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Кэш</span>
                    <Badge variant="secondary">
                      Включен
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Последний импорт</span>
                    <span className="text-sm text-muted-foreground">-</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="manufacturers" className="space-y-6">
            <ManufacturersManager
              onManufacturerSelect={handleManufacturerSelect}
              selectedManufacturerId={selectedManufacturerId}
            />
          </TabsContent>

          <TabsContent value="model-lines" className="space-y-6">
            <ModelLinesManager
              manufacturerId={selectedManufacturerId}
              onModelLineSelect={handleModelLineSelect}
              selectedModelLineId={selectedModelLineId}
            />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <ProductsManager
              modelLineId={selectedModelLineId}
              onProductSelect={handleProductSelect}
              selectedProductId={selectedProductId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}