"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, notFound } from "next/navigation"
import { SafeImage } from "@/components/safe-image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Header from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductRecommendations } from "@/components/product-recommendations"
import { ProductQuickView } from "@/components/product-quick-view"
import { useAdminStore } from "@/lib/admin-store"
import { ArrowLeft, Clock, FileText } from "lucide-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Prosthetic } from "@/lib/data"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { SimpleCharacteristics } from "@/components/admin/simple-characteristics"
import ProductCharacteristicsMinimal from "@/components/product-characteristics-minimal"
import SelectionTables from "@/components/product-selection-tables"
import { ProductBasicInfo } from "@/components/product-basic-info"
import { useCart } from "@/lib/cart-context"
import { isProductAvailable, isProductOutOfStock, getActualPrice } from "@/lib/utils"
import React from "react"
import { ChevronDown } from "lucide-react"
import { ProductVariantSelectorGrid } from "@/components/product-variant-selector-grid"
import { toast } from "sonner"
import { ProductConfigurationSelector } from "@/components/product-configuration-selector"
import { ProductTagsDisplay } from "@/components/product-tags-display"

// Расширенный тип для продукта с дополнительными полями из API
interface ExtendedProduct extends Prosthetic {
  category_name?: string
  category_full_path?: string
  manufacturer_name?: string
  model_line_name?: string
  batteryLife?: string
  image_url?: string
  in_stock?: boolean
  show_price?: boolean
  stock_status?: string
  article_number?: string
}

interface ProductVariantV2 {
  id: number
  master_id: number
  name: string
  slug: string
  description?: string
  short_description?: string
  sku?: string
  price?: number
  discount_price?: number
  stock_quantity: number
  available_stock: number
  in_stock: boolean
  weight?: number
  length?: number
  width?: number
  height?: number
  primary_image_url?: string
  images?: any[]
  attributes: {
    size?: string
    color?: string
    material?: string
    [key: string]: any
  }
  warranty_months?: number
  battery_life_hours?: number
  is_featured: boolean
  is_new: boolean
  is_bestseller: boolean
  is_recommended: boolean
  characteristics?: any[]
  variant_images?: any[]
  stock_status?: string
  show_price?: boolean
  custom_fields?: {
    configurableCharacteristics: any[]
  }
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { products } = useAdminStore()
  const { addItem } = useCart()
  const [product, setProduct] = useState<ExtendedProduct | null>(null)
  const [productImages, setProductImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(true)
  const [characteristicGroups, setCharacteristicGroups] = useState<any[]>([])
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Prosthetic | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantV2 | null>(null)
  const [variantsLoading, setVariantsLoading] = useState(true)
  const [hasVariants, setHasVariants] = useState(false)
  const [referrerUrl, setReferrerUrl] = useState<string | null>(null)
  const [productImage, setProductImage] = useState<string | null>(null)
  const [selectedConfiguration, setSelectedConfiguration] = useState<Record<string, any>>({})
  const [configurableCharacteristics, setConfigurableCharacteristics] = useState<any[]>([])
  const [configurationError, setConfigurationError] = useState(false)

  const handleQuickView = (p: Prosthetic) => {
    setQuickViewProduct(p)
  }

  // Обработчик смены варианта товара
  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant)
    
    // Если у варианта есть свои изображения, обновляем индекс
    if (variant?.variant_images && variant.variant_images.length > 0) {
      setCurrentImageIndex(0)
    } else if (variant?.primary_image_url) {
      setCurrentImageIndex(0)
    } else if (!variant) {
      // При возврате к товару сбрасываем индекс изображения
      setCurrentImageIndex(0)
    }
    // Характеристики будут обновлены автоматически через useEffect
  }

  // Загружаем варианты товара при загрузке страницы
  const loadProductVariants = async (productId: string) => {
    try {
      setVariantsLoading(true)
      const response = await fetch(
        `/api/v2/product-variants?master_id=${productId}&include_images=true&include_characteristics=true`
      )
      const data = await response.json()
      
      if (data.success && data.data) {
        // Фильтруем стандартные варианты
        let filteredVariants = data.data.filter((variant: any) => 
          !variant.name?.toLowerCase().includes('standard')
        )
        
        if (filteredVariants.length > 0) {
          setHasVariants(true)
          console.log(`Loaded ${filteredVariants.length} variants for product ${productId}`)
        } else {
          setHasVariants(false)
        }
      } else {
        setHasVariants(false)
      }
    } catch (error) {
      console.error('Error loading product variants:', error)
      setHasVariants(false)
    } finally {
      setVariantsLoading(false)
    }
  }

  // Объединяем данные продукта с данными выбранного варианта
  const displayProduct = React.useMemo(() => {
    if (!product) return null
    if (!selectedVariant) return product

    return {
      ...product,
      // Не перезаписываем основные данные товара данными варианта
      // Оставляем только те поля, которые должны меняться при выборе варианта
      stock_status: selectedVariant.stock_status || product.stock_status,
      in_stock: selectedVariant.in_stock,
      stock_quantity: selectedVariant.stock_quantity ?? product.stock_quantity,
      // Добавляем характеристики варианта к характеристикам продукта
      specifications: [
        ...(product.specifications || []),
        ...((selectedVariant.attributes?.characteristics || selectedVariant.characteristics || []).map((char: any) => ({
          spec_name: char.template_name || char.name || char.spec_name || char.value_name || 'Характеристика',
          spec_value: char.text_value || char.numeric_value || char.enum_value_name || char.value || char.spec_value || char.value_name || '',
          group_name: char.group_name || 'Характеристики варианта',
          group_id: char.group_id || 999,
          spec_type: 'variant'
        })))
      ]
    }
  }, [product, selectedVariant])

  // Формируем массив изображений для отображения
  const images = React.useMemo(() => {
    
    // Приоритет 1: изображения выбранного варианта (из поля images или variant_images)
    if (selectedVariant?.variant_images && Array.isArray(selectedVariant.variant_images) && selectedVariant.variant_images.length > 0) {
      return selectedVariant.variant_images.map((img: any) => typeof img === 'string' ? img : (img.url || img))
    }
    
    // Приоритет 1.2: поле images варианта
    if (selectedVariant?.images && Array.isArray(selectedVariant.images) && selectedVariant.images.length > 0) {
      return selectedVariant.images.map((img: any) => typeof img === 'string' ? img : (img.url || img))
    }

    // Приоритет 1.5: основное изображение варианта (если нет массива изображений)
    if (selectedVariant?.primary_image_url) {
      return [selectedVariant.primary_image_url]
    }

    // Приоритет 2: загруженные отдельно изображения
    if (productImages.length > 0) {
      return productImages
    }

          // Приоритет 3: изображения из API продукта
    if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images
    }

    // Приоритет 4: основное изображение продукта
    if (product?.imageUrl || product?.image_url) {
      const imageUrl = product.imageUrl || product.image_url
      return [imageUrl]
    }

    // Fallback изображение
    return [PROSTHETIC_FALLBACK_IMAGE]
  }, [selectedVariant, productImages, product?.images, product?.imageUrl, product?.image_url])
  



  useEffect(() => {
    setCurrentImageIndex(0)
  }, [images])

  // Навигация по изображениям
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  // Навигация в полноэкранном режиме
  const nextFullscreenImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevFullscreenImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  // Открытие полноэкранного просмотра
  const openFullscreen = () => {
    setIsFullscreenOpen(true)
  }

  // Закрытие полноэкранного просмотра
  const closeFullscreen = () => {
    setIsFullscreenOpen(false)
  }

  // Загрузка полной информации о продукте из API
  const loadProductDetails = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          return data.data
        }
      }
    } catch (error) {
      console.error('Error loading product details:', error)
    }
    return null
  }


  // Загрузка изображений продукта
  const loadProductImages = async (productId: string) => {
    setImagesLoading(true)
    try {
      // Сначала пытаемся загрузить из API изображений
      const response = await fetch(`/api/products/${productId}/images`)
      if (response.ok) {
        const data = await response.json()

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {

          setProductImages(data.data)
                      // Если изображение товара еще не установлено, используем первое из загруженных
                      if (!productImage && data.data[0]) {
              setProductImage(data.data[0])
          }
        } else {

          setProductImages([])
        }
      } else {

        setProductImages([])
      }
    } catch (error) {
      console.error('Error loading product images:', error)
      setProductImages([])
    } finally {
      setImagesLoading(false)
    }
  }

  // Сохраняем referrer при первой загрузке
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      setReferrerUrl(document.referrer)
    }
  }, [])

  useEffect(() => {
    if (params?.id) {
      const productId = params.id as string

      // Загружаем детальную информацию о продукте из API
      loadProductDetails(productId).then(apiProduct => {
        if (apiProduct) {

          // Используем данные из API как основные
          setProduct(apiProduct)
                      // Сохраняем оригинальное изображение товара
            if (apiProduct.imageUrl || apiProduct.image_url || apiProduct.primary_image_url) {
            setProductImage(apiProduct.imageUrl || apiProduct.image_url || apiProduct.primary_image_url)
          }
          loadProductImages(productId)
          // Загружаем варианты товара
          loadProductVariants(productId)
        } else {

          // Fallback на данные из store
          if (products.length > 0) {
            const foundProduct = products.find((p: Prosthetic) => p.id === productId)
            if (foundProduct) {
              setProduct(foundProduct)
              // Сохраняем оригинальное изображение товара
              setProductImage(foundProduct.imageUrl || foundProduct.image_url || foundProduct.primary_image_url || null)
              loadProductImages(productId)
              // Загружаем варианты товара
              loadProductVariants(productId)
            }
          }
        }
        setIsLoading(false)
      })
    }
  }, [params?.id, products])

  useEffect(() => {
    if (product) {
      // Если выбран вариант с характеристиками, показываем только их
      const variantCharacteristics = selectedVariant?.attributes?.characteristics || selectedVariant?.characteristics
      if (selectedVariant && variantCharacteristics && Array.isArray(variantCharacteristics) && variantCharacteristics.length > 0) {
        // Группируем характеристики варианта по группам
        const variantGroups: { [key: number]: any } = {}
        
        variantCharacteristics.forEach((char: any) => {
          const groupId = char.group_id || 999
          const groupName = char.group_name || 'Характеристики'
          const groupOrdering = char.group_ordering || char.group_sort_order || 999
          
          if (!variantGroups[groupId]) {
            variantGroups[groupId] = {
              group_id: groupId,
              group_name: groupName,
              group_ordering: groupOrdering,
              characteristics: []
            }
          }
          
          variantGroups[groupId].characteristics.push({
            value_id: char.value_id || Math.random(),
            value_name: String(char.value_name || char.text_value || char.numeric_value || char.enum_value_name || 'Значение'),
            additional_value: String(char.additional_value || '')
          })
        })
        
        // Сортируем группы по алфавиту
        const sortedGroups = Object.values(variantGroups)
          .sort((a, b) => (a.group_name || '').localeCompare(b.group_name || '', 'ru'))
          .map(group => ({
            ...group,
            // Сортируем характеристики внутри группы по алфавиту
            characteristics: [...group.characteristics].sort((a, b) => {
              const nameA = String(a.additional_value || a.value_name || '');
              const nameB = String(b.additional_value || b.value_name || '');
              return nameA.localeCompare(nameB, 'ru');
            })
          }))
        
        // Создаем единственную секцию с характеристиками варианта
        const sections = [{
          section_id: 1,
          section_name: 'Характеристики',
          section_ordering: 0,
          groups: sortedGroups
        }]
        
        console.log('Setting variant characteristic groups:', sections)
        setCharacteristicGroups(sections)
      } else if (selectedVariant && selectedVariant.id) {
        // Если выбран вариант, но у него нет характеристик, пробуем загрузить характеристики варианта из API
        fetch(`/api/product-variants/${selectedVariant.id}/characteristics`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data && data.data.characteristics && data.data.characteristics.length > 0) {
              // Преобразуем характеристики в формат секций
              const groupsMap = new Map<number, any>()
              
              data.data.characteristics.forEach((group: any) => {
                if (!groupsMap.has(group.group_id)) {
                  groupsMap.set(group.group_id, {
                    group_id: group.group_id,
                    group_name: group.group_name,
                    group_ordering: group.group_ordering || 0,
                    characteristics: []
                  })
                }
                
                const targetGroup = groupsMap.get(group.group_id)
                group.characteristics.forEach((char: any) => {
                  targetGroup.characteristics.push({
                    value_id: char.id || char.value_id,
                    value_name: char.label || char.value_name || '',
                    additional_value: char.display_value || char.additional_value || ''
                  })
                })
              })
              
              const sortedGroups = Array.from(groupsMap.values())
                .sort((a, b) => (a.group_name || '').localeCompare(b.group_name || '', 'ru'))
                .map(group => ({
                  ...group,
                  // Сортируем характеристики внутри группы по алфавиту
                  characteristics: [...group.characteristics].sort((a, b) => {
                    const nameA = String(a.additional_value || a.value_name || '');
                    const nameB = String(b.additional_value || b.value_name || '');
                    return nameA.localeCompare(nameB, 'ru');
                  })
                }))
              
              const sections = [{
                section_id: 1,
                section_name: 'Характеристики',
                section_ordering: 0,
                groups: sortedGroups
              }]
              
              console.log('Setting variant API characteristic groups:', sections)
              setCharacteristicGroups(sections)
            } else {
              // Если у варианта нет характеристик, показываем характеристики товара
              loadProductCharacteristics()
            }
          })
          .catch(err => {
            console.error('❌ Failed to load variant characteristics', err)
            // При ошибке показываем характеристики товара
            loadProductCharacteristics()
          })
      } else {
        // Если вариант не выбран, загружаем характеристики товара
        loadProductCharacteristics()
      }
    }
    
    function loadProductCharacteristics() {
      if (!product) return
      
      fetch(`/api/products/${product.id}/characteristics-simple`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const sections = data.data.sections || []
            console.log('🔍 Characteristics API Response:', {
              sectionsCount: sections.length,
              sections: sections,
              firstSectionGroups: sections[0]?.groups,
              firstGroupCharacteristics: sections[0]?.groups?.[0]?.characteristics
            })
            setCharacteristicGroups(sections)
          } else if (data.error) {
            console.error('❌ Simple characteristics API Error:', data.error)
          }
        })
        .catch(err => console.error('❌ Failed to load characteristics', err))
    }
  }, [product, selectedVariant])

  // Обновляем заголовок страницы при изменении варианта
  useEffect(() => {
    if (displayProduct) {
      const title = selectedVariant 
        ? `${displayProduct.name} - ${selectedVariant.name}`
        : displayProduct.name
      document.title = `${title} | МЕДСИП`
    }
  }, [displayProduct, selectedVariant])

  // Обработчик клавиш для полноэкранного режима
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFullscreenOpen) return

      switch (event.key) {
        case 'Escape':
          closeFullscreen()
          break
        case 'ArrowLeft':
          prevFullscreenImage()
          break
        case 'ArrowRight':
          nextFullscreenImage()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreenOpen])

  // Загружаем конфигурируемые характеристики при изменении товара или варианта
  useEffect(() => {
    const loadConfigurableCharacteristics = async () => {
      try {
        // Определяем ID для загрузки характеристик
        const idToLoad = selectedVariant ? selectedVariant.id : product?.id
        if (!idToLoad) {
          setConfigurableCharacteristics([])
          return
        }

        console.log('🔍 Загрузка конфигурируемых характеристик для:', selectedVariant ? 'варианта' : 'товара', idToLoad)
        
        const response = await fetch(`/api/products/${idToLoad}/configurable-characteristics`)
        const data = await response.json()
        
        if (data.success && data.data.configurable_characteristics) {
          setConfigurableCharacteristics(data.data.configurable_characteristics)
          console.log('✅ Загружено конфигурируемых характеристик:', {
            count: data.data.configurable_characteristics.length,
            characteristics: data.data.configurable_characteristics
          })
        } else {
          console.log('⚠️ Нет конфигурируемых характеристик')
          setConfigurableCharacteristics([])
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки конфигурируемых характеристик:', error)
        setConfigurableCharacteristics([])
      }
    }

    loadConfigurableCharacteristics()
  }, [product?.id, selectedVariant?.id])

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Фоновые декоративные элементы в стиле Tiffany */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/40 pointer-events-none"></div>
        <div className="fixed top-20 right-10 w-64 h-64 bg-gradient-to-br from-cyan-100/20 to-blue-100/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-32 left-16 w-48 h-48 bg-gradient-to-tr from-teal-100/15 to-cyan-100/20 rounded-full blur-2xl pointer-events-none"></div>

        <Header />
        <main className="flex-grow flex items-center justify-center relative z-10">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-cyan-200/40 shadow-xl shadow-cyan-100/20 p-12 text-center">
            <div className="w-12 h-12 animate-spin mx-auto mb-6 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
            <p className="text-cyan-700 font-medium text-lg">Загрузка товара...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Фоновые декоративные элементы в стиле Tiffany */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/40 pointer-events-none"></div>
        <div className="fixed top-20 right-10 w-64 h-64 bg-gradient-to-br from-cyan-100/20 to-blue-100/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-32 left-16 w-48 h-48 bg-gradient-to-tr from-teal-100/15 to-cyan-100/20 rounded-full blur-2xl pointer-events-none"></div>

        <Header />
        <main className="flex-grow flex items-center justify-center relative z-10">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-cyan-200/40 shadow-xl shadow-cyan-100/20 p-12 text-center max-w-md">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent">
              Товар не найден
            </h1>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Запрашиваемый товар не существует или был удален.
            </p>
            <Button
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 hover:scale-[1.02] rounded-xl font-medium"
              onClick={() => window.location.href = '/'}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться на главную
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Фоновые декоративные элементы в стиле Tiffany - адаптивные */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/40 pointer-events-none"></div>
      <div className="fixed top-10 right-4 w-32 h-32 sm:top-20 sm:right-10 sm:w-64 sm:h-64 bg-gradient-to-br from-cyan-100/20 to-blue-100/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-16 left-4 w-24 h-24 sm:bottom-32 sm:left-16 sm:w-48 sm:h-48 bg-gradient-to-tr from-teal-100/15 to-cyan-100/20 rounded-full blur-2xl pointer-events-none"></div>

      <Header />
      <main className="flex-grow relative z-10">
        <div className="container mx-auto py-4 sm:py-8 px-2 sm:px-6 lg:px-12">
          {/* Breadcrumb - Tiffany style с адаптивностью */}
          <div className="bg-white/60 backdrop-blur-lg rounded-lg sm:rounded-xl border border-cyan-200/40 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm shadow-cyan-100/20">
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-cyan-700 overflow-x-auto">
              <Link href="/" className="hover:text-cyan-600 transition-colors font-medium whitespace-nowrap">
                Главная
              </Link>
              <span className="text-cyan-400">/</span>
              <Link href="/#products" className="hover:text-cyan-600 transition-colors font-medium whitespace-nowrap">
                Товары
              </Link>
              <span className="text-cyan-400">/</span>
              <span className="text-slate-800 font-semibold truncate">{product.short_name || product.name}</span>
            </div>
          </div>

          {/* Back Button - Tiffany style с адаптивностью */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                // Проверяем, есть ли referrer и он с того же домена
                if (referrerUrl && referrerUrl.includes(window.location.hostname)) {
                  // Если пришли с того же сайта, используем router.back()
                  router.back()
                } else if (window.history.length > 2) {
                  // Если есть история навигации, используем back()
                  router.back()
                } else {
                  // В противном случае переходим на главную с секцией продуктов
                  router.push('/#products')
                }
              } catch (error) {
                // В случае ошибки переходим на главную
                console.error('Navigation error:', error)
                router.push('/')
              }
            }}
            className="mb-4 sm:mb-8 bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Назад
          </Button>

          {/* Main Product Section - Tiffany glass card с адаптивностью */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-cyan-200/40 shadow-xl shadow-cyan-100/20 overflow-hidden mb-8 sm:mb-12">
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Product Images - левая часть с адаптивностью */}
              <div className="p-3 sm:p-6 lg:p-8 bg-gradient-to-br from-white/80 to-cyan-50/30">
                <div className="space-y-2 sm:space-y-4">
                  <div className="relative aspect-square max-w-md sm:max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto rounded-lg sm:rounded-xl overflow-hidden border border-cyan-200/30 shadow-lg bg-white/50 backdrop-blur-sm">
                    {imagesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 animate-spin border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="relative w-full h-full cursor-pointer group"
                          onClick={openFullscreen}
                        >
                          <SafeImage
                            src={images[currentImageIndex] || PROSTHETIC_FALLBACK_IMAGE}
                            alt={product.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-contain transition-transform duration-300 group-hover:scale-105"
                            priority={currentImageIndex === 0}
                            onError={(e) => {
                              console.error('Image failed to load:', images[currentImageIndex])
                            }}
                          />
                          {/* Overlay с иконкой увеличения */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                              <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {!imagesLoading && images.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm border border-cyan-200/40 text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 hover:border-cyan-300 p-2 sm:p-3 rounded-full transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm border border-cyan-200/40 text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 hover:border-cyan-300 p-2 sm:p-3 rounded-full transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </>
                    )}

                  </div>

                  {/* Image Thumbnails - Tiffany style с адаптивностью */}
                  {!imagesLoading && images.length > 1 && (
                    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-300 ${index === currentImageIndex
                              ? "border-cyan-500 shadow-lg shadow-cyan-200/50"
                              : "border-cyan-200/50 hover:border-cyan-400/70 hover:shadow-md"
                            }`}
                        >
                          <SafeImage
                            src={image || PROSTHETIC_FALLBACK_IMAGE}
                            alt={`${product.name} ${index + 1}`}
                            fill
                            sizes="(max-width: 640px) 48px, 64px"
                            className="object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Конфигурация товара - под изображением */}
                  {configurableCharacteristics.length > 0 && (
                    <div className="mt-4">
                      <ProductConfigurationSelector
                        configurableCharacteristics={configurableCharacteristics}
                        onChange={(config) => {
                          setSelectedConfiguration(config)
                          setConfigurationError(false) // Сбрасываем ошибку при выборе
                        }}
                        hasError={configurationError}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info - правая часть с адаптивностью */}
              <div className="p-4 sm:p-8 lg:p-12 bg-gradient-to-br from-white/90 to-blue-50/30 flex flex-col min-h-[400px] sm:min-h-[600px]">
                <div className="flex-1 space-y-4 sm:space-y-6">
                  {/* Название */}
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent leading-tight break-words">
                    {displayProduct?.name || product.name}
                  </h1>

                  {/* Теги товара */}
                  <ProductTagsDisplay 
                    productId={parseInt(String(product.id))} 
                    variantId={selectedVariant?.id}
                    variant="default" 
                    maxTags={5}
                    className="mt-2"
                  />

                  {/* Цена и кнопка добавления */}
                  <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/30 rounded-xl border border-cyan-200/40 p-4 sm:p-6 shadow-lg shadow-cyan-100/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-sm sm:text-base">₽</span>
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-semibold text-cyan-800 mb-1">Цена</h3>
                          {/* Если выбран вариант, показываем его цену */}
                          {selectedVariant ? (
                            // Проверяем show_price варианта
                            selectedVariant.show_price === false ? (
                              <span className="text-lg sm:text-xl font-bold text-slate-600">
                                По запросу
                              </span>
                            ) : selectedVariant.discount_price ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                                  {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(selectedVariant.discount_price)}
                                </span>
                                {selectedVariant.price && (
                                  <span className="text-xs sm:text-sm line-through text-slate-400">
                                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(selectedVariant.price)}
                                  </span>
                                )}
                              </div>
                            ) : selectedVariant.price ? (
                              <span className="text-lg sm:text-xl font-bold text-slate-800">
                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(selectedVariant.price)}
                              </span>
                            ) : (
                              <span className="text-lg sm:text-xl font-bold text-slate-600">
                                По запросу
                              </span>
                            )
                          ) : (
                            /* Иначе показываем цену продукта */
                            product.show_price === false || (!product.price && !product.discount_price) ? (
                              <span className="text-lg sm:text-xl font-bold text-slate-600">
                                По запросу
                              </span>
                            ) : (product.price || product.discount_price) ? (
                              product.discount_price && product.price && product.discount_price < product.price ? (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                  <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.discount_price)}
                                  </span>
                                  <span className="text-xs sm:text-sm line-through text-slate-400">
                                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.price)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-lg sm:text-xl font-bold text-slate-800">
                                  {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format((product.price || product.discount_price) ?? 0)}
                                </span>
                              )
                            ) : (
                              <span className="text-lg sm:text-xl font-bold text-slate-600">
                                По запросу
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      {/* Статус наличия */}
                      <div className="text-right">
                        <Badge className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${
                          selectedVariant ? (
                            selectedVariant.in_stock
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 text-green-700'
                              : 'bg-gradient-to-r from-red-100 to-pink-100 border border-red-200 text-red-700'
                          ) : (
                            product.in_stock
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 text-green-700'
                              : 'bg-gradient-to-r from-red-100 to-pink-100 border border-red-200 text-red-700'
                          )
                        }`}>
                          {selectedVariant ? (
                            selectedVariant.in_stock ? 'В наличии' : 'Нет в наличии'
                          ) : (
                            product.in_stock ? 'В наличии' : 'Нет в наличии'
                          )}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Кнопка добавления в заявку */}
                    <Button
                      className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 hover:scale-[1.02] rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2"
                      onClick={async () => {
                        if (product) {
                          // Если есть выбранный вариант, используем его данные
                          if (selectedVariant) {
                            // Проверяем, есть ли конфигурируемые характеристики
                            if (configurableCharacteristics.length > 0) {
                              // Проверяем, выбраны ли все обязательные характеристики
                              const requiredGroups = Object.keys(configurableCharacteristics.reduce((acc, char) => {
                                acc[char.group_id] = true
                                return acc
                              }, {} as Record<number, boolean>))
                              
                              const selectedGroups = Object.keys(selectedConfiguration)
                              
                              if (selectedGroups.length < requiredGroups.length) {
                                toast.warning('Пожалуйста, выберите все параметры конфигурации')
                                setConfigurationError(true)
                                // Прокручиваем к блоку конфигурации
                                const configBlock = document.querySelector('[data-config-selector]')
                                if (configBlock) {
                                  configBlock.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }
                                return
                              }
                            }
                            
                            addItem({
                              id: String(product.id),
                              name: `${product.name} - ${selectedVariant.name}`,
                              price: selectedVariant.discount_price || selectedVariant.price || 0,
                              image_url: selectedVariant.primary_image_url || images[0] || product.image_url || product.primary_image_url || PROSTHETIC_FALLBACK_IMAGE,
                              category: product.category_name || product.category || '',
                              sku: selectedVariant.sku || product.sku || '',
                              article_number: product.article_number || '',
                              is_on_request: selectedVariant.show_price === false || (!selectedVariant.price && !selectedVariant.discount_price),
                              show_price: selectedVariant.show_price,
                              variant_id: selectedVariant.id,
                              variant_name: selectedVariant.name,
                              configuration: selectedConfiguration // Добавляем конфигурацию
                            })
                            
                            // Формируем сообщение о добавлении с учетом конфигурации
                            let message = `Товар "${product.name} - ${selectedVariant.name}" добавлен в корзину`
                            
                            if (Object.keys(selectedConfiguration).length > 0) {
                              const configDetails = Object.values(selectedConfiguration)
                                .map(config => config.value_name)
                                .join(', ')
                              message += ` (${configDetails})`
                            }
                            
                            toast.success(message)
                          } else {
                            // Иначе используем данные продукта
                            // Проверяем конфигурируемые характеристики для основного товара
                            if (configurableCharacteristics.length > 0) {
                              // Проверяем, выбраны ли все обязательные характеристики
                              const requiredGroups = Object.keys(configurableCharacteristics.reduce((acc, char) => {
                                acc[char.group_id] = true
                                return acc
                              }, {} as Record<number, boolean>))
                              
                              const selectedGroups = Object.keys(selectedConfiguration)
                              
                              if (selectedGroups.length < requiredGroups.length) {
                                toast.warning('Пожалуйста, выберите все обязательные характеристики')
                                setConfigurationError(true)
                                // Прокручиваем к блоку конфигурации
                                const configBlock = document.querySelector('[data-config-selector]')
                                if (configBlock) {
                                  configBlock.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }
                                return
                              }
                            }
                            
                            addItem({
                              id: String(product.id),
                              name: product.name,
                              price: getActualPrice(product),
                              image_url: images[0] || product.image_url || product.primary_image_url || PROSTHETIC_FALLBACK_IMAGE,
                              category: product.category_name || product.category || '',
                              sku: product.sku || '',
                              article_number: product.article_number || '',
                              is_on_request: product.show_price === false || (!product.price && !product.discount_price),
                              show_price: product.show_price,
                              configuration: selectedConfiguration // Добавляем конфигурацию
                            })
                            
                            // Формируем сообщение о добавлении с учетом конфигурации
                            let message = `Товар "${product.name}" добавлен в корзину`
                            
                            if (Object.keys(selectedConfiguration).length > 0) {
                              const configDetails = Object.values(selectedConfiguration)
                                .map(config => config.value_name)
                                .join(', ')
                              message += ` (${configDetails})`
                            }
                            
                            toast.success(message)
                          }
                        }
                      }}
                    >
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                      Добавить в заявку
                    </Button>
                  </div>

                  {/* Выбор варианта товара */}
                  <ProductVariantSelectorGrid
                    productId={product.id}
                    masterProduct={{
                      id: String(product.id),
                      name: product.name,
                      primary_image_url: productImage || product.imageUrl || product.image_url || product.primary_image_url || images[0],
                      price: product.price,
                      discount_price: product.discount_price,
                      in_stock: product.in_stock ?? true,
                      stock_quantity: product.stock_quantity ?? 0,
                      warranty: product.warranty,
                      batteryLife: product.batteryLife
                    }}
                    onVariantChange={handleVariantSelect}
                    className="mb-4"
                  />



                </div>
              </div>
            </div>
          </div>

          {/* Основная информация о товаре */}
          <div className="mb-12">
            <ProductBasicInfo
              product={{
                id: String(product.id),
                name: product.name,
                description: product.description,
                price: product.price,
                discount_price: product.discount_price,
                weight: product.weight || undefined,
                warranty: product.warranty,
                batteryLife: product.batteryLife,
                inStock: product.in_stock ?? product.inStock,
                in_stock: product.in_stock,
                category: product.category,
                category_name: product.category_name,
                category_full_path: product.category_full_path,
                manufacturer: product.manufacturer,
                manufacturer_name: product.manufacturer_name,
                model_line_name: product.model_line_name,
                show_price: product.show_price,
                stock_status: product.stock_status,
                stock_quantity: product.stock_quantity,
                article_number: product.article_number || product.sku
              }}
            />
          </div>

          {/* Характеристики товара */}
          <div className="mb-12">
            <ProductCharacteristicsMinimal sections={characteristicGroups} />
          </div>

          {/* Таблицы подбора из каталога */}
          <SelectionTables productSku={`product_id:${product.id}`} />

          {/* Секция рекомендаций */}
          <div className="mt-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl lg:text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent">
                  Похожие товары
                </span>
              </h3>
              <p className="text-slate-600">
                Товары, которые могут вас заинтересовать
              </p>
            </div>

            <ProductRecommendations
              currentProduct={product}
              allProducts={products}
              onProductSelect={handleQuickView}
              className="max-w-none"
            />
          </div>
        </div>
      </main>

      {/* Полноэкранный просмотр изображений */}
      {isFullscreenOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/95 via-black/90 to-slate-800/95 backdrop-blur-md"
          onClick={(e) => {
            // Закрываем при клике на фон
            if (e.target === e.currentTarget) {
              closeFullscreen()
            }
          }}
        >
          {/* Основной контейнер */}
          <div className="relative w-full h-full max-w-7xl max-h-[90vh] mx-auto flex flex-col">
            {/* Верхняя панель с информацией */}
            <div className="flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-b border-white/20">
              <div className="flex items-center gap-4">
                            <h2 className="text-white font-semibold text-lg sm:text-xl truncate">
              {product.name}
              {selectedVariant && (
                <span className="text-white/70 text-sm ml-2">
                  ({selectedVariant.attributes?.size || selectedVariant.name})
                </span>
              )}
            </h2>
                {images.length > 1 && (
                  <span className="text-white/70 text-sm bg-white/20 px-3 py-1 rounded-full">
                    {currentImageIndex + 1} из {images.length}
                  </span>
                )}
              </div>

              {/* Кнопка закрытия - увеличенная для мобильных */}
              <button
                onClick={closeFullscreen}
                className="p-3 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-300 hover:scale-110 touch-manipulation"
                aria-label="Закрыть полноэкранный режим"
              >
                <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Мобильная кнопка закрытия - дополнительная, более заметная */}
            <button
              onClick={closeFullscreen}
              className="md:hidden absolute top-4 right-4 z-10 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white border border-white/30 shadow-lg touch-manipulation"
              aria-label="Закрыть"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Центральная область с изображением */}
            <div 
              className="flex-1 relative flex items-center justify-center p-4 sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Навигационные кнопки */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevFullscreenImage}
                    className="absolute left-4 sm:left-8 top-1/2 transform -translate-y-1/2 p-3 sm:p-4 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-300 hover:scale-110 shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                  <button
                    onClick={nextFullscreenImage}
                    className="absolute right-4 sm:right-8 top-1/2 transform -translate-y-1/2 p-3 sm:p-4 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all duration-300 hover:scale-110 shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                </>
              )}

              {/* Изображение */}
              <div className="relative w-full h-full max-w-3xl max-h-3xl mx-auto">
                <SafeImage
                  src={images[currentImageIndex] || PROSTHETIC_FALLBACK_IMAGE}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Нижняя панель с миниатюрами и управлением */}
            {images.length > 1 && (
              <div className="p-4 sm:p-6 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-t border-white/20">
                {/* Миниатюры */}
                <div className="flex justify-center gap-2 sm:gap-3 overflow-x-auto pb-4">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-300 hover:scale-105 ${
                        index === currentImageIndex
                          ? "border-cyan-400 shadow-lg shadow-cyan-400/50"
                          : "border-white/30 hover:border-white/50"
                      }`}
                    >
                      <SafeImage
                        src={image || PROSTHETIC_FALLBACK_IMAGE}
                        alt={`${product.name} ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover"
                      />
                      {index === currentImageIndex && (
                        <div className="absolute inset-0 bg-cyan-400/20 flex items-center justify-center">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Индикатор прогресса */}
                <div className="flex justify-center gap-1 sm:gap-2">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                        index === currentImageIndex
                          ? "bg-cyan-400 scale-125"
                          : "bg-white/50 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Подсказка по управлению */}
            <div className="absolute bottom-4 right-4 text-white/70 text-xs sm:text-sm bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg">
              {images.length > 1 ? "← → для навигации, Esc для закрытия" : "Esc для закрытия"}
            </div>
          </div>
        </div>
      )}

      {/* Quick View Modal для рекомендаций */}
      {quickViewProduct && (
        <ProductQuickView
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onProductChange={(p) => {
            router.push(`/products/${p.id}`)
            setQuickViewProduct(null)
          }}
        />
      )}

      <Footer />
    </div>
  )
}
