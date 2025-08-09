"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { getApiClient, getLogger } from "@/lib/dependency-injection"
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ChevronDown,
  ChevronRight,
  Layers
} from "lucide-react"

interface ModelLine {
  id: number;
  name: string;
  description?: string;
  manufacturer_id: number;
  manufacturer_name?: string;
  category_id?: number;
  category_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Manufacturer {
  id: number;
  name: string;
  description?: string;
}

interface Category {
  id: number;
  name: string;
  parent_id?: number;
}

interface ModelLinesManagerProps {
  manufacturerId?: number;
  onModelLineSelect?: (modelLineId: number) => void;
  selectedModelLineId?: number;
}

export function ModelLinesManager({ manufacturerId, onModelLineSelect, selectedModelLineId }: ModelLinesManagerProps) {
  const { toast } = useToast();
  const apiClient = getApiClient();
  const logger = getLogger();

  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedModelLines, setExpandedModelLines] = useState<Set<number>>(new Set());
  const [isModelLineDialogOpen, setIsModelLineDialogOpen] = useState(false);
  const [editingModelLine, setEditingModelLine] = useState<ModelLine | null>(null);

  const [modelLineForm, setModelLineForm] = useState({
    name: '',
    description: '',
    manufacturer_id: '',
    category_id: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (manufacturerId) {
      loadModelLinesForManufacturer();
    }
  }, [manufacturerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [modelLinesResponse, manufacturersResponse, categoriesResponse] = await Promise.all([
        apiClient.getModelLines(),
        apiClient.getManufacturers(),
        apiClient.getCategories()
      ]);

      setModelLines(modelLinesResponse?.data || []);
      setManufacturers(manufacturersResponse?.data || []);
      setCategories(categoriesResponse?.data || []);
    } catch (error) {
      logger.error('Failed to load data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadModelLinesForManufacturer = async () => {
    if (!manufacturerId) return;

    try {
      setLoading(true);
      const response = await apiClient.getModelLines();
      const filteredData = response?.data?.filter((ml: ModelLine) => ml.manufacturer_id === manufacturerId) || [];
      setModelLines(filteredData);
    } catch (error) {
      logger.error('Failed to load model lines for manufacturer:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить линейки моделей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetModelLineForm = () => {
    setModelLineForm({
      name: '',
      description: '',
      manufacturer_id: manufacturerId?.toString() || '',
      category_id: '',
      is_active: true
    });
    setEditingModelLine(null);
  };

  const handleModelLineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modelLineForm.name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название линейки моделей обязательно",
        variant: "destructive",
      });
      return;
    }

    if (!modelLineForm.manufacturer_id) {
      toast({
        title: "Ошибка",
        description: "Выберите производителя",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const modelLineData = {
        name: modelLineForm.name.trim(),
        description: modelLineForm.description.trim() || null,
        manufacturer_id: parseInt(modelLineForm.manufacturer_id),
        category_id: modelLineForm.category_id ? parseInt(modelLineForm.category_id) : null,
        is_active: modelLineForm.is_active
      };

      if (editingModelLine) {
        await apiClient.updateModelLine(editingModelLine.id.toString(), modelLineData);
        toast({
          title: "Успех",
          description: "Линейка моделей обновлена",
        });
      } else {
        await apiClient.createModelLine(modelLineData);
        toast({
          title: "Успех",
          description: "Линейка моделей добавлена",
        });
      }

      if (manufacturerId) {
        await loadModelLinesForManufacturer();
      } else {
        await loadData();
      }

      resetModelLineForm();
      setIsModelLineDialogOpen(false);

    } catch (error) {
      logger.error('Failed to save model line:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить линейку моделей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditModelLine = (modelLine: ModelLine) => {
    setEditingModelLine(modelLine);
    setModelLineForm({
      name: modelLine.name,
      description: modelLine.description || '',
      manufacturer_id: modelLine.manufacturer_id.toString(),
      category_id: modelLine.category_id?.toString() || '',
      is_active: modelLine.is_active
    });
    setIsModelLineDialogOpen(true);
  };

  const handleDeleteModelLine = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту линейку моделей? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteModelLine(id.toString());

      toast({
        title: "Успех",
        description: "Линейка моделей удалена",
      });

      if (manufacturerId) {
        await loadModelLinesForManufacturer();
      } else {
        await loadData();
      }

    } catch (error) {
      logger.error('Failed to delete model line:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить линейку моделей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleModelLine = (modelLineId: number) => {
    const newExpanded = new Set(expandedModelLines);
    if (newExpanded.has(modelLineId)) {
      newExpanded.delete(modelLineId);
    } else {
      newExpanded.add(modelLineId);
    }
    setExpandedModelLines(newExpanded);

    if (onModelLineSelect) {
      onModelLineSelect(modelLineId);
    }
  };

  const getManufacturerName = (manufacturerId: number) => {
    const manufacturer = manufacturers.find(m => m.id === manufacturerId);
    return manufacturer?.name || 'Неизвестный производитель';
  };

  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Неизвестная категория';
  };

  if (loading && modelLines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Линейки моделей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Линейки моделей ({modelLines.length})
            {manufacturerId && (
              <Badge variant="secondary">
                {getManufacturerName(manufacturerId)}
              </Badge>
            )}
          </CardTitle>

          <Dialog open={isModelLineDialogOpen} onOpenChange={setIsModelLineDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetModelLineForm}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить линейку
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingModelLine ? 'Редактировать линейку моделей' : 'Добавить линейку моделей'}
                </DialogTitle>
                <DialogDescription>
                  Заполните информацию о линейке моделей
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleModelLineSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelline-name">Название *</Label>
                    <Input
                      id="modelline-name"
                      value={modelLineForm.name}
                      onChange={(e) => setModelLineForm({...modelLineForm, name: e.target.value})}
                      placeholder="Название линейки моделей"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelline-manufacturer">Производитель *</Label>
                    <Select
                      value={modelLineForm.manufacturer_id}
                      onValueChange={(value) => setModelLineForm({...modelLineForm, manufacturer_id: value})}
                      disabled={!!manufacturerId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите производителя" />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((manufacturer) => (
                          <SelectItem key={manufacturer.id} value={manufacturer.id.toString()}>
                            {manufacturer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelline-category">Категория</Label>
                    <Select
                      value={modelLineForm.category_id}
                      onValueChange={(value) => setModelLineForm({...modelLineForm, category_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Без категории</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelline-active">Статус</Label>
                    <Select
                      value={modelLineForm.is_active ? "true" : "false"}
                      onValueChange={(value) => setModelLineForm({...modelLineForm, is_active: value === "true"})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Активна</SelectItem>
                        <SelectItem value="false">Неактивна</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelline-description">Описание</Label>
                  <Textarea
                    id="modelline-description"
                    value={modelLineForm.description}
                    onChange={(e) => setModelLineForm({...modelLineForm, description: e.target.value})}
                    placeholder="Описание линейки моделей..."
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsModelLineDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Сохранение...' : (editingModelLine ? 'Обновить' : 'Создать')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {modelLines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {manufacturerId ?
              'У этого производителя пока нет линеек моделей' :
              'Нет линеек моделей для отображения'
            }
          </div>
        ) : (
          <div className="space-y-2">
            {modelLines.map((modelLine) => (
              <Collapsible
                key={modelLine.id}
                open={expandedModelLines.has(modelLine.id)}
                onOpenChange={() => toggleModelLine(modelLine.id)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-muted/50 rounded-lg hover:bg-muted">
                  <div className="flex items-center gap-3">
                    {expandedModelLines.has(modelLine.id) ?
                      <ChevronDown className="h-4 w-4" /> :
                      <ChevronRight className="h-4 w-4" />
                    }
                    <div>
                      <span className="font-medium">{modelLine.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {!manufacturerId && (
                          <Badge variant="outline" className="text-xs">
                            {getManufacturerName(modelLine.manufacturer_id)}
                          </Badge>
                        )}
                        {modelLine.category_id && (
                          <Badge variant="secondary" className="text-xs">
                            {getCategoryName(modelLine.category_id)}
                          </Badge>
                        )}
                        <Badge variant={modelLine.is_active ? "default" : "destructive"} className="text-xs">
                          {modelLine.is_active ? 'Активна' : 'Неактивна'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedModelLineId === modelLine.id && (
                      <Badge variant="default">Активная</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditModelLine(modelLine);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModelLine(modelLine.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="px-3 pb-3">
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {modelLine.description && (
                      <p className="text-sm text-muted-foreground">
                        {modelLine.description}
                      </p>
                    )}

                    <div className="text-xs text-muted-foreground">
                      ID: {modelLine.id}
                      {modelLine.created_at && (
                        <span className="ml-4">
                          Создана: {new Date(modelLine.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}