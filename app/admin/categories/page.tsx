"use client"
import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Folder, FolderOpen, Package } from "lucide-react"
import { toast } from "@/hooks/use-toast"

import { SearchableCategorySelect } from '@/components/ui/searchable-category-select'

interface Category {
  id: number
  name: string
  description?: string
  type: string
  parent_id?: number
  is_active: boolean
  level?: number
  created_at: string
  updated_at: string
  children?: Category[]
}

export default function CategoriesAdmin() {
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // Диалоги
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Форма
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    parent_id: undefined as number | undefined
  })

  // Состояние для раскрытых категорий
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())

  // Загрузка данных
  const loadCategories = useCallback(async () => {
      try {

        const res = await fetch("/api/categories", {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          cache: 'no-store'
        })

        if (res.ok) {
          const apiResponse = await res.json()
          const data = apiResponse.data || apiResponse

          setCategories(data)
        } else {
          const errorText = await res.text()
          console.error("❌ Failed to load categories:", res.status, errorText)
          toast({
            title: "Ошибка",
            description: `Не удалось загрузить категории: ${res.status}`,
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error("💥 Ошибка загрузки категорий:", error)
        toast({
          title: "Ошибка",
          description: "Ошибка сетевого соединения при загрузке категорий",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      description: "",
      parent_id: undefined
    })
    setEditingCategory(null)
  }

  const handleAddSubcategory = (parentCategory: Category) => {
    resetCategoryForm()
    setCategoryFormData(prev => ({ ...prev, parent_id: parentCategory.id }))
    setIsCategoryDialogOpen(true)
  }

  const handleCategorySave = async () => {
    try {
      const _method = editingCategory ? 'PUT' : 'POST'
      const body = editingCategory
        ? { ...categoryFormData, id: editingCategory.id }
        : categoryFormData

      const res = await fetch('/api/categories', {
        method: _method,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast({
          title: "Успех",
          description: editingCategory ? "Категория обновлена" : "Категория создана"
        })
        setIsCategoryDialogOpen(false)
        resetCategoryForm()
        // Принудительно обновляем данные из базы
        await loadCategories()
      } else {
        const error = await res.json()
        toast({
          title: "Ошибка",
          description: error.error || "Ошибка сохранения категории",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Ошибка сохранения категории:', error)
      toast({
        title: "Ошибка",
        description: "Ошибка сетевого соединения",
        variant: "destructive"
      })
    }
  }

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category)
    setCategoryFormData({
      name: category.name,
      description: category.description || "",
      parent_id: category.parent_id
    })
    setIsCategoryDialogOpen(true)
  }

  const handleCategoryDelete = async (categoryId: number, force: boolean = false) => {
    // Найдем категорию для получения её названия
    const findCategory = (cats: Category[], id: number): Category | null => {
      for (const cat of cats) {
        if (cat.id === id) return cat
        if (cat.children) {
          const found = findCategory(cat.children, id)
          if (found) return found
        }
      }
      return null
    }

    const category = findCategory(categories, categoryId)
    const categoryName = category?.name || 'категорию'

    if (!force && !confirm(`Вы уверены, что хотите удалить ${categoryName}?`)) {
      return
    }

    // Оптимистичное обновление: временно удаляем из локального состояния
    const removeFromCategories = (cats: Category[], idToRemove: number): Category[] => {
      return cats.map(cat => {
        if (cat.id === idToRemove) {
          return null
        }
        return {
          ...cat,
          children: cat.children ? removeFromCategories(cat.children, idToRemove) : []
        }
      }).filter(Boolean) as Category[]
    }

    const originalCategories = categories
    setCategories(removeFromCategories(categories, categoryId))

    try {
      const url = force
        ? `/api/categories?id=${categoryId}&force=true`
        : `/api/categories?id=${categoryId}`

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (res.ok) {
        const result = await res.json()
        toast({
          title: "Успех",
          description: result.message || "Категория удалена"
        })
        // Принудительно обновляем данные из базы
        await loadCategories()
      } else {
        // Возвращаем оригинальное состояние при ошибке
        setCategories(originalCategories)

        const error = await res.json()

        // Если есть дочерние категории, предлагаем каскадное удаление
        if (error.hasChildren) {
          const childrenList = error.childrenNames.join(', ')
          const confirmMessage = `У категории "${categoryName}" есть дочерние категории: ${childrenList}.\n\nВыберите действие:\n- OK: Удалить вместе с дочерними категориями\n- Отмена: Отменить удаление`

          if (confirm(confirmMessage)) {
            // Рекурсивно вызываем с force=true
            await handleCategoryDelete(categoryId, true)
          }
        } else if (error.hasProducts) {
          // Если в категории есть товары, предлагаем каскадное удаление
          const confirmMessage = `В категории "${categoryName}" есть ${error.productsCount} товар(ов).\n\nВыберите действие:\n- OK: Удалить категорию (товары будут перемещены в категорию "Аксессуары")\n- Отмена: Отменить удаление`

          if (confirm(confirmMessage)) {
            // Рекурсивно вызываем с force=true
            await handleCategoryDelete(categoryId, true)
          }
        } else {
          toast({
            title: "Ошибка",
            description: error.error || "Ошибка удаления категории",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      // Возвращаем оригинальное состояние при ошибке сети
      setCategories(originalCategories)

      console.error('Ошибка удаления категории:', error)
      toast({
        title: "Ошибка",
        description: "Ошибка сетевого соединения",
        variant: "destructive"
      })
    }
  }

  const toggleCategoryExpansion = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Фильтрация категорий
  const filteredCategories = search.trim()
    ? categories.map(category => {
        const filterCategory = (cat: Category): Category | null => {
          const matchesSearch = (cat.name || "").toLowerCase().includes(search.toLowerCase()) ||
                               (cat.description || "").toLowerCase().includes(search.toLowerCase())

          const filteredChildren = cat.children?.map(filterCategory).filter(Boolean) as Category[] || []

          if (matchesSearch || filteredChildren.length > 0) {
            return { ...cat, children: filteredChildren }
          }

          return null
        }
        return filterCategory(category)
      }).filter(Boolean) as Category[]
    : categories

  // Получить все возможные родительские категории для выбора
  const getAvailableParentCategories = (excludeId?: number): Category[] => {
    const flatten = (cats: Category[]): Category[] => {
      return cats.reduce((acc: Category[], cat) => {
        if (cat.id !== excludeId) {
          acc.push(cat)
          if (cat.children) {
            acc.push(...flatten(cat.children))
          }
        }
        return acc
      }, [])
    }
    return flatten(categories)
  }

  const getTotalSubcategoriesCount = (category: Category): number => {
    if (!category.children || category.children.length === 0) return 0
    return category.children.reduce((count, child) => count + 1 + getTotalSubcategoriesCount(child), 0)
  }

  const renderCategoryTree = (categories: Category[], level = 0) => {
    const result: JSX.Element[] = []

    categories.forEach((category) => {
      // Добавляем основную строку категории
      result.push(
        <TableRow key={category.id} className="hover:bg-gray-50">
          <TableCell>
            <div
              className="flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded"
              style={{ paddingLeft: `${level * 20 + 8}px` }}
              onClick={() => toggleCategoryExpansion(category.id)}
            >
              <div className="w-4 h-4 mr-2 flex items-center justify-center">
                {category.children && category.children.length > 0 ? (
                  expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )
                ) : null}
              </div>

              <div className="w-4 h-4 mr-2 flex items-center justify-center">
                {category.children && category.children.length > 0 ? (
                  expandedCategories.has(category.id) ? (
                    <FolderOpen className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Folder className="h-4 w-4 text-blue-500" />
                  )
                ) : (
                  <Package className="h-4 w-4 text-green-500" />
                )}
              </div>

              <span className="font-medium">{category.name}</span>
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm text-gray-600">{category.description}</span>
          </TableCell>
          <TableCell>
            <div className="flex items-center space-x-1">
              <Badge variant="outline" className="text-xs">
                {category.children?.length || 0} подкат.
              </Badge>
              {getTotalSubcategoriesCount(category) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Всего: {getTotalSubcategoriesCount(category)}
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddSubcategory(category)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCategoryEdit(category)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCategoryDelete(category.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )

      // Добавляем дочерние категории, если группа раскрыта
      if (expandedCategories.has(category.id) && category.children && category.children.length > 0) {
        result.push(...renderCategoryTree(category.children, level + 1))
      }
    })

    return result
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загрузка категорий...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Категории товаров</h1>
            <p className="text-gray-600 mt-2">Управление товарными категориями каталога</p>
          </div>

          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetCategoryForm}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить категорию
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Редактировать категорию' : 'Добавить категорию'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory ? 'Изменение параметров существующей категории товаров' : 'Создание новой категории для классификации товаров'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Введите название категории"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Введите описание категории"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent">Родительская категория</Label>
                  <SearchableCategorySelect
                    categories={getAvailableParentCategories(editingCategory?.id)}
                    value={categoryFormData.parent_id?.toString() || "root"}
                    onValueChange={(value) => setCategoryFormData(prev => ({
                      ...prev,
                      parent_id: value === "root" ? undefined : parseInt(value)
                    }))}
                    placeholder="Выберите родительскую категорию или оставьте пустым"
                    includeNoneOption={true}
                    noneOptionText="Корневая категория"
                    noneValue="root"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCategorySave}>
                    {editingCategory ? 'Обновить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Поиск */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Поиск категорий</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Поиск по названию или описанию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Таблица категорий */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Категории ({categories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Подкатегории</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.length > 0 ? (
                  renderCategoryTree(filteredCategories)
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      {search.trim() ? 'Категории не найдены' : 'Нет категорий'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}