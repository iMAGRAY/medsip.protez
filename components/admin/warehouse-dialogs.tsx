"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { GroupedSearchableSelect } from '@/components/ui/grouped-searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Loader2, Save, X, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RUSSIAN_REGIONS, FEDERAL_DISTRICTS } from '@/lib/constants'

// Интерфейсы для форм
interface FormData {
  [key: string]: any
}

interface EditableItem {
  id: number
  name: string
  [key: string]: any
}

interface WarehouseDialogsProps {
  // Состояния диалогов создания
  isRegionDialogOpen: boolean
  isCityDialogOpen: boolean
  isWarehouseDialogOpen: boolean
  isArticleDialogOpen: boolean
  isZoneDialogOpen: boolean
  isSectionDialogOpen: boolean

  // Состояния диалогов редактирования
  isEditRegionDialogOpen?: boolean
  isEditCityDialogOpen?: boolean
  isEditWarehouseDialogOpen?: boolean
  isEditArticleDialogOpen?: boolean

  // Состояния диалогов удаления
  isDeleteDialogOpen?: boolean
  deleteTarget?: {type: string, item: EditableItem} | null

  // Обработчики закрытия
  onCloseRegionDialog: () => void
  onCloseCityDialog: () => void
  onCloseWarehouseDialog: () => void
  onCloseArticleDialog: () => void
  onCloseZoneDialog: () => void
  onCloseSectionDialog: () => void
  onCloseEditDialog?: () => void
  onCloseDeleteDialog?: () => void

  // Обработчики создания
  onCreateRegion: (data: FormData) => Promise<void>
  onCreateCity: (data: FormData) => Promise<void>
  onCreateWarehouse: (data: FormData) => Promise<void>
  onCreateArticle: (data: FormData) => Promise<void>
  onCreateZone: (data: FormData) => Promise<void>
  onCreateSection: (data: FormData) => Promise<void>

  // Обработчики редактирования и удаления
  onEditItem?: (type: string, data: FormData) => Promise<void>
  onDeleteItem?: (type: string, id: number) => Promise<void>
  editingItem?: EditableItem | null

  // Данные для селектов
  regions: Array<{id: number, name: string}>
  cities: Array<{id: number, name: string, region_id: number}>
  warehouses: Array<{id: number, name: string}>
  zones: Array<{id: number, name: string, warehouse_id: number}>

  // Выбранные родительские элементы
  selectedRegionId: number
  selectedCityId: number
  selectedWarehouseId: number
  selectedZoneId: number
}

export const WarehouseDialogs: React.FC<WarehouseDialogsProps> = ({
  isRegionDialogOpen,
  isCityDialogOpen,
  isWarehouseDialogOpen,
  isArticleDialogOpen,
  isZoneDialogOpen,
  isSectionDialogOpen,
  isEditRegionDialogOpen = false,
  isEditCityDialogOpen = false,
  isEditWarehouseDialogOpen = false,
  isEditArticleDialogOpen = false,
  isDeleteDialogOpen = false,
  deleteTarget = null,
  onCloseRegionDialog,
  onCloseCityDialog,
  onCloseWarehouseDialog,
  onCloseArticleDialog,
  onCloseZoneDialog,
  onCloseSectionDialog,
  onCloseEditDialog = () => {},
  onCloseDeleteDialog = () => {},
  onCreateRegion,
  onCreateCity,
  onCreateWarehouse,
  onCreateArticle,
  onCreateZone,
  onCreateSection,
  onEditItem = async () => {},
  onDeleteItem = async () => {},
  editingItem = null,
  regions,
  cities,
  warehouses,
  zones,
  selectedRegionId,
  selectedCityId,
  selectedWarehouseId,
  selectedZoneId
}) => {
  const [loading, setLoading] = useState(false)

  // Состояния форм создания
  const [regionForm, setRegionForm] = useState({ name: '', code: '', description: '', selectedRegion: '' })
  const [cityForm, setCityForm] = useState({ name: '', code: '', description: '', region_id: selectedRegionId })
  const [warehouseForm, setWarehouseForm] = useState({
    name: '', code: '', address: '', phone: '', email: '', manager_name: '',
    total_capacity: 0, warehouse_type: 'main', city_id: selectedCityId
  })
  const [articleForm, setArticleForm] = useState({
    article_code: '', name: '', description: '', category: '', subcategory: '',
    brand: '', model: '', unit_of_measure: 'шт', weight_kg: 0, dimensions_cm: '', barcode: ''
  })
  const [zoneForm, setZoneForm] = useState({
    name: '', description: '', location: 'near', capacity: 100,
    temperature_min: -10, temperature_max: 25, humidity_min: 30, humidity_max: 70,
    warehouse_id: selectedWarehouseId
  })
  const [sectionForm, setSectionForm] = useState({
    name: '', description: '', capacity: 50, row_number: 1, shelf_number: 1, zone_id: selectedZoneId
  })

  // Состояния форм редактирования
  const [editForm, setEditForm] = useState<FormData>({})

  // Загрузка данных для редактирования
  useEffect(() => {
    if (editingItem) {
      setEditForm({...editingItem})
    }
  }, [editingItem])

  const handleSubmit = async (type: string, formData: FormData, handler: (data: FormData) => Promise<void>) => {
    setLoading(true)
    try {
      await handler(formData)
    } catch (error) {
      console.error(`Ошибка создания ${type}:`, error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (type: string, formData: FormData) => {
    setLoading(true)
    try {
      await onEditItem(type, formData)
    } catch (error) {
      console.error(`Ошибка редактирования ${type}:`, error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setLoading(true)
    try {
      await onDeleteItem(deleteTarget.type, deleteTarget.item.id)
    } catch (error) {
      console.error(`Ошибка удаления ${deleteTarget.type}:`, error)
    } finally {
      setLoading(false)
    }
  }

  const clearForms = () => {
    setRegionForm({ name: '', code: '', description: '', selectedRegion: '' })
    setCityForm({ name: '', code: '', description: '', region_id: selectedRegionId })
    setWarehouseForm({
      name: '', code: '', address: '', phone: '', email: '', manager_name: '',
      total_capacity: 0, warehouse_type: 'main', city_id: selectedCityId
    })
    setArticleForm({
      article_code: '', name: '', description: '', category: '', subcategory: '',
      brand: '', model: '', unit_of_measure: 'шт', weight_kg: 0, dimensions_cm: '', barcode: ''
    })
    setZoneForm({
      name: '', description: '', location: 'near', capacity: 100,
      temperature_min: -10, temperature_max: 25, humidity_min: 30, humidity_max: 70,
      warehouse_id: selectedWarehouseId
    })
    setSectionForm({
      name: '', description: '', capacity: 50, row_number: 1, shelf_number: 1, zone_id: selectedZoneId
    })
  }

  // Диалог подтверждения удаления
  const DeleteConfirmationDialog = () => (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={onCloseDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Подтверждение удаления
          </AlertDialogTitle>
          <AlertDialogDescription>
            Вы уверены, что хотите удалить {deleteTarget?.type} &quot;{deleteTarget?.item.name}&quot;?
            {deleteTarget?.type === 'регион' && (
              <div className="mt-2 p-2 bg-orange-50 rounded text-sm">
                <strong>Внимание:</strong> Удаление региона возможно только если в нём нет активных городов.
              </div>
            )}
            {deleteTarget?.type === 'город' && (
              <div className="mt-2 p-2 bg-orange-50 rounded text-sm">
                <strong>Внимание:</strong> Удаление города возможно только если в нём нет активных складов.
              </div>
            )}
            <div className="mt-2 text-sm text-gray-600">
              Это действие нельзя отменить.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <>
      <DeleteConfirmationDialog />

      {/* Диалог создания региона */}
      <Dialog open={isRegionDialogOpen} onOpenChange={onCloseRegionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать новый регион</DialogTitle>
            <DialogDescription>
              Создание нового регионального подразделения складской сети для географической организации хранения товаров.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="region-select">Выбор региона</Label>
              <GroupedSearchableSelect
                options={RUSSIAN_REGIONS.map(region => ({
                  value: region.code,
                  label: region.name,
                  group: region.federal_district
                }))}
                value={regionForm.selectedRegion || ''}
                onValueChange={(value) => {
                  const selectedRegion = RUSSIAN_REGIONS.find(r => r.code === value)
                  if (selectedRegion) {
                    setRegionForm({
                      ...regionForm,
                      selectedRegion: value,
                      name: selectedRegion.name,
                      code: selectedRegion.code,
                      description: `${selectedRegion.fullName} (${selectedRegion.federal_district})`
                    })
                  }
                }}
                placeholder="Выберите регион из списка"
                searchPlaceholder="Поиск по названию или федеральному округу..."
                maxHeight="400px"
              />
            </div>

            {regionForm.selectedRegion && (
              <>
                <div>
                  <Label htmlFor="region-name">Название (автозаполнение)</Label>
                  <Input
                    id="region-name"
                    value={regionForm.name}
                    onChange={(e) => setRegionForm({...regionForm, name: e.target.value})}
                    placeholder="Название региона"
                  />
                </div>
                <div>
                  <Label htmlFor="region-code">Код (автозаполнение)</Label>
                  <Input
                    id="region-code"
                    value={regionForm.code}
                    onChange={(e) => setRegionForm({...regionForm, code: e.target.value})}
                    placeholder="Код региона"
                  />
                </div>
                <div>
                  <Label htmlFor="region-description">Описание (автозаполнение)</Label>
                  <Textarea
                    id="region-description"
                    value={regionForm.description}
                    onChange={(e) => setRegionForm({...regionForm, description: e.target.value})}
                    placeholder="Описание региона"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onCloseRegionDialog(); clearForms(); }}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('региона', regionForm, onCreateRegion)}
              disabled={loading || !regionForm.name || !regionForm.code}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования региона */}
      <Dialog open={isEditRegionDialogOpen} onOpenChange={onCloseEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Редактировать регион
            </DialogTitle>
            <DialogDescription>
              Изменение параметров существующего регионального подразделения, включая название, код и описание.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-region-name">Название</Label>
              <Input
                id="edit-region-name"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Название региона"
              />
            </div>
            <div>
              <Label htmlFor="edit-region-code">Код</Label>
              <Input
                id="edit-region-code"
                value={editForm.code || ''}
                onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                placeholder="Код региона"
              />
            </div>
            <div>
              <Label htmlFor="edit-region-description">Описание</Label>
              <Textarea
                id="edit-region-description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                placeholder="Описание региона"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleEdit('регион', editForm)}
              disabled={loading || !editForm.name || !editForm.code}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания города */}
      <Dialog open={isCityDialogOpen} onOpenChange={onCloseCityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать новый город</DialogTitle>
            <DialogDescription>
              Добавление нового города в выбранный регион для более детальной географической структуры складской сети.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="city-region">Регион</Label>
              <Select
                value={cityForm.region_id?.toString()}
                onValueChange={(value) => setCityForm({...cityForm, region_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите регион" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city-name">Название</Label>
              <Input
                id="city-name"
                value={cityForm.name}
                onChange={(e) => setCityForm({...cityForm, name: e.target.value})}
                placeholder="Название города"
              />
            </div>
            <div>
              <Label htmlFor="city-code">Код</Label>
              <Input
                id="city-code"
                value={cityForm.code}
                onChange={(e) => setCityForm({...cityForm, code: e.target.value})}
                placeholder="Код города"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onCloseCityDialog(); clearForms(); }}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('города', cityForm, onCreateCity)}
              disabled={loading || !cityForm.name || !cityForm.code || !cityForm.region_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования города */}
      <Dialog open={isEditCityDialogOpen} onOpenChange={onCloseEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Редактировать город
            </DialogTitle>
            <DialogDescription>
              Изменение информации о городе, включая название, код и принадлежность к региону.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-city-region">Регион</Label>
              <Select
                value={editForm.region_id?.toString()}
                onValueChange={(value) => setEditForm({...editForm, region_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите регион" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-city-name">Название</Label>
              <Input
                id="edit-city-name"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Название города"
              />
            </div>
            <div>
              <Label htmlFor="edit-city-code">Код</Label>
              <Input
                id="edit-city-code"
                value={editForm.code || ''}
                onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                placeholder="Код города"
              />
            </div>
            <div>
              <Label htmlFor="edit-city-description">Описание</Label>
              <Textarea
                id="edit-city-description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                placeholder="Описание города"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleEdit('город', editForm)}
              disabled={loading || !editForm.name || !editForm.code || !editForm.region_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания склада */}
      <Dialog open={isWarehouseDialogOpen} onOpenChange={onCloseWarehouseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новый склад</DialogTitle>
            <DialogDescription>
              Создание нового складского объекта в выбранном городе с указанием контактной информации и параметров хранения.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <Label htmlFor="warehouse-city">Город</Label>
              <Select
                value={warehouseForm.city_id?.toString()}
                onValueChange={(value) => setWarehouseForm({...warehouseForm, city_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите город" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id.toString()}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warehouse-name">Название</Label>
                <Input
                  id="warehouse-name"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({...warehouseForm, name: e.target.value})}
                  placeholder="Название склада"
                />
              </div>
              <div>
                <Label htmlFor="warehouse-code">Код</Label>
                <Input
                  id="warehouse-code"
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm({...warehouseForm, code: e.target.value})}
                  placeholder="Код склада"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="warehouse-address">Адрес</Label>
              <Input
                id="warehouse-address"
                value={warehouseForm.address}
                onChange={(e) => setWarehouseForm({...warehouseForm, address: e.target.value})}
                placeholder="Адрес склада"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warehouse-phone">Телефон</Label>
                <Input
                  id="warehouse-phone"
                  value={warehouseForm.phone}
                  onChange={(e) => setWarehouseForm({...warehouseForm, phone: e.target.value})}
                  placeholder="Телефон"
                />
              </div>
              <div>
                <Label htmlFor="warehouse-email">Email</Label>
                <Input
                  id="warehouse-email"
                  type="email"
                  value={warehouseForm.email}
                  onChange={(e) => setWarehouseForm({...warehouseForm, email: e.target.value})}
                  placeholder="Email"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onCloseWarehouseDialog(); clearForms(); }}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('склада', warehouseForm, onCreateWarehouse)}
              disabled={loading || !warehouseForm.name || !warehouseForm.code}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования склада */}
      <Dialog open={isEditWarehouseDialogOpen} onOpenChange={onCloseEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Редактировать склад
            </DialogTitle>
            <DialogDescription>
              Изменение параметров складского объекта, включая контактную информацию, адрес и характеристики хранения.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            <div>
              <Label htmlFor="edit-warehouse-name">Название *</Label>
              <Input
                id="edit-warehouse-name"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Название склада"
              />
            </div>
            <div>
              <Label htmlFor="edit-warehouse-code">Код *</Label>
              <Input
                id="edit-warehouse-code"
                value={editForm.code || ''}
                onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                placeholder="Код склада"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-warehouse-address">Адрес</Label>
              <Textarea
                id="edit-warehouse-address"
                value={editForm.address || ''}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                placeholder="Полный адрес склада"
              />
            </div>
            <div>
              <Label htmlFor="edit-warehouse-phone">Телефон</Label>
              <Input
                id="edit-warehouse-phone"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                placeholder="+7 (000) 000-00-00"
              />
            </div>
            <div>
              <Label htmlFor="edit-warehouse-email">Email</Label>
              <Input
                id="edit-warehouse-email"
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                placeholder="warehouse@company.com"
              />
            </div>
            <div>
              <Label htmlFor="edit-warehouse-manager">Менеджер</Label>
              <Input
                id="edit-warehouse-manager"
                value={editForm.manager_name || ''}
                onChange={(e) => setEditForm({...editForm, manager_name: e.target.value})}
                placeholder="ФИО менеджера"
              />
            </div>
            <div>
              <Label htmlFor="edit-warehouse-type">Тип склада</Label>
              <Select
                value={editForm.warehouse_type?.toString()}
                onValueChange={(value) => setEditForm({...editForm, warehouse_type: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                                          <SelectItem value="main">Главный</SelectItem>
                  <SelectItem value="secondary">Вспомогательный</SelectItem>
                  <SelectItem value="temporary">Временный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-warehouse-capacity">Вместимость (м³)</Label>
              <Input
                id="edit-warehouse-capacity"
                type="number"
                value={editForm.total_capacity || 0}
                onChange={(e) => setEditForm({...editForm, total_capacity: parseInt(e.target.value)})}
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleEdit('склад', editForm)}
              disabled={loading || !editForm.name || !editForm.code}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Остальные диалоги можно добавить аналогично... */}

      {/* Диалог создания зоны */}
      <Dialog open={isZoneDialogOpen} onOpenChange={onCloseZoneDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новую зону</DialogTitle>
            <DialogDescription>
              Добавление новой логической зоны внутри склада для организации товаров по типам или условиям хранения.
            </DialogDescription>
                      <DialogDescription>
              Добавление новой логической зоны внутри склада для организации товаров по типам или условиям хранения.
            </DialogDescription>
</DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <Label htmlFor="zone-warehouse">Склад</Label>
              <Select
                value={zoneForm.warehouse_id?.toString()}
                onValueChange={(value) => setZoneForm({...zoneForm, warehouse_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-name">Название</Label>
                <Input
                  id="zone-name"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({...zoneForm, name: e.target.value})}
                  placeholder="Название зоны"
                />
              </div>
              <div>
                <Label htmlFor="zone-location">Расположение</Label>
                <Select
                  value={zoneForm.location}
                  onValueChange={(value) => setZoneForm({...zoneForm, location: value as 'near' | 'far'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите расположение" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="near">Ближняя</SelectItem>
                    <SelectItem value="far">Дальняя</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="zone-description">Описание</Label>
              <Textarea
                id="zone-description"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({...zoneForm, description: e.target.value})}
                placeholder="Описание зоны"
              />
            </div>
            <div>
              <Label htmlFor="zone-capacity">Вместимость</Label>
              <Input
                id="zone-capacity"
                type="number"
                value={zoneForm.capacity}
                onChange={(e) => setZoneForm({...zoneForm, capacity: parseInt(e.target.value) || 0})}
                placeholder="100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-temp-min">Мин. температура (°C)</Label>
                <Input
                  id="zone-temp-min"
                  type="number"
                  value={zoneForm.temperature_min}
                  onChange={(e) => setZoneForm({...zoneForm, temperature_min: parseInt(e.target.value) || -10})}
                  placeholder="-10"
                />
              </div>
              <div>
                <Label htmlFor="zone-temp-max">Макс. температура (°C)</Label>
                <Input
                  id="zone-temp-max"
                  type="number"
                  value={zoneForm.temperature_max}
                  onChange={(e) => setZoneForm({...zoneForm, temperature_max: parseInt(e.target.value) || 25})}
                  placeholder="25"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-humidity-min">Мин. влажность (%)</Label>
                <Input
                  id="zone-humidity-min"
                  type="number"
                  value={zoneForm.humidity_min}
                  onChange={(e) => setZoneForm({...zoneForm, humidity_min: parseInt(e.target.value) || 30})}
                  placeholder="30"
                />
              </div>
              <div>
                <Label htmlFor="zone-humidity-max">Макс. влажность (%)</Label>
                <Input
                  id="zone-humidity-max"
                  type="number"
                  value={zoneForm.humidity_max}
                  onChange={(e) => setZoneForm({...zoneForm, humidity_max: parseInt(e.target.value) || 70})}
                  placeholder="70"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseZoneDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('зоны', zoneForm, onCreateZone)}
              disabled={loading || !zoneForm.name || !zoneForm.warehouse_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания секции */}
      <Dialog open={isSectionDialogOpen} onOpenChange={onCloseSectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать новую секцию</DialogTitle>
            <DialogDescription>
              Создание новой секции внутри зоны для детального позиционирования товаров с указанием ряда и полки.
            </DialogDescription>
                      <DialogDescription>
              Создание новой секции внутри зоны для детального позиционирования товаров с указанием ряда и полки.
            </DialogDescription>
</DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-zone">Зона</Label>
              <Select
                value={sectionForm.zone_id?.toString()}
                onValueChange={(value) => setSectionForm({...sectionForm, zone_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите зону" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="section-name">Название</Label>
              <Input
                id="section-name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({...sectionForm, name: e.target.value})}
                placeholder="Название секции"
              />
            </div>
            <div>
              <Label htmlFor="section-description">Описание</Label>
              <Textarea
                id="section-description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm({...sectionForm, description: e.target.value})}
                placeholder="Описание секции"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="section-capacity">Вместимость</Label>
                <Input
                  id="section-capacity"
                  type="number"
                  value={sectionForm.capacity}
                  onChange={(e) => setSectionForm({...sectionForm, capacity: parseInt(e.target.value) || 0})}
                  placeholder="50"
                />
              </div>
              <div>
                <Label htmlFor="section-row">Ряд</Label>
                <Input
                  id="section-row"
                  type="number"
                  value={sectionForm.row_number}
                  onChange={(e) => setSectionForm({...sectionForm, row_number: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="section-shelf">Полка</Label>
                <Input
                  id="section-shelf"
                  type="number"
                  value={sectionForm.shelf_number}
                  onChange={(e) => setSectionForm({...sectionForm, shelf_number: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseSectionDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('секции', sectionForm, onCreateSection)}
              disabled={loading || !sectionForm.name || !sectionForm.zone_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания артикула */}
      <Dialog open={isArticleDialogOpen} onOpenChange={onCloseArticleDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новый артикул</DialogTitle>
            <DialogDescription>
              Создание нового складского артикула с уникальным кодом и описанием для учета товаров.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-code">Код артикула</Label>
                <Input
                  id="article-code"
                  value={articleForm.article_code}
                  onChange={(e) => setArticleForm({...articleForm, article_code: e.target.value})}
                  placeholder="ART001"
                />
              </div>
              <div>
                <Label htmlFor="article-name">Название</Label>
                <Input
                  id="article-name"
                  value={articleForm.name}
                  onChange={(e) => setArticleForm({...articleForm, name: e.target.value})}
                  placeholder="Название товара"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="article-description">Описание</Label>
              <Textarea
                id="article-description"
                value={articleForm.description}
                onChange={(e) => setArticleForm({...articleForm, description: e.target.value})}
                placeholder="Описание товара"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-category">Категория</Label>
                <Input
                  id="article-category"
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({...articleForm, category: e.target.value})}
                  placeholder="Протезы"
                />
              </div>
              <div>
                <Label htmlFor="article-subcategory">Подкатегория</Label>
                <Input
                  id="article-subcategory"
                  value={articleForm.subcategory}
                  onChange={(e) => setArticleForm({...articleForm, subcategory: e.target.value})}
                  placeholder="Руки"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-brand">Бренд</Label>
                <Input
                  id="article-brand"
                  value={articleForm.brand}
                  onChange={(e) => setArticleForm({...articleForm, brand: e.target.value})}
                  placeholder="Название бренда"
                />
              </div>
              <div>
                <Label htmlFor="article-model">Модель</Label>
                <Input
                  id="article-model"
                  value={articleForm.model}
                  onChange={(e) => setArticleForm({...articleForm, model: e.target.value})}
                  placeholder="Модель"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="article-unit">Ед. измерения</Label>
                <Select
                  value={articleForm.unit_of_measure}
                  onValueChange={(value) => setArticleForm({...articleForm, unit_of_measure: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="шт" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="шт">шт</SelectItem>
                    <SelectItem value="пара">пара</SelectItem>
                    <SelectItem value="комплект">комплект</SelectItem>
                    <SelectItem value="кг">кг</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="article-weight">Вес (кг)</Label>
                <Input
                  id="article-weight"
                  type="number"
                  step="0.1"
                  value={articleForm.weight_kg}
                  onChange={(e) => setArticleForm({...articleForm, weight_kg: parseFloat(e.target.value) || 0})}
                  placeholder="1.5"
                />
              </div>
              <div>
                <Label htmlFor="article-dimensions">Размеры (см)</Label>
                <Input
                  id="article-dimensions"
                  value={articleForm.dimensions_cm}
                  onChange={(e) => setArticleForm({...articleForm, dimensions_cm: e.target.value})}
                  placeholder="30x20x10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="article-barcode">Штрихкод</Label>
              <Input
                id="article-barcode"
                value={articleForm.barcode}
                onChange={(e) => setArticleForm({...articleForm, barcode: e.target.value})}
                placeholder="1234567890123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseArticleDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('артикула', articleForm, onCreateArticle)}
              disabled={loading || !articleForm.article_code || !articleForm.name}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования артикула */}
      <Dialog open={isEditArticleDialogOpen} onOpenChange={onCloseEditDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Редактировать артикул
            </DialogTitle>
            <DialogDescription>
              Изменение параметров существующего складского артикула, включая код, название и описание.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            <div>
              <Label htmlFor="edit-article-code">Артикул *</Label>
              <Input
                id="edit-article-code"
                value={editForm.article_code || ''}
                onChange={(e) => setEditForm({...editForm, article_code: e.target.value})}
                placeholder="PROD-001"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-name">Название *</Label>
              <Input
                id="edit-article-name"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="Название товара"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-article-description">Описание</Label>
              <Textarea
                id="edit-article-description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                placeholder="Описание товара"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-category">Категория</Label>
              <Input
                id="edit-article-category"
                value={editForm.category || ''}
                onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                placeholder="Категория"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-subcategory">Подкатегория</Label>
              <Input
                id="edit-article-subcategory"
                value={editForm.subcategory || ''}
                onChange={(e) => setEditForm({...editForm, subcategory: e.target.value})}
                placeholder="Подкатегория"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-brand">Бренд</Label>
              <Input
                id="edit-article-brand"
                value={editForm.brand || ''}
                onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                placeholder="Бренд"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-model">Модель</Label>
              <Input
                id="edit-article-model"
                value={editForm.model || ''}
                onChange={(e) => setEditForm({...editForm, model: e.target.value})}
                placeholder="Модель"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-unit">Единица измерения</Label>
              <Select
                value={editForm.unit_of_measure?.toString()}
                onValueChange={(value) => setEditForm({...editForm, unit_of_measure: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите единицу" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="шт">шт</SelectItem>
                  <SelectItem value="кг">кг</SelectItem>
                  <SelectItem value="л">л</SelectItem>
                  <SelectItem value="м">м</SelectItem>
                  <SelectItem value="м²">м²</SelectItem>
                  <SelectItem value="м³">м³</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-article-weight">Вес (кг)</Label>
              <Input
                id="edit-article-weight"
                type="number"
                step="0.01"
                value={editForm.weight_kg || 0}
                onChange={(e) => setEditForm({...editForm, weight_kg: parseFloat(e.target.value)})}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-dimensions">Размеры (см)</Label>
              <Input
                id="edit-article-dimensions"
                value={editForm.dimensions_cm || ''}
                onChange={(e) => setEditForm({...editForm, dimensions_cm: e.target.value})}
                placeholder="ДxШxВ (например, 10x5x3)"
              />
            </div>
            <div>
              <Label htmlFor="edit-article-barcode">Штрихкод</Label>
              <Input
                id="edit-article-barcode"
                value={editForm.barcode || ''}
                onChange={(e) => setEditForm({...editForm, barcode: e.target.value})}
                placeholder="1234567890123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleEdit('товар', editForm)}
              disabled={loading || !editForm.article_code || !editForm.name}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Остальные диалоги можно добавить аналогично... */}

      {/* Диалог создания зоны */}
      <Dialog open={isZoneDialogOpen} onOpenChange={onCloseZoneDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новую зону</DialogTitle>
            <DialogDescription>
              Добавление новой логической зоны внутри склада для организации товаров по типам или условиям хранения.
            </DialogDescription>
                      <DialogDescription>
              Добавление новой логической зоны внутри склада для организации товаров по типам или условиям хранения.
            </DialogDescription>
</DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <Label htmlFor="zone-warehouse">Склад</Label>
              <Select
                value={zoneForm.warehouse_id?.toString()}
                onValueChange={(value) => setZoneForm({...zoneForm, warehouse_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-name">Название</Label>
                <Input
                  id="zone-name"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({...zoneForm, name: e.target.value})}
                  placeholder="Название зоны"
                />
              </div>
              <div>
                <Label htmlFor="zone-location">Расположение</Label>
                <Select
                  value={zoneForm.location}
                  onValueChange={(value) => setZoneForm({...zoneForm, location: value as 'near' | 'far'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите расположение" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="near">Ближняя</SelectItem>
                    <SelectItem value="far">Дальняя</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="zone-description">Описание</Label>
              <Textarea
                id="zone-description"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({...zoneForm, description: e.target.value})}
                placeholder="Описание зоны"
              />
            </div>
            <div>
              <Label htmlFor="zone-capacity">Вместимость</Label>
              <Input
                id="zone-capacity"
                type="number"
                value={zoneForm.capacity}
                onChange={(e) => setZoneForm({...zoneForm, capacity: parseInt(e.target.value) || 0})}
                placeholder="100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-temp-min">Мин. температура (°C)</Label>
                <Input
                  id="zone-temp-min"
                  type="number"
                  value={zoneForm.temperature_min}
                  onChange={(e) => setZoneForm({...zoneForm, temperature_min: parseInt(e.target.value) || -10})}
                  placeholder="-10"
                />
              </div>
              <div>
                <Label htmlFor="zone-temp-max">Макс. температура (°C)</Label>
                <Input
                  id="zone-temp-max"
                  type="number"
                  value={zoneForm.temperature_max}
                  onChange={(e) => setZoneForm({...zoneForm, temperature_max: parseInt(e.target.value) || 25})}
                  placeholder="25"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-humidity-min">Мин. влажность (%)</Label>
                <Input
                  id="zone-humidity-min"
                  type="number"
                  value={zoneForm.humidity_min}
                  onChange={(e) => setZoneForm({...zoneForm, humidity_min: parseInt(e.target.value) || 30})}
                  placeholder="30"
                />
              </div>
              <div>
                <Label htmlFor="zone-humidity-max">Макс. влажность (%)</Label>
                <Input
                  id="zone-humidity-max"
                  type="number"
                  value={zoneForm.humidity_max}
                  onChange={(e) => setZoneForm({...zoneForm, humidity_max: parseInt(e.target.value) || 70})}
                  placeholder="70"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseZoneDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('зоны', zoneForm, onCreateZone)}
              disabled={loading || !zoneForm.name || !zoneForm.warehouse_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания секции */}
      <Dialog open={isSectionDialogOpen} onOpenChange={onCloseSectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать новую секцию</DialogTitle>
            <DialogDescription>
              Создание новой секции внутри зоны для детального позиционирования товаров с указанием ряда и полки.
            </DialogDescription>
                      <DialogDescription>
              Создание новой секции внутри зоны для детального позиционирования товаров с указанием ряда и полки.
            </DialogDescription>
</DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-zone">Зона</Label>
              <Select
                value={sectionForm.zone_id?.toString()}
                onValueChange={(value) => setSectionForm({...sectionForm, zone_id: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите зону" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="section-name">Название</Label>
              <Input
                id="section-name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({...sectionForm, name: e.target.value})}
                placeholder="Название секции"
              />
            </div>
            <div>
              <Label htmlFor="section-description">Описание</Label>
              <Textarea
                id="section-description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm({...sectionForm, description: e.target.value})}
                placeholder="Описание секции"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="section-capacity">Вместимость</Label>
                <Input
                  id="section-capacity"
                  type="number"
                  value={sectionForm.capacity}
                  onChange={(e) => setSectionForm({...sectionForm, capacity: parseInt(e.target.value) || 0})}
                  placeholder="50"
                />
              </div>
              <div>
                <Label htmlFor="section-row">Ряд</Label>
                <Input
                  id="section-row"
                  type="number"
                  value={sectionForm.row_number}
                  onChange={(e) => setSectionForm({...sectionForm, row_number: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="section-shelf">Полка</Label>
                <Input
                  id="section-shelf"
                  type="number"
                  value={sectionForm.shelf_number}
                  onChange={(e) => setSectionForm({...sectionForm, shelf_number: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseSectionDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('секции', sectionForm, onCreateSection)}
              disabled={loading || !sectionForm.name || !sectionForm.zone_id}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания артикула */}
      <Dialog open={isArticleDialogOpen} onOpenChange={onCloseArticleDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать новый артикул</DialogTitle>
            <DialogDescription>
              Создание нового складского артикула с уникальным кодом и описанием для учета товаров.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-code">Код артикула</Label>
                <Input
                  id="article-code"
                  value={articleForm.article_code}
                  onChange={(e) => setArticleForm({...articleForm, article_code: e.target.value})}
                  placeholder="ART001"
                />
              </div>
              <div>
                <Label htmlFor="article-name">Название</Label>
                <Input
                  id="article-name"
                  value={articleForm.name}
                  onChange={(e) => setArticleForm({...articleForm, name: e.target.value})}
                  placeholder="Название товара"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="article-description">Описание</Label>
              <Textarea
                id="article-description"
                value={articleForm.description}
                onChange={(e) => setArticleForm({...articleForm, description: e.target.value})}
                placeholder="Описание товара"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-category">Категория</Label>
                <Input
                  id="article-category"
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({...articleForm, category: e.target.value})}
                  placeholder="Протезы"
                />
              </div>
              <div>
                <Label htmlFor="article-subcategory">Подкатегория</Label>
                <Input
                  id="article-subcategory"
                  value={articleForm.subcategory}
                  onChange={(e) => setArticleForm({...articleForm, subcategory: e.target.value})}
                  placeholder="Руки"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="article-brand">Бренд</Label>
                <Input
                  id="article-brand"
                  value={articleForm.brand}
                  onChange={(e) => setArticleForm({...articleForm, brand: e.target.value})}
                  placeholder="Название бренда"
                />
              </div>
              <div>
                <Label htmlFor="article-model">Модель</Label>
                <Input
                  id="article-model"
                  value={articleForm.model}
                  onChange={(e) => setArticleForm({...articleForm, model: e.target.value})}
                  placeholder="Модель"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="article-unit">Ед. измерения</Label>
                <Select
                  value={articleForm.unit_of_measure}
                  onValueChange={(value) => setArticleForm({...articleForm, unit_of_measure: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="шт" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="шт">шт</SelectItem>
                    <SelectItem value="пара">пара</SelectItem>
                    <SelectItem value="комплект">комплект</SelectItem>
                    <SelectItem value="кг">кг</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="article-weight">Вес (кг)</Label>
                <Input
                  id="article-weight"
                  type="number"
                  step="0.1"
                  value={articleForm.weight_kg}
                  onChange={(e) => setArticleForm({...articleForm, weight_kg: parseFloat(e.target.value) || 0})}
                  placeholder="1.5"
                />
              </div>
              <div>
                <Label htmlFor="article-dimensions">Размеры (см)</Label>
                <Input
                  id="article-dimensions"
                  value={articleForm.dimensions_cm}
                  onChange={(e) => setArticleForm({...articleForm, dimensions_cm: e.target.value})}
                  placeholder="30x20x10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="article-barcode">Штрихкод</Label>
              <Input
                id="article-barcode"
                value={articleForm.barcode}
                onChange={(e) => setArticleForm({...articleForm, barcode: e.target.value})}
                placeholder="1234567890123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseArticleDialog}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit('артикула', articleForm, onCreateArticle)}
              disabled={loading || !articleForm.article_code || !articleForm.name}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
