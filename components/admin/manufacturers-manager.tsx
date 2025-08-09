"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { getApiClient, getLogger } from "@/lib/dependency-injection"
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Building
} from "lucide-react"

interface Manufacturer {
  id: number;
  name: string;
  description?: string;
  country?: string;
  website?: string;
  established_year?: number;
  logo_url?: string;
}

interface ManufacturersManagerProps {
  onManufacturerSelect?: (manufacturerId: number) => void;
  selectedManufacturerId?: number;
}

export function ManufacturersManager({ onManufacturerSelect, selectedManufacturerId }: ManufacturersManagerProps) {
  const { toast } = useToast();
  const apiClient = getApiClient();
  const logger = getLogger();

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedManufacturers, setExpandedManufacturers] = useState<Set<number>>(new Set());
  const [isManufacturerDialogOpen, setIsManufacturerDialogOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);

  const [manufacturerForm, setManufacturerForm] = useState({
    name: '',
    description: '',
    country: '',
    website: '',
    established_year: '',
    logo_url: ''
  });

  useEffect(() => {
    loadManufacturers();
  }, []);

  const loadManufacturers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getManufacturers();
      setManufacturers(data || []);
    } catch (error) {
      logger.error('Failed to load manufacturers:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить производителей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetManufacturerForm = () => {
    setManufacturerForm({
      name: '',
      description: '',
      country: '',
      website: '',
      established_year: '',
      logo_url: ''
    });
    setEditingManufacturer(null);
  };

  const handleManufacturerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manufacturerForm.name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название производителя обязательно",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const manufacturerData = {
        name: manufacturerForm.name.trim(),
        description: manufacturerForm.description.trim() || null,
        country: manufacturerForm.country.trim() || null,
        website: manufacturerForm.website.trim() || null,
        established_year: manufacturerForm.established_year ? parseInt(manufacturerForm.established_year) : null,
        logo_url: manufacturerForm.logo_url.trim() || null
      };

      if (editingManufacturer) {
        await apiClient.updateManufacturer(editingManufacturer.id.toString(), manufacturerData);
        toast({
          title: "Успех",
          description: "Производитель обновлен",
        });
      } else {
        await apiClient.createManufacturer(manufacturerData);
        toast({
          title: "Успех",
          description: "Производитель добавлен",
        });
      }

      await loadManufacturers();
      resetManufacturerForm();
      setIsManufacturerDialogOpen(false);

    } catch (error) {
      logger.error('Failed to save manufacturer:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить производителя",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditManufacturer = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer);
    setManufacturerForm({
      name: manufacturer.name,
      description: manufacturer.description || '',
      country: manufacturer.country || '',
      website: manufacturer.website || '',
      established_year: manufacturer.established_year?.toString() || '',
      logo_url: manufacturer.logo_url || ''
    });
    setIsManufacturerDialogOpen(true);
  };

  const handleDeleteManufacturer = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого производителя? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteManufacturer(id.toString());

      toast({
        title: "Успех",
        description: "Производитель удален",
      });

      await loadManufacturers();

    } catch (error) {
      logger.error('Failed to delete manufacturer:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить производителя",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleManufacturer = (manufacturerId: number) => {
    const newExpanded = new Set(expandedManufacturers);
    if (newExpanded.has(manufacturerId)) {
      newExpanded.delete(manufacturerId);
    } else {
      newExpanded.add(manufacturerId);
    }
    setExpandedManufacturers(newExpanded);

    if (onManufacturerSelect) {
      onManufacturerSelect(manufacturerId);
    }
  };

  if (loading && manufacturers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Производители
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
            <Building className="h-5 w-5" />
            Производители ({manufacturers.length})
          </CardTitle>

          <Dialog open={isManufacturerDialogOpen} onOpenChange={setIsManufacturerDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetManufacturerForm}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить производителя
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingManufacturer ? 'Редактировать производителя' : 'Добавить производителя'}
                </DialogTitle>
                <DialogDescription>
                  Заполните информацию о производителе медицинских изделий
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleManufacturerSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer-name">Название *</Label>
                    <Input
                      id="manufacturer-name"
                      value={manufacturerForm.name}
                      onChange={(e) => setManufacturerForm({...manufacturerForm, name: e.target.value})}
                      placeholder="Название производителя"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manufacturer-country">Страна</Label>
                    <Input
                      id="manufacturer-country"
                      value={manufacturerForm.country}
                      onChange={(e) => setManufacturerForm({...manufacturerForm, country: e.target.value})}
                      placeholder="Страна производства"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer-website">Веб-сайт</Label>
                    <Input
                      id="manufacturer-website"
                      type="url"
                      value={manufacturerForm.website}
                      onChange={(e) => setManufacturerForm({...manufacturerForm, website: e.target.value})}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manufacturer-year">Год основания</Label>
                    <Input
                      id="manufacturer-year"
                      type="number"
                      min="1800"
                      max="2030"
                      value={manufacturerForm.established_year}
                      onChange={(e) => setManufacturerForm({...manufacturerForm, established_year: e.target.value})}
                      placeholder="2000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturer-logo">URL логотипа</Label>
                  <Input
                    id="manufacturer-logo"
                    type="url"
                    value={manufacturerForm.logo_url}
                    onChange={(e) => setManufacturerForm({...manufacturerForm, logo_url: e.target.value})}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturer-description">Описание</Label>
                  <Textarea
                    id="manufacturer-description"
                    value={manufacturerForm.description}
                    onChange={(e) => setManufacturerForm({...manufacturerForm, description: e.target.value})}
                    placeholder="Описание производителя..."
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsManufacturerDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Сохранение...' : (editingManufacturer ? 'Обновить' : 'Создать')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {manufacturers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет производителей для отображения
          </div>
        ) : (
          <div className="space-y-2">
            {manufacturers.map((manufacturer) => (
              <Collapsible
                key={manufacturer.id}
                open={expandedManufacturers.has(manufacturer.id)}
                onOpenChange={() => toggleManufacturer(manufacturer.id)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-muted/50 rounded-lg hover:bg-muted">
                  <div className="flex items-center gap-3">
                    {expandedManufacturers.has(manufacturer.id) ?
                      <ChevronDown className="h-4 w-4" /> :
                      <ChevronRight className="h-4 w-4" />
                    }
                    <div className="flex items-center gap-3">
                      {manufacturer.logo_url && (
                        <img
                          src={manufacturer.logo_url}
                          alt={`${manufacturer.name} logo`}
                          className="h-8 w-8 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <span className="font-medium">{manufacturer.name}</span>
                        {manufacturer.country && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {manufacturer.country}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedManufacturerId === manufacturer.id && (
                      <Badge variant="default">Активный</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditManufacturer(manufacturer);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteManufacturer(manufacturer.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="px-3 pb-3">
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {manufacturer.description && (
                      <p className="text-sm text-muted-foreground">
                        {manufacturer.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm">
                      {manufacturer.established_year && (
                        <span>Основан: {manufacturer.established_year}</span>
                      )}
                      {manufacturer.website && (
                        <a
                          href={manufacturer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Веб-сайт
                        </a>
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