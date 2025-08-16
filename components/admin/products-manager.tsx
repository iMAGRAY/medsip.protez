"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Switch } from "@/components/ui/switch"
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
  Eye,
  Star,
  ExternalLink
} from "lucide-react"
import { SafeImage } from "@/components/safe-image"

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  article_number?: string;
  price?: number;
  discount_price?: number;
  image_url?: string;
  model_line_id?: number;
  model_line_name?: string;
  manufacturer_id?: number;
  manufacturer_name?: string;
  category_id?: number;
  category_name?: string;
  is_active: boolean;
  is_featured: boolean;
  in_stock?: boolean;
  stock_quantity?: number;
  variants_count?: number;
  has_variants?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ModelLine {
  id: number;
  name: string;
  manufacturer_id: number;
  manufacturer_name?: string;
}

interface Category {
  id: number;
  name: string;
  parent_id?: number;
}

interface ProductsManagerProps {
  modelLineId?: number;
  onProductSelect?: (productId: string) => void;
  selectedProductId?: string;
  showCreateButton?: boolean;
}

export function ProductsManager({
  modelLineId,
  onProductSelect,
  selectedProductId,
  showCreateButton = true
}: ProductsManagerProps) {
  const { toast } = useToast();
  const apiClient = getApiClient();
  const logger = getLogger();

  const [products, setProducts] = useState<Product[]>([]);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    sku: '',
    article_number: '',
    price: '',
    discount_price: '',
    image_url: '',
    model_line_id: '',
    category_id: '',
    is_active: true,
    is_featured: false,
    show_price: false
  });

  const [attemptedSave, setAttemptedSave] = useState(false)

  const loadData = useCallback(async () => {
      try {
        setLoading(true);
        const [productsData, modelLinesData, categoriesData] = await Promise.all([
          apiClient.getProducts(),
          apiClient.getModelLines(),
          apiClient.getCategories()
        ]);

        setProducts(productsData || []);
        setModelLines(modelLinesData || []);
        setCategories(categoriesData || []);
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
    }, [apiClient, logger, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadProductsForModelLine = useCallback(async () => {
    if (!modelLineId) return;

    try {
      setLoading(true);
      const data = await apiClient.getProducts();
      const filteredData = data?.filter((product: Product) =>
        product.model_line_id === modelLineId
      ) || [];
      setProducts(filteredData);
    } catch (error) {
      logger.error('Failed to load products for model line:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить товары",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [modelLineId, apiClient, logger, toast]);

  useEffect(() => {
    if (modelLineId) {
      loadProductsForModelLine();
    }
  }, [modelLineId, loadProductsForModelLine]);

  const resetProductForm = () => {
    setAttemptedSave(false)
    setProductForm({
      name: '',
      description: '',
      sku: '',
      article_number: '',
      price: '',
      discount_price: '',
      image_url: '',
      model_line_id: modelLineId?.toString() || '',
      category_id: '',
      is_active: true,
      is_featured: false,
      show_price: false
    });
    setEditingProduct(null);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSave(true);

    if (!productForm.name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название товара обязательно",
        variant: "destructive",
      });
      return;
    }

    if (!productForm.sku.trim() && !productForm.article_number.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите SKU или Артикул товара",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const productData = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        sku: productForm.sku.trim() || null,
        article_number: productForm.article_number.trim() || null,
        price: productForm.price ? parseFloat(productForm.price) : null,
        discount_price: productForm.discount_price ? parseFloat(productForm.discount_price) : null,
        image_url: productForm.image_url.trim() || null,
        model_line_id: productForm.model_line_id ? parseInt(productForm.model_line_id) : null,
        category_id: productForm.category_id ? parseInt(productForm.category_id) : null,
        is_active: productForm.is_active,
        is_featured: productForm.is_featured,
        show_price: productForm.show_price
      };

      if (editingProduct) {
        await apiClient.updateProduct(editingProduct.id, productData);
        toast({
          title: "Успех",
          description: "Товар обновлен",
        });
      } else {
        await apiClient.createProduct(productData);
        toast({
          title: "Успех",
          description: "Товар добавлен",
        });
      }

      // Принудительно перезагружаем данные после создания/обновления
      setTimeout(async () => {
        try {
          // Очищаем кэш перед загрузкой
          apiClient.clearCache()

          if (modelLineId) {
            await loadProductsForModelLine();
          } else {
            await loadData();
          }
        } catch (reloadError) {
          console.error('❌ Error reloading data after save:', reloadError)
          // Fallback к обычной загрузке
          if (modelLineId) {
            await loadProductsForModelLine();
          } else {
            await loadData();
          }
        }
      }, 300);

      resetProductForm();
      setIsProductDialogOpen(false);

    } catch (error) {
      logger.error('Failed to save product:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить товар",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setAttemptedSave(false)
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      article_number: product.article_number || '',
      price: product.price?.toString() || '',
      discount_price: product.discount_price?.toString() || '',
      image_url: product.image_url || '',
      model_line_id: product.model_line_id?.toString() || '',
      category_id: product.category_id?.toString() || '',
      is_active: product.is_active,
      is_featured: product.is_featured,
      show_price: (product as any).show_price || false
    });
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);

      // Оптимистично удаляем из UI
      const currentProducts = products.filter(p => p.id !== id);
      setProducts(currentProducts);

      const result = await apiClient.deleteProduct(id);

      if (result.success) {
        toast({
          title: "Успех",
          description: "Товар удален",
        });

        // Принудительно перезагружаем данные для полной синхронизации
        setTimeout(async () => {
          try {
            // Очищаем кэш перед загрузкой
            apiClient.clearCache()

            if (modelLineId) {
              await loadProductsForModelLine();
            } else {
              await loadData();
            }
          } catch (reloadError) {
            console.error('❌ Error reloading data after deletion:', reloadError)
            // Fallback к обычной загрузке
            if (modelLineId) {
              await loadProductsForModelLine();
            } else {
              await loadData();
            }
          }
        }, 300);
      } else {
        // Возвращаем товар в список при ошибке
        if (modelLineId) {
          await loadProductsForModelLine();
        } else {
          await loadData();
        }

        toast({
          title: "Ошибка",
          description: result.error || "Не удалось удалить товар",
          variant: "destructive",
        });
      }

    } catch (error) {
      logger.error('Failed to delete product:', error);

      // Возвращаем товар в список при ошибке
      if (modelLineId) {
        await loadProductsForModelLine();
      } else {
        await loadData();
      }

      toast({
        title: "Ошибка",
        description: "Не удалось удалить товар",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);

    if (onProductSelect) {
      onProductSelect(productId);
    }
  };

  const getModelLineName = (modelLineId?: number) => {
    if (!modelLineId) return null;
    const modelLine = modelLines.find(ml => ml.id === modelLineId);
    return modelLine?.name || 'Неизвестная линейка';
  };

  const _getCategoryName = (categoryId?: number) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Неизвестная категория';
  };

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0
    }).format(price);
  };

  if (loading && products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Товары
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
            <Package className="h-5 w-5" />
            Товары ({products.length})
            {modelLineId && (
              <Badge variant="secondary">
                {getModelLineName(modelLineId)}
              </Badge>
            )}
          </CardTitle>

          {showCreateButton && (
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetProductForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить товар
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-4xl max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">
                    {editingProduct ? 'Редактировать товар' : 'Добавить товар'}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Заполните информацию о товаре
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleProductSubmit} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-name" className="text-sm font-medium">Название *</Label>
                      <Input
                        id="product-name"
                        value={productForm.name}
                        onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                        placeholder="Название товара"
                        className="h-10 sm:h-9"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-sku" className="text-sm font-medium">Артикул</Label>
                      <Input
                        id="product-sku"
                        value={productForm.sku}
                        onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                        placeholder="SKU-123"
                        className={`h-10 sm:h-9 ${(!productForm.sku.trim() && !productForm.article_number.trim() && attemptedSave) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-article" className="text-sm font-medium">Номер артикула</Label>
                      <Input
                        id="product-article"
                        value={productForm.article_number}
                        onChange={(e) => setProductForm({...productForm, article_number: e.target.value})}
                        placeholder="ART-123"
                        className={`h-10 sm:h-9 ${(!productForm.article_number.trim() && !productForm.sku.trim() && attemptedSave) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-price" className="text-sm font-medium">Цена</Label>
                      <Input
                        id="product-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                        placeholder="100000"
                        className="h-10 sm:h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-discount-price" className="text-sm font-medium">Цена со скидкой</Label>
                      <Input
                        id="product-discount-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={productForm.discount_price}
                        onChange={(e) => setProductForm({...productForm, discount_price: e.target.value})}
                        placeholder="80000"
                        className="h-10 sm:h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Не показывать цену</Label>
                          <p className="text-xs text-gray-500">
                            Если включено, вместо цены будет показано &quot;По запросу&quot;
                          </p>
                        </div>
                        <Switch
                          checked={!productForm.show_price}
                          onCheckedChange={(checked) => setProductForm({...productForm, show_price: !checked})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-model-line" className="text-sm font-medium">Линейка моделей</Label>
                      <SearchableSelect
                        options={[
                          { value: "", label: "Без линейки" },
                          ...modelLines.map(ml => ({
                            value: ml.id.toString(),
                            label: `${ml.name} (${ml.manufacturer_name})`
                          }))
                        ]}
                        value={productForm.model_line_id}
                        onValueChange={(value) => setProductForm({...productForm, model_line_id: value})}
                        disabled={!!modelLineId}
                        placeholder="Выберите линейку моделей"
                        className="h-10 sm:h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-category" className="text-sm font-medium">Категория</Label>
                      <SearchableSelect
                        options={[
                          { value: "", label: "Без категории" },
                          ...categories.map(cat => ({
                            value: cat.id.toString(),
                            label: cat.name
                          }))
                        ]}
                        value={productForm.category_id}
                        onValueChange={(value) => setProductForm({...productForm, category_id: value})}
                        placeholder="Выберите категорию"
                        className="h-10 sm:h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-image" className="text-sm font-medium">URL изображения</Label>
                    <Input
                      id="product-image"
                      type="url"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
                      placeholder="https://example.com/image.jpg"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product-description" className="text-sm font-medium">Описание</Label>
                    <Textarea
                      id="product-description"
                      value={productForm.description}
                      onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      placeholder="Описание товара..."
                      rows={4}
                      className="min-h-[100px] sm:min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-active" className="text-sm font-medium">Статус</Label>
                      <Select
                        value={productForm.is_active ? "true" : "false"}
                        onValueChange={(value) => setProductForm({...productForm, is_active: value === "true"})}
                      >
                        <SelectTrigger className="h-10 sm:h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Активен</SelectItem>
                          <SelectItem value="false">Неактивен</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-featured" className="text-sm font-medium">Рекомендуемый</Label>
                      <Select
                        value={productForm.is_featured ? "true" : "false"}
                        onValueChange={(value) => setProductForm({...productForm, is_featured: value === "true"})}
                      >
                        <SelectTrigger className="h-10 sm:h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Обычный</SelectItem>
                          <SelectItem value="true">Рекомендуемый</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsProductDialogOpen(false)}
                      className="h-10 sm:h-9"
                    >
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-10 sm:h-9"
                    >
                      {loading ? 'Сохранение...' : (editingProduct ? 'Обновить' : 'Создать')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {modelLineId ?
                      'У этой линейки моделей пока нет товаров' :
        'Нет товаров для отображения'
            }
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <Collapsible
                key={product.id}
                open={expandedProducts.has(product.id)}
                onOpenChange={() => toggleProduct(product.id)}
              >
                <CollapsibleTrigger className="w-full text-left bg-muted/50 rounded-lg hover:bg-muted touch-manipulation">
                  {/* Мобильная версия - вертикальный макет */}
                  <div className="block sm:hidden p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedProducts.has(product.id) ?
                          <ChevronDown className="h-4 w-4 flex-shrink-0" /> :
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        }
                        <span className="font-medium text-sm truncate">{product.name}</span>
                        {product.is_featured && <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                      </div>
                      <Badge variant={product.is_active ? "default" : "destructive"} className="text-xs flex-shrink-0">
                        {product.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {product.image_url && (
                          <SafeImage
                            src={product.image_url}
                            alt={product.name}
                            width={32}
                            height={32}
                            className="h-8 w-8 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {product.sku && (
                            <Badge variant="outline" className="text-xs">
                              {product.sku}
                            </Badge>
                          )}
                          {product.price && (
                            <Badge variant="outline" className="text-xs">
                              {formatPrice(product.discount_price || product.price)}
                            </Badge>
                          )}
                          {typeof product.in_stock === 'boolean' && (
                            <Badge variant={product.in_stock ? "default" : "destructive"} className="text-xs">
                              {product.in_stock ? 'В наличии' : 'Нет в наличии'}
                            </Badge>
                          )}
                          {product.has_variants && typeof product.variants_count === 'number' && product.variants_count > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {product.variants_count} вар.
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Мобильные кнопки действий */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/products/${product.id}`, '_blank');
                          }}
                          className="h-8 w-8 p-0"
                          title="Просмотр"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProduct(product);
                          }}
                          className="h-8 w-8 p-0"
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product.id);
                          }}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Десктопная версия - горизонтальный макет */}
                  <div className="hidden sm:flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {expandedProducts.has(product.id) ?
                        <ChevronDown className="h-4 w-4 flex-shrink-0" /> :
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      }
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product.image_url && (
                          <SafeImage
                            src={product.image_url}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="h-10 w-10 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{product.name}</span>
                            {product.is_featured && <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {product.sku && (
                              <Badge variant="outline" className="text-xs">
                                {product.sku}
                              </Badge>
                            )}
                            {!modelLineId && product.model_line_name && (
                              <Badge variant="secondary" className="text-xs">
                                {product.model_line_name}
                              </Badge>
                            )}
                            {product.category_name && (
                              <Badge variant="secondary" className="text-xs">
                                {product.category_name}
                              </Badge>
                            )}
                            <Badge variant={product.is_active ? "default" : "destructive"} className="text-xs">
                              {product.is_active ? 'Активен' : 'Неактивен'}
                            </Badge>
                            {product.price && (
                              <Badge variant="outline" className="text-xs">
                                {formatPrice(product.discount_price || product.price)}
                              </Badge>
                            )}
                            {typeof product.in_stock === 'boolean' && (
                              <Badge variant={product.in_stock ? "default" : "destructive"} className="text-xs">
                                {product.in_stock ? 'В наличии' : 'Нет в наличии'}
                              </Badge>
                            )}
                            {product.has_variants && typeof product.variants_count === 'number' && product.variants_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {product.variants_count} вар.
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selectedProductId === product.id && (
                        <Badge variant="default">Активный</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/products/${product.id}`, '_blank');
                        }}
                        title="Просмотр"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(product);
                        }}
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(product.id);
                        }}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="px-3 pb-3">
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {product.description && (
                      <p className="text-sm text-muted-foreground">
                        {product.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {product.article_number && (
                        <div>
                          <span className="font-medium">Артикул:</span> {product.article_number}
                        </div>
                      )}
                      {product.price && product.discount_price && (
                        <div>
                          <span className="font-medium">Скидка:</span>
                          <span className="line-through ml-1">{formatPrice(product.price)}</span>
                          <span className="text-green-600 ml-1">{formatPrice(product.discount_price)}</span>
                        </div>
                      )}
                      {typeof product.stock_quantity === 'number' && (
                        <div>
                          <span className="font-medium">На складе:</span> {product.stock_quantity} шт.
                        </div>
                      )}
                      {product.has_variants && typeof product.variants_count === 'number' && (
                        <div>
                          <span className="font-medium">Вариантов:</span> {product.variants_count}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      ID: {product.id}
                      {product.created_at && (
                        <span className="ml-4">
                          Создан: {new Date(product.created_at).toLocaleDateString()}
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