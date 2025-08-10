import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductService } from '@/services/product-service'
import { useProductFormData } from '@/hooks/use-product-form-data'
import type {
  ProductFormData,
  ProductFormState,
  ProductFormActions,
  ProductFormHookReturn,
  ProductValidationErrors
} from '@/lib/types/product-form'

const initialFormData: ProductFormData = {
  name: '',
  short_name: '',
  description: '',
  category_id: null,
  manufacturer_id: null,
  model_line_id: null,
  sku: '',
  article_number: '',
  price: null,
  discount_price: null,
  show_price: false,
  images: [],
  in_stock: true,
  stock_quantity: 0,
  stock_status: 'in_stock',
  warranty: '',
  weight: null,
  batteryLife: '',
  custom_fields: {
    configurableCharacteristics: []
  }
}

const initialValidationErrors: ProductValidationErrors = {}

export function useProductForm(product?: any): ProductFormHookReturn {
  const _router = useRouter()
  const productService = ProductService.getInstance()

  // Загрузка справочных данных
  const {
    categories,
    manufacturers,
    modelLines,
    loading: dataLoading,
    error: dataError,
    getCategoryById,
    getManufacturerById,
    getModelLineById
  } = useProductFormData()

  // Основное состояние формы
  const [formData, setFormDataState] = useState<ProductFormData>(initialFormData)
  const [validationErrors, setValidationErrorsState] = useState<ProductValidationErrors>(initialValidationErrors)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Дополнительные состояния
  const [productImages, setProductImages] = useState<string[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<any[]>([])
  const [newProductSelectionTables, setNewProductSelectionTables] = useState<any>({})
  const [existingProductSelectionTables, setExistingProductSelectionTables] = useState<any>({})

  // Валидация формы
  const validateForm = useCallback((): boolean => {
    const errors: ProductValidationErrors = {}

    if (!formData.name?.trim()) errors.name = true
    if (!formData.category_id) errors.category = true
    if (!formData.manufacturer_id) errors.manufacturer = true
    // SKU или Артикул – достаточно одного
    const hasSku = !!formData.sku?.trim()
    const hasArticle = !!formData.article_number?.trim()
    if (!hasSku && !hasArticle) {
      errors.sku = true
      errors.article_number = true
    }
    if (!formData.description?.trim()) errors.description = true

    // Цена не является обязательной - товары могут продаваться "по запросу"
    // Но если цена указана, она должна быть положительной
    if (formData.price !== null && formData.price !== undefined && formData.price <= 0) {
      errors.price = true
    }

    setValidationErrorsState(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  // Загрузка данных продукта
  const loadProduct = useCallback(async (id: string) => {
    try {
      setIsLoading(true)

      const [productData, images, characteristics, selectionTables, configurableCharacteristics] = await Promise.all([
        productService.loadProduct(id),
        productService.loadProductImages(id),
        productService.loadCharacteristics(id),
        productService.loadProductSelectionTables(id),
        productService.loadConfigurableCharacteristics(id)
      ])

      if (productData) {
        setFormDataState({
          ...productData,
          // Преобразуем series_id в model_line_id для совместимости с формой
          model_line_id: productData.model_line_id || productData.series_id || null,
          custom_fields: {
            ...productData.custom_fields,
            configurableCharacteristics: configurableCharacteristics || []
          }
        })
        setProductImages(images)
        setProductCharacteristics(characteristics)
        // Используем одни и те же данные для обоих состояний, так как теперь у нас единый endpoint
        setNewProductSelectionTables(selectionTables)
        setExistingProductSelectionTables(selectionTables)
        setIsDirty(false)
      }
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Ошибка загрузки продукта')
    } finally {
      setIsLoading(false)
    }
  }, [productService])

  // Сохранение продукта
  const saveProduct = useCallback(async (): Promise<string | null> => {
    try {
      setIsSaving(true)

      if (!validateForm()) {
        if (!formData.sku?.trim() && !formData.article_number?.trim()) {
          toast.error('Укажите SKU или Артикул товара', {
            description: 'Обязательные поля не заполнены',
            duration: 4000,
          })
        } else {
          toast.error('Пожалуйста, исправьте ошибки в форме')
        }
        return null
      }

      // Подготавливаем данные продукта, исключая custom_fields и преобразуя model_line_id
      const { custom_fields, ...productDataWithoutCustomFields } = formData
      let productDataToSave = { 
        ...productDataWithoutCustomFields,
        // Добавляем model_line_id (он же series_id)
        model_line_id: formData.model_line_id || null,
        series_id: formData.model_line_id || null
      }

      // Сохраняем основные данные продукта
      const productId = await productService.saveProduct(productDataToSave)

      // Сохраняем характеристики

      // Исправляем проблему: если характеристики приходят как объект с selected_characteristics, извлекаем массив
      let characteristicsToSave: any = productCharacteristics
      if (productCharacteristics && typeof productCharacteristics === 'object' && !Array.isArray(productCharacteristics)) {
        const charObj = productCharacteristics as any
        if (charObj.selected_characteristics) {
          // Преобразуем из формата API в массив для сохранения
          characteristicsToSave = []
          charObj.selected_characteristics.forEach((group: any) => {
            if (group.characteristics && Array.isArray(group.characteristics)) {
              group.characteristics.forEach((char: any) => {
                characteristicsToSave.push({
                  value_id: char.value_id,
                  additional_value: char.additional_value || null
                })
              })
            }
          })
        } else {
          characteristicsToSave = []
        }
      }

      // Сохраняем связанные данные параллельно
      const savePromises = [
        productService.saveProductImages(productId, productImages)
      ]

      // Для новых товаров сохраняем newProductSelectionTables, для существующих - existingProductSelectionTables
      if (!formData.id) {
        // Новый товар
        savePromises.push(productService.saveNewProductSelectionTables(productId, newProductSelectionTables))
      } else {
        // Существующий товар
        savePromises.push(productService.saveExistingProductSelectionTables(productId, existingProductSelectionTables))
      }

      // Сохраняем характеристики отдельно для всех продуктов (новых и существующих)
      if (characteristicsToSave && characteristicsToSave.length > 0) {
        savePromises.push(productService.saveCharacteristics(productId, characteristicsToSave))
      }
      
      // Сохраняем конфигурируемые характеристики
      console.log('🔍 Saving configurable characteristics:', {
        hasCustomFields: !!custom_fields,
        configurableCharacteristics: custom_fields?.configurableCharacteristics,
        count: custom_fields?.configurableCharacteristics?.length
      })
      
      if (custom_fields?.configurableCharacteristics && custom_fields.configurableCharacteristics.length > 0) {
        savePromises.push(productService.saveConfigurableCharacteristics(productId, custom_fields.configurableCharacteristics))
      }

      await Promise.all(savePromises)

      setIsDirty(false)
      toast.success(formData.id ? 'Товар успешно обновлен!' : 'Товар успешно создан!')
      return productId
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Ошибка сохранения продукта')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [formData, productImages, productCharacteristics, newProductSelectionTables, existingProductSelectionTables, validateForm, productService])

  // Обработчик отправки формы
  const _handleSubmit = useCallback(async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault()

    const savedProductId = await saveProduct()
    if (savedProductId) {
      // Уведомление уже показывается в saveProduct, поэтому здесь не дублируем

      // Обновляем formData с новым ID для новых товаров
      if (!formData.id) {
        setFormDataState(prev => ({
          ...prev,
          id: savedProductId
        }))
      }
    }
  }, [saveProduct, formData.id])

  // Хендлеры для изменения данных
  const setFormData = useCallback((data: Partial<ProductFormData>) => {
    setFormDataState(prev => ({ ...prev, ...data }))
    setIsDirty(true)
  }, [])

  const setValidationErrors = useCallback((errors: Partial<ProductValidationErrors>) => {
    setValidationErrorsState(prev => ({ ...prev, ...errors }))
  }, [])

  const _handleImagesChange = useCallback((images: string[]) => {
    setProductImages(images)
    setIsDirty(true)
  }, [])

  const _handleCharacteristicsChange = useCallback((characteristics: any[]) => {
    // Используем функциональное обновление для предотвращения лишних перерендеров
    setProductCharacteristics(prev => {
      // Проверяем, действительно ли изменились характеристики
      if (JSON.stringify(prev) === JSON.stringify(characteristics)) {
        return prev
      }
      return characteristics
    })
    setIsDirty(true)
  }, [])

  const _handleConfigurableCharacteristicsChange = useCallback((characteristics: any[]) => {
    console.log('🔍 handleConfigurableCharacteristicsChange called with:', characteristics)
    setFormDataState(prev => {
      const updated = {
        ...prev,
        custom_fields: {
          ...prev.custom_fields,
          configurableCharacteristics: characteristics
        }
      }
      console.log('🔍 Updated formData with custom_fields:', updated.custom_fields)
      return updated
    })
    setIsDirty(true)
  }, [])

  const _handleNewProductSelectionTablesChange = useCallback((tables: any) => {
    setNewProductSelectionTables(tables)
    setIsDirty(true)
  }, [])

  const _handleExistingProductSelectionTablesChange = useCallback((tables: any) => {
    setExistingProductSelectionTables(tables)
    setIsDirty(true)
  }, [])

  const resetForm = useCallback(() => {
    setFormDataState(initialFormData)
    setValidationErrorsState(initialValidationErrors)
    setProductImages([])
    setProductCharacteristics([])
    setNewProductSelectionTables({})
    setExistingProductSelectionTables({})
    setIsDirty(false)
  }, [])

  // Загрузка данных при инициализации
  useEffect(() => {
    if (product?.id) {
      loadProduct(product.id)
    }
  }, [product?.id, loadProduct])

  // Состояние и действия
  const _state: ProductFormState = useMemo(() => ({
    formData,
    validationErrors,
    isLoading,
    isSaving,
    isDirty,
    productImages,
    productCharacteristics,
    newProductSelectionTables,
    existingProductSelectionTables
  }), [formData, validationErrors, isLoading, isSaving, isDirty, productImages, productCharacteristics, newProductSelectionTables, existingProductSelectionTables])

  const _actions: ProductFormActions = useMemo(() => ({
    setFormData,
    setValidationErrors,
    setLoading: setIsLoading,
    setSaving: setIsSaving,
    setDirty: setIsDirty,
    setProductImages,
    setProductCharacteristics,
    setNewProductSelectionTables,
    setExistingProductSelectionTables,
    resetForm,
    validateForm
  }), [setFormData, setValidationErrors, resetForm, validateForm])

  return {
    state,
    actions,
    data: {
      categories,
      manufacturers,
      modelLines,
      loading: dataLoading,
      error: dataError
    },
    operations: {
      loadProduct,
      saveProduct,
      handleSubmit,
      handleImagesChange,
      handleCharacteristicsChange,
      handleConfigurableCharacteristicsChange,
      handleNewProductSelectionTablesChange,
      handleExistingProductSelectionTablesChange
    },
    utils: {
      getCategoryById,
      getManufacturerById,
      getModelLineById
    }
  }
}