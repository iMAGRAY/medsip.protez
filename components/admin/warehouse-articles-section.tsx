"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductSelector } from '@/components/admin/product-selector'
import {
  Plus,
  Package,
  QrCode,
  Warehouse,
  AlertTriangle,
  Loader2,
  Edit,
  Trash2
} from 'lucide-react'

interface WarehouseProduct {
  id: number
  name: string
  description: string
  category_name: string
  manufacturer_name: string
  article_number: string
  price: string
}

interface WarehouseSection {
  id: number
  name: string
  zone_name: string
  warehouse_name: string
}

interface InventoryItem {
  id: number
  product_id: number
  product_name: string
  sku: string
  section_id: number
  section_name: string
  zone_name: string
  warehouse_name: string
  quantity: number
  min_stock: number
  max_stock: number
  unit_price: string
  status: string
  supplier: string
  batch_number: string
}

export function WarehouseArticlesSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sections, setSections] = useState<WarehouseSection[]>([])

  // Диалог создания складского артикула
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<WarehouseProduct | undefined>(undefined)
  const [form, setForm] = useState({
    sku: '',
    section_id: 0,
    quantity: 0,
    min_stock: 0,
    max_stock: 100,
    unit_price: '',
    supplier: '',
    batch_number: '',
    expiry_date: ''
  })

  // Диалоги редактирования и удаления
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [editForm, setEditForm] = useState({
    quantity: 0,
    min_stock: 0,
    max_stock: 100,
    unit_price: '',
    supplier: '',
    batch_number: '',
    expiry_date: ''
  })

  const fetchData = useCallback(async () => {
      try {
        setLoading(true)
        setError(null)

        // Загружаем складской инвентарь
        const inventoryResponse = await fetch('/api/warehouse/inventory')
        if (!inventoryResponse.ok) throw new Error('Ошибка загрузки инвентаря')
        const inventoryData = await inventoryResponse.json()
        setInventory(inventoryData.data || [])

        // Загружаем секции
        const sectionsResponse = await fetch('/api/warehouse/sections')
        if (!sectionsResponse.ok) throw new Error('Ошибка загрузки секций')
        const sectionsData = await sectionsResponse.json()
        setSections(sectionsData.data || [])

      } catch (error) {
        console.error('Ошибка загрузки данных:', error)
        setError(error instanceof Error ? error.message : 'Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateArticle = async () => {
    if (!selectedProduct || !form.sku || !form.section_id || form.quantity === undefined) {
      setError('Заполните все обязательные поля: товар, SKU, секция, количество')
      return
    }

    try {
      const response = await fetch('/api/warehouse/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          sku: form.sku,
          section_id: form.section_id,
          quantity: form.quantity,
          min_stock: form.min_stock,
          max_stock: form.max_stock,
          unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
          supplier: form.supplier,
          batch_number: form.batch_number,
          expiry_date: form.expiry_date || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка создания складского артикула')
      }

      // Обновляем данные и закрываем диалог
      await fetchData()
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Ошибка создания складского артикула:', error)
      setError(error instanceof Error ? error.message : 'Ошибка создания складского артикула')
    }
  }

  const resetForm = () => {
    setSelectedProduct(undefined)
    setForm({
      sku: '',
      section_id: 0,
      quantity: 0,
      min_stock: 0,
      max_stock: 100,
      unit_price: '',
      supplier: '',
      batch_number: '',
      expiry_date: ''
    })
    setError(null)
  }

  // Адаптер для ProductSelector
  const handleProductSelect = (product: any) => {
    if (product) {
      // Конвертируем Product из ProductSelector в WarehouseProduct
      const warehouseProduct: WarehouseProduct = {
        id: product.id,
        name: product.name,
        description: product.description,
        category_name: product.category_name,
        manufacturer_name: product.manufacturer_name,
        article_number: product.article_number,
        price: product.price
      }
      setSelectedProduct(warehouseProduct)
    } else {
      setSelectedProduct(undefined)
    }
  }

  const openEditDialog = (item: InventoryItem) => {
    setSelectedItem(item)
    setEditForm({
      quantity: item.quantity,
      min_stock: item.min_stock,
      max_stock: item.max_stock,
      unit_price: item.unit_price,
      supplier: item.supplier,
      batch_number: item.batch_number,
      expiry_date: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleEditArticle = async () => {
    if (!selectedItem) return

    try {
      const response = await fetch(`/api/warehouse/inventory/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editForm.quantity,
          min_stock: editForm.min_stock,
          max_stock: editForm.max_stock,
          unit_price: editForm.unit_price ? parseFloat(editForm.unit_price) : null,
          supplier: editForm.supplier,
          batch_number: editForm.batch_number,
          expiry_date: editForm.expiry_date || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка обновления складского артикула')
      }

      await fetchData()
      setIsEditDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Ошибка обновления складского артикула:', error)
      setError(error instanceof Error ? error.message : 'Ошибка обновления складского артикула')
    }
  }

  const openDeleteDialog = (item: InventoryItem) => {
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteArticle = async () => {
    if (!selectedItem) return

    try {
      const response = await fetch(`/api/warehouse/inventory/${selectedItem.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка удаления складского артикула')
      }

      await fetchData()
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Ошибка удаления складского артикула:', error)
      setError(error instanceof Error ? error.message : 'Ошибка удаления складского артикула')
    }
  }

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(parseFloat(price))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">В наличии</Badge>
      case 'low_stock':
        return <Badge variant="secondary">Мало</Badge>
      case 'out_of_stock':
        return <Badge variant="destructive">Нет в наличии</Badge>
      case 'discontinued':
        return <Badge variant="outline">Снято</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Загрузка складских артикулов...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Складские артикулы</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить товар на склад
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Добавить товар на склад</DialogTitle>
              <DialogDescription>
                Размещение выбранного товара на складе с указанием складского артикула, секции и параметров хранения.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Выбор товара */}
              <div className="space-y-2">
                <Label>Товар *</Label>
                <ProductSelector
                  selectedProduct={selectedProduct as any}
                  onProductSelect={handleProductSelect}
                />
              </div>

              {/* Складской артикул и секция */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Складской артикул (SKU) *</Label>
                  <Input
                    id="sku"
                    placeholder="WH-001-ABC"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="section">Секция склада *</Label>
                  <Select
                    value={form.section_id.toString()}
                    onValueChange={(value) => setForm({ ...form, section_id: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите секцию" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id.toString()}>
                          {section.name} ({section.zone_name} - {section.warehouse_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Количество и остатки */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Количество *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_stock">Мин. остаток</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min="0"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_stock">Макс. остаток</Label>
                  <Input
                    id="max_stock"
                    type="number"
                    min="0"
                    value={form.max_stock}
                    onChange={(e) => setForm({ ...form, max_stock: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Цена и поставщик */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Цена за единицу</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Поставщик</Label>
                  <Input
                    id="supplier"
                    placeholder="Название поставщика"
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  />
                </div>
              </div>

              {/* Партия и срок годности */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch_number">Номер партии</Label>
                  <Input
                    id="batch_number"
                    placeholder="BATCH-2025-001"
                    value={form.batch_number}
                    onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Срок годности</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateArticle}>
                Добавить на склад
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Список складских артикулов */}
      <div className="grid gap-4">
        {inventory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Складские артикулы не найдены</p>
            <p className="text-sm text-gray-400 mt-1">
              Добавьте товары на склад, чтобы начать управление инвентарем
            </p>
          </div>
        ) : (
          inventory.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    {item.sku} - {item.product_name}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <Badge variant="outline">
                      {item.quantity} шт
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Warehouse className="h-3 w-3" />
                        {item.warehouse_name}
                      </span>
                      <span>→ {item.zone_name}</span>
                      <span>→ {item.section_name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Мин: {item.min_stock}</span>
                      <span>Макс: {item.max_stock}</span>
                      {item.supplier && <span>Поставщик: {item.supplier}</span>}
                    </div>

                    {item.batch_number && (
                      <div className="text-xs text-gray-500 mt-2">
                        Партия: {item.batch_number}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {item.unit_price && (
                      <p className="text-lg font-semibold">{formatPrice(item.unit_price)}</p>
                    )}
                    <div className="flex justify-end gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Изменить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Диалог редактирования */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать артикул: {selectedItem?.sku}</DialogTitle>
            <DialogDescription>
              Изменение параметров складского артикула, включая количество, остатки, цену и информацию о поставщике.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Количество и остатки */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Количество</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="0"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-min-stock">Мин. остаток</Label>
                <Input
                  id="edit-min-stock"
                  type="number"
                  min="0"
                  value={editForm.min_stock}
                  onChange={(e) => setEditForm({ ...editForm, min_stock: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-max-stock">Макс. остаток</Label>
                <Input
                  id="edit-max-stock"
                  type="number"
                  min="0"
                  value={editForm.max_stock}
                  onChange={(e) => setEditForm({ ...editForm, max_stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Цена и поставщик */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-unit-price">Цена за единицу</Label>
                <Input
                  id="edit-unit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editForm.unit_price}
                  onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Поставщик</Label>
                <Input
                  id="edit-supplier"
                  placeholder="Название поставщика"
                  value={editForm.supplier}
                  onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                />
              </div>
            </div>

            {/* Партия и срок годности */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-batch-number">Номер партии</Label>
                <Input
                  id="edit-batch-number"
                  placeholder="BATCH-2025-001"
                  value={editForm.batch_number}
                  onChange={(e) => setEditForm({ ...editForm, batch_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expiry-date">Срок годности</Label>
                <Input
                  id="edit-expiry-date"
                  type="date"
                  value={editForm.expiry_date}
                  onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleEditArticle}>
              Сохранить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить артикул?</DialogTitle>
            <DialogDescription>
              Подтверждение удаления складского артикула и всех связанных с ним данных из системы.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Вы уверены, что хотите удалить артикул <strong>{selectedItem?.sku}</strong> из склада?
            </p>
            <p className="text-sm text-gray-600">
              Это действие нельзя отменить. Все данные о товаре в этой секции будут удалены.
            </p>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeleteArticle}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}