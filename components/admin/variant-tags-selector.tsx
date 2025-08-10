"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Tag, AlertCircle, Plus, User, Trash2, Sparkles, TrendingUp, Star, Percent, Crown, Gem, Leaf, ShieldCheck, Truck, Flag } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ProductTag {
  id: number
  name: string
  slug: string
  color: string
  bg_color: string
  icon?: string
  sort_order: number
  product_id?: number | null
  variant_id?: number | null
}

interface VariantTagsSelectorProps {
  variantId: string | number
  onChange?: (tags: ProductTag[]) => void
  className?: string
}

const DEFAULT_ICONS = [
  { name: 'sparkles', label: 'Блеск' },
  { name: 'trending-up', label: 'Тренд' },
  { name: 'star', label: 'Звезда' },
  { name: 'percent', label: 'Процент' },
  { name: 'crown', label: 'Корона' },
  { name: 'gem', label: 'Алмаз' },
  { name: 'leaf', label: 'Лист' },
  { name: 'shield-check', label: 'Щит' },
  { name: 'truck', label: 'Доставка' },
  { name: 'flag', label: 'Флаг' },
  { name: 'tag', label: 'Тег' },
]

const ICON_MAP: Record<string, any> = {
  'sparkles': Sparkles,
  'trending-up': TrendingUp,
  'star': Star,
  'percent': Percent,
  'crown': Crown,
  'gem': Gem,
  'leaf': Leaf,
  'shield-check': ShieldCheck,
  'truck': Truck,
  'flag': Flag,
  'tag': Tag,
}

export function VariantTagsSelector({ variantId, onChange, className = '' }: VariantTagsSelectorProps) {
  const [allTags, setAllTags] = useState<ProductTag[]>([])
  const [selectedTags, setSelectedTags] = useState<ProductTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTagData, setNewTagData] = useState({
    name: '',
    slug: '',
    color: '#6366f1',
    bg_color: '#e0e7ff',
    icon: 'tag',
    sort_order: 0
  })

  useEffect(() => {
    fetchAllTags()
    if (variantId) {
      fetchVariantTags()
    }
  }, [variantId])

  const fetchAllTags = async () => {
    try {
      // Получаем общие теги + личные теги этого варианта
      const url = variantId 
        ? `/api/product-tags?variant_id=${variantId}`
        : '/api/product-tags'
        
      const response = await fetch(url, {
        credentials: 'include',
      })
      const data = await response.json()
      
      if (data.success) {
        setAllTags(data.data)
      }
    } catch (error) {
      console.error('Error fetching tags:', error)
      toast.error('Ошибка загрузки тегов')
    }
  }

  const fetchVariantTags = async () => {
    try {
      const response = await fetch(`/api/variants/${variantId}/tags`, {
        credentials: 'include',
      })
      const data = await response.json()
      
      if (data.success) {
        setSelectedTags(data.data)
      }
    } catch (error) {
      console.error('Error fetching variant tags:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagToggle = async (tag: ProductTag, checked: boolean) => {
    if (isUpdating) return
    
    // Личные теги варианта всегда выбраны и не могут быть сняты
    if (tag.variant_id && tag.variant_id === parseInt(variantId.toString())) {
      if (!checked) {
        toast.info('Личный тег нельзя отвязать от варианта. Для удаления используйте кнопку удаления.')
      }
      return
    }
    
    setIsUpdating(true)
    try {
      if (checked) {
        // Добавляем тег
        const response = await fetch(`/api/variants/${variantId}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ tag_id: tag.id }),
        })
        
        const data = await response.json()
        
        if (data.success) {
          setSelectedTags(data.data)
          onChange?.(data.data)
          toast.success(`Тег "${tag.name}" добавлен к варианту`)
        } else {
          toast.error(data.error || 'Ошибка добавления тега')
        }
      } else {
        // Удаляем тег
        const response = await fetch(`/api/variants/${variantId}/tags?tag_id=${tag.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        
        const data = await response.json()
        
        if (data.success) {
          setSelectedTags(selectedTags.filter(t => t.id !== tag.id))
          onChange?.(selectedTags.filter(t => t.id !== tag.id))
          toast.success(`Тег "${tag.name}" удален из варианта`)
        } else {
          toast.error(data.error || 'Ошибка удаления тега')
        }
      }
    } catch (error) {
      console.error('Error toggling tag:', error)
      toast.error('Ошибка при изменении тегов')
    } finally {
      setIsUpdating(false)
    }
  }

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Tag
    return ICON_MAP[iconName] || Tag
  }

  const isTagSelected = (tagId: number) => {
    return selectedTags.some(t => t.id === tagId)
  }

  const handleDeletePersonalTag = async (tag: ProductTag) => {
    if (!tag.variant_id || !confirm(`Удалить личный тег "${tag.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/variants/${variantId}/personal-tags/${tag.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Личный тег удален')
        // Обновляем список тегов
        await fetchAllTags()
        // Убираем тег из выбранных
        setSelectedTags(prev => prev.filter(t => t.id !== tag.id))
      } else {
        toast.error(data.error || 'Ошибка удаления тега')
      }
    } catch (error) {
      console.error('Error deleting personal tag:', error)
      toast.error('Ошибка удаления тега')
    }
  }

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTagData.name.trim()) {
      toast.error('Введите название тега')
      return
    }

    setIsCreating(true)
    try {
      // Генерируем slug из названия, если не указан
      const _slug = newTagData.slug || newTagData.name
        .toLowerCase()
        .replace(/[а-яё]/g, (match) => {
          const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
          const en = 'abvgdeezhziyklmnoprstufhcchshshyeyuya'
          return en[ru.indexOf(match)] || match
        })
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      const response = await fetch('/api/product-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...newTagData,
          slug,
          is_active: true,
          variant_id: parseInt(variantId.toString()) // Создаем личный тег для этого варианта
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Личный тег создан успешно')
        // Обновляем список тегов
        await fetchAllTags()
        // Обновляем список выбранных тегов варианта
        await fetchVariantTags()
        // Теперь личный тег автоматически отображается как выбранный
        // Закрываем диалог и сбрасываем форму
        setIsCreateDialogOpen(false)
        setNewTagData({
          name: '',
          slug: '',
          color: '#6366f1',
          bg_color: '#e0e7ff',
          icon: 'tag',
          sort_order: 0
        })
      } else {
        toast.error(data.error || 'Ошибка создания тега')
      }
    } catch (error) {
      console.error('Error creating tag:', error)
      toast.error('Ошибка создания тега')
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="h-5 w-5" />
            Теги варианта
          </CardTitle>
          <CardDescription>Загрузка...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5" />
              Теги варианта
              {allTags.filter(tag => tag.variant_id).length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {allTags.filter(tag => tag.variant_id).length} личных
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Добавьте общие теги или создайте личные для этого варианта
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            className="ml-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать личный тег
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Выбранные теги */}
            {selectedTags.length > 0 && (
              <div className="pb-4 border-b">
                <p className="text-sm font-medium mb-2">Выбранные теги:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => {
                    const IconComponent = getIconComponent(tag.icon)
                    return (
                      <Badge
                        key={tag.id}
                        style={{
                          backgroundColor: tag.bg_color,
                          color: tag.color,
                          borderColor: tag.color
                        }}
                        className="flex items-center gap-1"
                      >
                        <IconComponent className="h-3 w-3" />
                        {tag.name}
                        {tag.variant_id && (
                          <User className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Разделяем теги на личные и общие */}
            {(() => {
              const personalTags = allTags.filter(tag => tag.variant_id)
              const commonTags = allTags.filter(tag => !tag.variant_id && !tag.product_id)
              
              return (
                <div className="space-y-4">
                  {/* Личные теги */}
                  {personalTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Личные теги (только для этого варианта)
                      </h4>
                      <div className="space-y-2">
                        {personalTags.map((tag) => {
                          const IconComponent = getIconComponent(tag.icon)
                          const isSelected = isTagSelected(tag.id)
                          
                          return (
                            <div
                              key={tag.id}
                              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 bg-gray-50/50 group"
                            >
                              <Checkbox
                                id={`tag-${tag.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => handleTagToggle(tag, checked as boolean)}
                                disabled={true} // Личные теги всегда выбраны
                              />
                              <label
                                htmlFor={`tag-${tag.id}`}
                                className="flex-1 flex items-center gap-2"
                              >
                                <Badge
                                  style={{
                                    backgroundColor: tag.bg_color,
                                    color: tag.color,
                                    borderColor: tag.color
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <IconComponent className="h-3 w-3" />
                                  {tag.name}
                                  <User className="h-3 w-3 ml-1 opacity-60" />
                                </Badge>
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePersonalTag(tag)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                title="Удалить личный тег"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Общие теги */}
                  {commonTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Общие теги (доступны всем товарам)
                      </h4>
                      <div className="space-y-2">
                        {commonTags.map((tag) => {
                          const IconComponent = getIconComponent(tag.icon)
                          const isSelected = isTagSelected(tag.id)
                          
                          return (
                            <div
                              key={tag.id}
                              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50"
                            >
                              <Checkbox
                                id={`tag-${tag.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => handleTagToggle(tag, checked as boolean)}
                                disabled={isUpdating}
                              />
                              <label
                                htmlFor={`tag-${tag.id}`}
                                className="flex-1 flex items-center gap-2 cursor-pointer"
                              >
                                <Badge
                                  style={{
                                    backgroundColor: tag.bg_color,
                                    color: tag.color,
                                    borderColor: tag.color
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <IconComponent className="h-3 w-3" />
                                  {tag.name}
                                </Badge>
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Подсказка о создании личных тегов */}
                  {personalTags.length === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Создайте личные теги для этого варианта!</strong>
                        <br />
                        Личные теги видны только у этого варианта и идеально подходят для:
                        <ul className="mt-1 ml-4 text-sm list-disc">
                          <li>Размеров: &quot;XXL&quot;, &quot;Детский размер&quot;</li>
                          <li>Цветов: &quot;Синий металлик&quot;, &quot;Красный матовый&quot;</li>
                          <li>Особенностей: &quot;Усиленная конструкция&quot;, &quot;Облегченная версия&quot;</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )
            })()}

            {allTags.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                Нет доступных тегов. Создайте личный тег с помощью кнопки выше.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Диалог создания нового тега */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Создать личный тег варианта</DialogTitle>
            <DialogDescription>
              Этот тег будет доступен только для данного варианта
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTag}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Название тега</Label>
                <Input
                  id="name"
                  value={newTagData.name}
                  onChange={(e) => setNewTagData({ ...newTagData, name: e.target.value })}
                  placeholder="Например: Размер XXL"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="slug">URL (необязательно)</Label>
                <Input
                  id="slug"
                  value={newTagData.slug}
                  onChange={(e) => setNewTagData({ ...newTagData, slug: e.target.value })}
                  placeholder="size-xxl"
                />
                <p className="text-xs text-muted-foreground">
                  Если оставить пустым, будет сгенерирован автоматически
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color">Цвет текста</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={newTagData.color}
                      onChange={(e) => setNewTagData({ ...newTagData, color: e.target.value })}
                      className="w-16 h-9"
                    />
                    <Input
                      value={newTagData.color}
                      onChange={(e) => setNewTagData({ ...newTagData, color: e.target.value })}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="bg_color">Цвет фона</Label>
                  <div className="flex gap-2">
                    <Input
                      id="bg_color"
                      type="color"
                      value={newTagData.bg_color}
                      onChange={(e) => setNewTagData({ ...newTagData, bg_color: e.target.value })}
                      className="w-16 h-9"
                    />
                    <Input
                      value={newTagData.bg_color}
                      onChange={(e) => setNewTagData({ ...newTagData, bg_color: e.target.value })}
                      placeholder="#e0e7ff"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="icon">Иконка</Label>
                <Select
                  value={newTagData.icon}
                  onValueChange={(value) => setNewTagData({ ...newTagData, icon: value })}
                >
                  <SelectTrigger id="icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_ICONS.map(({ name, label }) => {
                      const Icon = getIconComponent(name)
                      return (
                        <SelectItem key={name} value={name}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Предпросмотр</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    style={{
                      backgroundColor: newTagData.bg_color,
                      color: newTagData.color,
                      borderColor: newTagData.color
                    }}
                    className="flex items-center gap-1"
                  >
                    {(() => {
                      const IconComponent = getIconComponent(newTagData.icon)
                      return <IconComponent className="h-3 w-3" />
                    })()}
                    {newTagData.name || 'Название тега'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}