"use client"

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tag, Sparkles, TrendingUp, Star, Percent, Crown, Gem, Leaf, ShieldCheck, Truck, Flag } from 'lucide-react'

interface ProductTag {
  id: number
  name: string
  slug: string
  color: string
  bg_color: string
  icon?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const DEFAULT_ICONS = [
  { name: 'sparkles', icon: Sparkles },
  { name: 'trending-up', icon: TrendingUp },
  { name: 'star', icon: Star },
  { name: 'percent', icon: Percent },
  { name: 'crown', icon: Crown },
  { name: 'gem', icon: Gem },
  { name: 'leaf', icon: Leaf },
  { name: 'shield-check', icon: ShieldCheck },
  { name: 'truck', icon: Truck },
  { name: 'flag', icon: Flag },
  { name: 'tag', icon: Tag },
]

export default function ProductTagsPage() {
  const [tags, setTags] = useState<ProductTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<ProductTag | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    color: '#6366f1',
    bg_color: '#e0e7ff',
    icon: 'tag',
    is_active: true,
    sort_order: 0
  })

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const fetchTags = useCallback(async () => {
      try {
        const response = await fetch('/api/product-tags?include_inactive=true', {
          credentials: 'include', // Важно для передачи cookies
        })
        const data = await response.json()
        
        if (data.success) {
          setTags(data.data)
        } else {
          toast.error('Ошибка загрузки тегов')
        }
      } catch (error) {
        console.error('Error fetching tags:', error)
        toast.error('Ошибка загрузки тегов')
      } finally {
        setIsLoading(false)
      }
    }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const _method = editingTag ? 'PUT' : 'POST'
      const body = editingTag 
        ? { id: editingTag.id, ...formData }
        : formData
      
      const response = await fetch('/api/product-tags', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно для передачи cookies
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(editingTag ? 'Тег обновлен' : 'Тег создан')
        fetchTags()
        setIsDialogOpen(false)
        resetForm()
      } else {
        toast.error(data.error || 'Ошибка сохранения')
      }
    } catch (error) {
      console.error('Error saving tag:', error)
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот тег?')) return
    
    try {
      const response = await fetch(`/api/product-tags?id=${id}`, {
        method: 'DELETE',
        credentials: 'include', // Важно для передачи cookies
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('Тег удален')
        fetchTags()
      } else {
        toast.error(data.error || 'Ошибка удаления')
      }
    } catch (error) {
      console.error('Error deleting tag:', error)
      toast.error('Ошибка удаления')
    }
  }

  const handleEdit = (tag: ProductTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      bg_color: tag.bg_color,
      icon: tag.icon || 'tag',
      is_active: tag.is_active,
      sort_order: tag.sort_order
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTag(null)
    setFormData({
      name: '',
      slug: '',
      color: '#6366f1',
      bg_color: '#e0e7ff',
      icon: 'tag',
      is_active: true,
      sort_order: 0
    })
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[а-яё]/g, '') // Удаляем кириллицу
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return null
    const iconConfig = DEFAULT_ICONS.find(i => i.name === iconName)
    return iconConfig ? iconConfig.icon : Tag
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Теги товаров</h1>
            <p className="text-muted-foreground">
              Управление тегами для выделения особенностей товаров
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Добавить тег
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingTag ? 'Редактировать тег' : 'Создать тег'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTag ? 'Измените параметры тега' : 'Добавьте новый тег для товаров'}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Название</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value })
                        if (!editingTag) {
                          setFormData(prev => ({ 
                            ...prev, 
                            slug: generateSlug(e.target.value) 
                          }))
                        }
                      }}
                      placeholder="Новинка"
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="new"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="color">Цвет текста</Label>
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="#6366f1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="bg_color">Цвет фона</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bg_color"
                          type="color"
                          value={formData.bg_color}
                          onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          value={formData.bg_color}
                          onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                          placeholder="#e0e7ff"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Иконка</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {DEFAULT_ICONS.map(({ name, icon: Icon }) => (
                        <Button
                          key={name}
                          type="button"
                          variant={formData.icon === name ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({ ...formData, icon: name })}
                          className="flex items-center justify-center"
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="sort_order">Порядок сортировки</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Активный</Label>
                  </div>
                  
                  <div className="mt-2">
                    <Label>Предпросмотр</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        style={{
                          backgroundColor: formData.bg_color,
                          color: formData.color,
                          borderColor: formData.color
                        }}
                        className="flex items-center gap-1"
                      >
                        {(() => {
                          const IconComponent = getIconComponent(formData.icon)
                          return IconComponent && <IconComponent className="h-3 w-3" />
                        })()}
                        {formData.name || 'Пример'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="submit">
                    {editingTag ? 'Сохранить' : 'Создать'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Список тегов</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 rounded-full mx-auto"></div>
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Теги не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тег</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Порядок</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => {
                    const IconComponent = getIconComponent(tag.icon)
                    return (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <Badge
                            style={{
                              backgroundColor: tag.bg_color,
                              color: tag.color,
                              borderColor: tag.color
                            }}
                            className="flex items-center gap-1 w-fit"
                          >
                            {IconComponent && <IconComponent className="h-3 w-3" />}
                            {tag.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tag.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tag.is_active ? 'default' : 'secondary'}>
                            {tag.is_active ? 'Активен' : 'Неактивен'}
                          </Badge>
                        </TableCell>
                        <TableCell>{tag.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(tag)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}