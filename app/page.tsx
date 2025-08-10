"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Header from "@/components/header"
import HeroVideo from "@/components/hero-video"
import { Footer } from "@/components/footer"
import { ProductGrid } from "@/components/product-grid"
import { CategorySidebar } from '@/components/category-sidebar'
import { SearchBar } from "@/components/search-bar"
import { SortDropdown } from "@/components/sort-dropdown"
import { ViewToggle } from "@/components/view-toggle"
import { ProductQuickView } from "@/components/product-quick-view"
import { Button } from "@/components/ui/button"
import { ChevronRight, Filter, Loader2, X, ChevronUp, ChevronDown } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { useAdminStore } from "@/lib/admin-store"
import logger from "@/lib/logger"
import { CatalogDownloadButtons } from "@/components/catalog-download-buttons"

// Строгие интерфейсы для типизации
interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
}

interface CategoryGroup {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
  children?: CategoryGroup[]
}

interface Manufacturer {
  id: number
  name: string
  logo_url: string | null
}

interface MenuSection {
  id: string
  name: string
  type: 'category' | 'manufacturer' | 'custom'
  data: CategoryGroup[] | Manufacturer[]
  is_visible: boolean
  sort_order: number
}

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  category_id: number
  manufacturer_id: number
  category?: string
  category_name?: string
}

const PRODUCTS_PER_PAGE = 12 // Количество товаров для загрузки за раз

export default function HomePage() {
  console.log('🏠 HomePage рендерится')
  
  const {
    products: allProducts,
    categories: adminCategories,
    siteSettings,
    initializeData,
    forceRefresh,
    isLoading,
  } = useAdminStore()

  // Initialize data on mount
  useEffect(() => {
    logger.log("🏠 HomePage: useEffect triggered, allProducts.length:", allProducts.length)
    logger.log("🏠 HomePage: isLoading:", isLoading)

    // Always try to initialize data if we don't have products
    if (allProducts.length === 0 && !isLoading) {
      logger.log("🏠 HomePage: No products found, initializing data...")
      initializeData()
    } else {
      logger.log("🏠 HomePage: Products already loaded:", allProducts.length)
    }
  }, [initializeData, allProducts.length, isLoading])

  // Debug log for products
  useEffect(() => {
    logger.log("🏠 HomePage: Products updated:", allProducts.length)
    if (allProducts.length > 0) {
      logger.log("🏷️ Примеры товаров, их категорий и характеристик:",
        allProducts.slice(0, 3).map(p => ({
          name: p.name,
          category: p.category,
          category_id: p.category_id,
          category_name: p.category_name,
          specificationsCount: p.specifications?.length || 0,
          sampleSpecs: p.specifications?.slice(0, 2) || []
        }))
      )
    }
    logger.log("🏠 HomePage: Categories:", adminCategories.length)
  }, [allProducts, adminCategories])

  // Функция для принудительного обновления данных
  const _handleForceRefresh = async () => {
    setRefreshing(true)
    try {
      await forceRefresh()

    } catch (error) {
      console.error('❌ Ошибка при обновлении данных:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Функция для прокрутки к каталогу
  const scrollToCatalog = () => {
    const catalogSection = document.getElementById('products')
    if (catalogSection) {
      catalogSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  }

  // Загружаем категории товаров для каталога
  const [specGroups, setSpecGroups] = useState<any[]>([])
  const [catalogMenuItems, setCatalogMenuItems] = useState<any[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set()) // Для отображения/скрытия подкатегорий
  const [refreshing, setRefreshing] = useState(false)

  // Функция для переключения раскрытия категории
  const toggleCategoryExpansion = useCallback((categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }, [])

  // Функция загрузки характеристик для фильтрации
  const loadFilterCharacteristics = useCallback(async (categoryId?: number | null) => {
    console.log('🎯 loadFilterCharacteristics вызвана с categoryId:', categoryId)
    setIsLoadingCharacteristics(true)
    try {
      logger.log('🔄 Загрузка характеристик для фильтрации...', { categoryId })

      // Если выбрана категория, используем новый API
      const url = categoryId 
        ? `/api/characteristics/by-category?category_id=${categoryId}&include_children=true`
        : '/api/characteristics'
        
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error('❌ HTTP ошибка при загрузке характеристик:', {
          status: response.status,
          statusText: response.statusText,
          url
        })
      }
      
      const result = await response.json()
      
      console.log('📊 API ответ:', {
        url,
        success: result.success,
        sectionsCount: result.data?.sections?.length,
        firstSection: result.data?.sections?.[0],
        rawData: result.data
      })

      if (result.success && result.data) {
        // Сначала собираем все группы с информацией о секциях
        const allGroups = result.data.sections?.flatMap((section: any) =>
          section.groups?.map((group: any) => ({
            id: group.group_id,
            name: group.group_name,
            sectionName: section.section_name,
            values: group.values || []
          })) || []
        ) || []
        
        console.log('🔧 allGroups после обработки:', {
          count: allGroups.length,
          sample: allGroups.slice(0, 3)
        })

        // Находим дублирующиеся названия групп
        const groupNameCounts = allGroups.reduce((acc: any, group: any) => {
          acc[group.name] = (acc[group.name] || 0) + 1
          return acc
        }, {})

        // Преобразуем в финальный формат, добавляя префикс секции только для дубликатов
        const flatCharacteristics = allGroups.map((group: any) => ({
          id: group.id,
          name: groupNameCounts[group.name] > 1 
            ? `${group.sectionName} - ${group.name}` 
            : group.name,
          originalName: group.name, // Сохраняем оригинальное название для фильтрации
          values: group.values
        }))

        console.log('📦 flatCharacteristics после преобразования:', {
          count: flatCharacteristics.length,
          sample: flatCharacteristics.slice(0, 3),
          groupNameCounts
        })

        logger.log(`✅ Получено характеристик для фильтрации: ${flatCharacteristics.length}`)
        if (flatCharacteristics.length > 0) {
          logger.log(`🔧 Примеры характеристик фильтра:`,
            flatCharacteristics.slice(0, 3).map((char: any) => ({
              name: char.name,
              valuesCount: char.values?.length || 0,
              sampleValues: char.values?.slice(0, 3)?.map((v: any) => v.value) || []
            }))
          )
        }
        setAvailableCharacteristics(flatCharacteristics)
        console.log('✅ Установлены характеристики:', flatCharacteristics.length, flatCharacteristics)
      } else {
        logger.error('❌ Ошибка загрузки характеристик:', result.error)
        setAvailableCharacteristics([])
      }
    } catch (error) {
      logger.error('❌ Ошибка загрузки характеристик для фильтрации:', error)
    } finally {
      setIsLoadingCharacteristics(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true;
    
    // Очищаем характеристики при монтировании
    console.log('🧹 Очищаем характеристики при монтировании')
    setAvailableCharacteristics([])

    const loadCategories = async () => {
      try {
        logger.log('🔄 Загрузка категорий товаров...')

        const response = await fetch('/api/categories')
        const result = await response.json()

        if (!isMounted) return;

        // Проверяем новый формат API с success и data
        if (result.success && result.data && Array.isArray(result.data)) {
          logger.log(`✅ Получено категорий: ${result.data.length}`)

          // Преобразуем категории в формат для меню
          const transformCategories = (categories: any[]): any[] => {
            return categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              parent_id: cat.parent_id,
              children: cat.children ? transformCategories(cat.children) : [],
              is_visible: true,
              sort_order: cat.display_order || 0
            }))
          }

          const transformedCategories = transformCategories(result.data)
          setCatalogMenuItems(transformedCategories)
          setSpecGroups(transformedCategories)

          logger.log(`📋 Структура категорий:`)
          transformedCategories.forEach((item: any, index: number) => {
            logger.log(`   ${index + 1}. ${item.name} (ID: ${item.id})`)
            if (item.children && item.children.length > 0) {
              item.children.forEach((child: any) => {
                logger.log(`      └─ ${child.name} (ID: ${child.id})`)
              })
            }
          })

          // Создаем плоский список всех названий категорий для сравнения с товарами
          const flatCategoryNames: string[] = []
          const extractNames = (categories: any[]) => {
            categories.forEach(cat => {
              flatCategoryNames.push(cat.name)
              if (cat.children && cat.children.length > 0) {
                extractNames(cat.children)
              }
            })
          }
          extractNames(transformedCategories)
          logger.log(`📂 Все названия категорий:`, flatCategoryNames)

        } else {
          logger.error('❌ Ошибка загрузки категорий:', result.error || 'Неожиданный формат данных')
        }
      } catch (error) {
        logger.error('❌ Ошибка загрузки категорий товаров:', error)
      }
    }

    const loadData = async () => {
      await Promise.all([
        loadCategories()
        // Не загружаем характеристики сразу, только при выборе категории
      ])
    }

    loadData()

    return () => {
      isMounted = false;
    }
  }, [])

  // Мемоизируем иерархические категории
  const hierarchicalCategories = useMemo(() => {
    // Данные из API categories уже иерархические
    return catalogMenuItems
  }, [catalogMenuItems])

  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]) // Товары для отображения
  const [currentPage, setCurrentPage] = useState(1) // Текущая "страница" для infinite scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false) // Загрузка дополнительных товаров
  const [hasMore, setHasMore] = useState(true) // Есть ли еще товары для загрузки
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("name-asc")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sidebarMode, setSidebarMode] = useState<"categories" | "filters">("categories")

  // Состояние для фильтров
  const [appliedFilters, setAppliedFilters] = useState<{
    categories: string[];
    characteristics: Record<string, string[]>;
  }>({
    categories: [],
    characteristics: {} // Format: { "Вес": ["1.2 кг"], "Гарантия": ["3 года"] }
  })

  // Состояние для фильтров характеристик
  const [availableCharacteristics, setAvailableCharacteristics] = useState<any[]>(() => {
    console.log('🎯 Инициализация availableCharacteristics: пустой массив')
    return []
  })
  const [isLoadingCharacteristics, setIsLoadingCharacteristics] = useState(false)
  
  // Логируем изменения availableCharacteristics
  useEffect(() => {
    console.log('📦 availableCharacteristics изменились:', availableCharacteristics.length, availableCharacteristics)
  }, [availableCharacteristics])

  const handleCategoryChange = useCallback((categoryName: string, categoryId?: number) => {
    console.log('🌐 handleCategoryChange вызвана:', { categoryName, categoryId })
    logger.log(`🔄 Смена категории на: "${categoryName}" (ID: ${categoryId})`)
    setActiveCategory(categoryName)
    setActiveCategoryId(categoryId || null)
    setIsFilterDrawerOpen(false)
    setIsCategoryDrawerOpen(false)
    
    // Очищаем фильтры характеристик при смене категории
    setAppliedFilters(prev => ({ ...prev, characteristics: {} }))
    
    // Загружаем характеристики для новой категории
    if (categoryName === "All" || categoryName === "Все категории") {
      console.log('📦 Загружаем все характеристики')
      loadFilterCharacteristics(null)
    } else if (categoryId) {
      console.log('🎯 Загружаем характеристики для категории:', categoryId)
      loadFilterCharacteristics(categoryId)
    } else {
      console.log('⚠️ Нет categoryId для категории "' + categoryName + '", очищаем характеристики')
      setAvailableCharacteristics([])
    }
  }, [loadFilterCharacteristics])

  // Мемоизируем компонент для отображения иерархических категорий
  const HierarchicalCategoryItem = useCallback(({ group, level = 0 }: { group: any, level?: number }) => {
    const hasChildren = group.children && group.children.length > 0
    const isExpanded = expandedCategories.has(group.id)

    return (
      <div className={`${level > 0 ? 'ml-4' : ''}`} key={group.id}>
        <div className="flex items-center">
          {/* Кнопка раскрытия для категорий с дочерними элементами */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleCategoryExpansion(group.id)
              }}
              className="mr-2 p-1 hover:bg-slate-200 rounded transition-colors"
            >
              {isExpanded ? (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}

          {/* Отступ для элементов без дочерних элементов */}
          {!hasChildren && level > 0 && (
            <div className="w-6 mr-2"></div>
          )}

          {/* Кнопка категории */}
          <button
            onClick={() => {
              console.log('🎯 Категория нажата:', { name: group.name, id: group.id })
              handleCategoryChange(group.name, group.id)
            }}
            className={`
              flex-1 text-left px-3 py-2 rounded-md transition-all duration-200 mb-1
              ${level === 0 ? 'font-medium' : level === 1 ? 'text-sm' : 'text-xs'}
              ${
                activeCategoryId === group.id
                  ? level === 0 ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200/30" :
                    level === 1 ? "bg-gradient-to-r from-cyan-400 to-blue-400 text-white shadow-md shadow-cyan-200/20" :
                    level === 2 ? "bg-gradient-to-r from-cyan-300 to-blue-300 text-white shadow-sm shadow-cyan-200/10" :
                    "bg-gradient-to-r from-cyan-200 to-blue-200 text-slate-700 shadow-sm"
                  : "text-slate-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 hover:text-cyan-700"
              }
            `}
            style={{
              paddingLeft: `${0.75 + level * 0.5}rem`
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                {group.name}
              </span>
            </div>
          </button>
        </div>

        {/* Дочерние категории - РЕКУРСИВНО */}
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {group.children.map((child: any) => (
              <HierarchicalCategoryItem
                key={child.id}
                group={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }, [activeCategoryId, handleCategoryChange, expandedCategories, toggleCategoryExpansion])

  // Обработчик изменения фильтров характеристик
  const handleCharacteristicFilterChange = useCallback((charName: string, value: string, checked: boolean) => {
    setAppliedFilters(prev => {
      const newCharacteristics = { ...prev.characteristics }

      if (!newCharacteristics[charName]) {
        newCharacteristics[charName] = []
      }

      if (checked) {
        if (!newCharacteristics[charName].includes(value)) {
          newCharacteristics[charName] = [...newCharacteristics[charName], value]
        }
      } else {
        newCharacteristics[charName] = newCharacteristics[charName].filter(v => v !== value)
        if (newCharacteristics[charName].length === 0) {
          delete newCharacteristics[charName]
        }
      }

      return {
        ...prev,
        characteristics: newCharacteristics
      }
    })
  }, [])

  // Функция очистки всех фильтров характеристик
  const clearCharacteristicFilters = useCallback(() => {
    setAppliedFilters(prev => ({
      ...prev,
      characteristics: {}
    }))
  }, [])

  // Компонент полноценного меню категорий - только категории без фильтров
  const CategorySidebarComponent = useCallback(() => (
    <CategorySidebar
      hierarchicalCategories={hierarchicalCategories}
      activeCategory={activeCategory}
      activeCategoryId={activeCategoryId}
      onCategoryChange={handleCategoryChange}
      HierarchicalCategoryItem={HierarchicalCategoryItem}
    />
  ), [hierarchicalCategories, activeCategory, handleCategoryChange, HierarchicalCategoryItem])

  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // Initialize filtered products
  useEffect(() => {
    setFilteredProducts(allProducts)
  }, [allProducts])

  // Мемоизируем функцию поиска групп и их детей по ID
  const findGroupAndChildrenById = useCallback((groups: any[], groupId: number): number[] => {
    const result: number[] = []

    for (const group of groups) {
      if (group.id === groupId) {
        result.push(group.id)
        // Добавляем все дочерние группы рекурсивно
        const addChildren = (children: any[]) => {
          for (const child of children) {
            result.push(child.id)
            if (child.children && child.children.length > 0) {
              addChildren(child.children)
            }
          }
        }
        if (group.children && group.children.length > 0) {
          addChildren(group.children)
        }
        return result // Возвращаем сразу, так как ID уникален
      }

      if (group.children && group.children.length > 0) {
        const childResult = findGroupAndChildrenById(group.children, groupId)
        if (childResult.length > 0) {
          return childResult // Если нашли в детях, возвращаем результат
        }
      }
    }

    return result
  }, [])

  // Memoized filtered and sorted products
  const processedProducts = useMemo(() => {
    let tempProducts = [...allProducts]

    // Apply search
    if (searchQuery.trim()) {
      tempProducts = tempProducts.filter((product) =>
        (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply category filter - работаем с реальными категориями товаров
    // Показываем все товары если категория не выбрана или выбрана "All"
    if (activeCategoryId && activeCategory !== "All" && activeCategory !== "Все категории") {
      const relevantCategoryIds = findGroupAndChildrenById(hierarchicalCategories, activeCategoryId)

      logger.log(`🔍 Фильтрация по категории: "${activeCategory}" (ID: ${activeCategoryId})`)
      logger.log(`📋 Найденные ID категорий для фильтрации:`, relevantCategoryIds)
      logger.log(`📦 Всего товаров до фильтрации: ${tempProducts.length}`)

      if (tempProducts.length > 0) {
        logger.log(`🏷️ Примеры категорий товаров:`, tempProducts.slice(0, 5).map(p => ({ 
          name: p.name, 
          category: p.category,
          category_id: p.category_id 
        })))
      }

      tempProducts = tempProducts.filter((product) =>
        product.category_id && relevantCategoryIds.includes(Number(product.category_id))
      )

      logger.log(`📦 Товаров после фильтрации: ${tempProducts.length}`)
    }

    // Apply advanced filters
    if (appliedFilters.categories && appliedFilters.categories.length > 0) {
      tempProducts = tempProducts.filter((p) => p.category && appliedFilters.categories.includes(p.category))
    }

    // Apply characteristics filters
    if (appliedFilters.characteristics && Object.keys(appliedFilters.characteristics).length > 0) {
      logger.log(`🔍 Фильтрация по характеристикам:`, appliedFilters.characteristics)
      logger.log(`📦 Товаров до фильтрации по характеристикам: ${tempProducts.length}`)

      if (tempProducts.length > 0) {
        logger.log(`🏷️ Примеры характеристик товаров:`, tempProducts.slice(0, 3).map(p => ({
          name: p.name,
          specifications: p.specifications?.slice(0, 3) || []
        })))
      }

      tempProducts = tempProducts.filter((product) => {
        // Товар должен соответствовать ВСЕМ выбранным характеристикам
        return Object.entries(appliedFilters.characteristics).every(([charKey, selectedValues]: [string, any]) => {
          if (!selectedValues || selectedValues.length === 0) return true

          // Извлекаем ID группы и название из ключа
          const [groupId, charName] = charKey.split(':')
          
          // Ищем характеристику у товара по ID группы
          const hasCharacteristic = product.specifications?.some((spec: any) =>
            spec.group_id?.toString() === groupId && selectedValues.includes(spec.spec_value)
          )

          logger.log(`🔍 Товар "${product.name}" имеет характеристику "${charName}" (группа ${groupId}):`, hasCharacteristic)
          return hasCharacteristic
        })
      })

      logger.log(`📦 Товаров после фильтрации по характеристикам: ${tempProducts.length}`)
    }

    // Apply sorting
    switch (sortBy) {
      case "name-asc":
        tempProducts.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "name-desc":
        tempProducts.sort((a, b) => b.name.localeCompare(a.name))
        break

      case "newest":
        tempProducts.sort((a, b) => Number.parseInt(String(b.id)) - Number.parseInt(String(a.id)))
        break
      default:
        break
    }

    return tempProducts
  }, [searchQuery, activeCategory, activeCategoryId, appliedFilters, sortBy, allProducts, hierarchicalCategories, findGroupAndChildrenById])

  // Обновляем отфильтрованные товары и сбрасываем пагинацию при изменении фильтров
  useEffect(() => {
    const newProducts = [...processedProducts]
    setFilteredProducts(newProducts)
    setCurrentPage(1)
    setHasMore(true)

    // Показываем первую порцию товаров
    const initialProducts = newProducts.slice(0, PRODUCTS_PER_PAGE)
    setDisplayedProducts(initialProducts)
    setHasMore(newProducts.length > PRODUCTS_PER_PAGE)
  }, [processedProducts])

  // Функция загрузки дополнительных товаров
  const loadMoreProducts = useCallback(() => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)

    // Имитируем небольшую задержку для плавности
    setTimeout(() => {
      const nextPage = currentPage + 1
      const startIndex = (nextPage - 1) * PRODUCTS_PER_PAGE
      const endIndex = startIndex + PRODUCTS_PER_PAGE
      const newProducts = filteredProducts.slice(startIndex, endIndex)

      if (newProducts.length > 0) {
        setDisplayedProducts(prev => [...prev, ...newProducts])
        setCurrentPage(nextPage)
        setHasMore(endIndex < filteredProducts.length)
      } else {
        setHasMore(false)
      }

      setIsLoadingMore(false)
    }, 300)
  }, [currentPage, filteredProducts, isLoadingMore, hasMore])

  // Intersection Observer для автоматической подгрузки
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMoreProducts()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px', // Начинаем загрузку за 100px до достижения элемента
      }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMoreProducts, hasMore, isLoadingMore])

  const _handleFilterChange = useCallback((filters: any) => {
    setAppliedFilters(filters)
    if (isFilterDrawerOpen) setIsFilterDrawerOpen(false)
  }, [isFilterDrawerOpen])

  const handleQuickView = useCallback((product: any) => {

    setQuickViewProduct(product)
  }, [])

  const handleProductChange = useCallback((newProduct: any) => {

    setQuickViewProduct(newProduct)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleSort = useCallback((value: string) => {
    setSortBy(value)
  }, [])

  const handleViewChange = useCallback((newView: "grid" | "list") => {
    setView(newView)
  }, [])

  // Состояние для мобильного фильтра
  const [mobileExpandedCharGroups, setMobileExpandedCharGroups] = useState<Set<string>>(new Set());
  const [desktopExpandedCharGroups, setDesktopExpandedCharGroups] = useState<Set<string>>(new Set());

  const toggleMobileCharGroup = useCallback((charName: string) => {
    setMobileExpandedCharGroups((prev) => {
      // Создаем новый Set с копией значений из предыдущего
      const newSet = new Set([...prev]);
      if (newSet.has(charName)) {
        newSet.delete(charName);
      } else {
        newSet.add(charName);
      }
      return newSet;
    });
  }, []);

  const toggleDesktopCharGroup = useCallback((charName: string) => {
    setDesktopExpandedCharGroups((prev) => {
      const newSet = new Set([...prev]);
      if (newSet.has(charName)) {
        newSet.delete(charName);
      } else {
        newSet.add(charName);
      }
      return newSet;
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen notion-page">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center notion-fade-in">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4 text-slate-500" />
            <p className="notion-text-small">Загрузка каталога...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen notion-page">
      <Header />
      <main className="flex-grow">
        {/* Hero Section - элегантный тиффани стиль с улучшенной адаптивностью */}
        <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/40">
          {/* Фоновое изображение с теплым жизнерадостным светом */}
          <div className="absolute inset-0">
            <HeroVideo />
            {/* Теплый свет из-за спины семьи */}
            <div className="absolute inset-0 bg-gradient-radial from-amber-300/30 via-orange-200/20 to-transparent bg-center opacity-60 animate-pulse" style={{
              animationDuration: '4s',
              backgroundImage: 'radial-gradient(ellipse 800px 600px at 65% 45%, rgba(251, 191, 36, 0.3) 0%, rgba(251, 146, 60, 0.2) 25%, rgba(234, 88, 12, 0.1) 50%, transparent 70%)'
            }}></div>
            {/* Избирательный темный overlay - больше слева для текста, меньше в центре для семьи */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-800/35 to-slate-700/45 sm:from-slate-900/60 sm:via-slate-800/25 sm:to-slate-700/35"></div>
            {/* Дополнительное освещение для семьи */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(ellipse 600px 500px at 60% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 60%)'
            }}></div>
            {/* Дополнительный теплый градиент для глубины */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-amber-900/15"></div>
          </div>

          {/* Декоративные элементы в тиффани стиле - адаптивные размеры */}
          <div className="absolute top-10 left-4 w-16 h-16 sm:top-20 sm:left-20 sm:w-32 sm:h-32 bg-gradient-to-br from-cyan-200/20 to-blue-200/30 rounded-full blur-2xl"></div>
          <div className="absolute bottom-16 right-4 w-20 h-20 sm:bottom-32 sm:right-16 sm:w-40 sm:h-40 bg-gradient-to-tr from-cyan-100/30 to-blue-100/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-1/4 w-12 h-12 sm:right-1/3 sm:w-24 sm:h-24 bg-gradient-to-br from-cyan-300/10 to-blue-300/15 rounded-full blur-xl"></div>

          <div className="container relative z-10 mx-auto px-2 sm:px-6 lg:px-12">
            <div className="grid lg:grid-cols-1 gap-12 items-center">
              {/* Левая колонка - основной контент */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
                    <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mr-3 animate-pulse"></div>
                    <span className="text-white text-sm font-semibold">Ваш надёжный партнёр</span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                    <span className="text-white">Восстанавливаем</span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                      возможности
                    </span>
                    <br />
                    <span className="text-white/90">возвращаем уверенность</span>
                  </h1>

                  <p className="text-lg sm:text-xl lg:text-2xl text-white/80 leading-relaxed mb-6 sm:mb-8">
                    {siteSettings?.heroSubtitle && siteSettings?.heroSubtitle.trim() !== "Тестовый подзаголовок"
                      ? siteSettings.heroSubtitle
                      : "Современные протезы, созданные с заботой о каждом пациенте. Индивидуальный подход и проверенные технологии."}
                  </p>

                  {/* Кнопка перехода к каталогу */}
                  <Button
                    onClick={scrollToCatalog}
                    size="lg"
                    className="bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg hover:bg-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <ChevronRight className="w-5 h-5 mr-2" />
                    Подобрать
                  </Button>
                </div>

                {/* Статистика - улучшенная адаптивность */}
                <div className="grid grid-cols-3 gap-2 sm:gap-6 pt-6 sm:pt-8 border-t border-white/20">
                  <div className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="text-base sm:text-lg lg:text-2xl text-white">Качество</div>
                  </div>
                  <div className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="text-base sm:text-lg lg:text-2xl text-white">Надежность</div>
                  </div>
                  <div className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="text-base sm:text-lg lg:text-2xl text-white">Ассортимент</div>
                  </div>
                </div>
              </div>

              {/* Правая колонка - карточка с преимуществами */}
              {/* Удалено: правая колонка карточка преимуществ полностью */}
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/60 rounded-full flex justify-center bg-white/10 backdrop-blur-sm">
              <div className="w-1.5 h-4 bg-white/80 rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </section>

        {/* Products Section - элегантный тиффани стиль с улучшенной адаптивностью */}
        <section id="products" className="py-12 sm:py-16 md:py-20 lg:py-24 relative">
          {/* Фоновые декоративные элементы - адаптивные размеры */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/30 via-white to-blue-50/40"></div>
          <div className="absolute top-10 right-4 w-32 h-32 sm:top-20 sm:right-10 sm:w-64 sm:h-64 bg-gradient-to-br from-cyan-100/20 to-blue-100/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 left-4 w-24 h-24 sm:bottom-32 sm:left-16 sm:w-48 sm:h-48 bg-gradient-to-tr from-teal-100/15 to-cyan-100/20 rounded-full blur-2xl"></div>

          <div className="container mx-auto px-2 sm:px-6 lg:px-12 relative z-10">
            {/* Заголовок секции с тиффани акцентами */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-cyan-100/50 to-blue-100/40 backdrop-blur-sm border border-cyan-200/30 mb-6">
                <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mr-3 animate-pulse"></div>
                <span className="text-cyan-700 text-sm font-medium">Каталог решений</span>
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent">
                  Каталог 2025
                </span>
              </h2>

              {/* Кнопки скачать и поделиться каталогом */}
              <CatalogDownloadButtons />
            </div>

            {/* Search and Controls - элегантный тиффани стиль с улучшенной адаптивностью */}
            <div className="bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-cyan-200/40 p-4 sm:p-6 mb-8 sm:mb-10 shadow-lg shadow-cyan-100/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 sm:flex-none">
                    <SearchBar onSearch={handleSearch} />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-100/20 to-blue-100/20 pointer-events-none"></div>
                  </div>
                  <div className="relative">
                    <SortDropdown onSort={handleSort} currentSort={sortBy} />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-100/20 to-blue-100/20 pointer-events-none"></div>
                  </div>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="relative">
                    <ViewToggle view={view} onViewChange={handleViewChange} />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-100/20 to-blue-100/20 pointer-events-none"></div>
                  </div>
                  <div className="lg:hidden flex gap-2">
                    {/* Кнопка Категории */}
                    <Drawer open={isCategoryDrawerOpen} onOpenChange={setIsCategoryDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300 ${
                            activeCategory !== "All" && activeCategory !== "Все категории" ? "ring-2 ring-cyan-400" : ""
                          }`}
                        >
                          <ChevronRight className="w-4 h-4 mr-1 sm:mr-2" />
                          <span>Категории</span>
                          {activeCategory !== "All" && activeCategory !== "Все категории" && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-cyan-600 text-white rounded-full">1</span>
                          )}
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/20 backdrop-blur-xl border-cyan-200/40 max-h-[80vh]">
                        <DrawerHeader className="pb-2">
                          <DrawerTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                            Категории
                          </DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 overflow-y-auto">
                          <CategorySidebarComponent />
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Кнопка Фильтры */}
                    <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300 ${
                            Object.keys(appliedFilters.characteristics).length > 0 ? "ring-2 ring-cyan-400" : ""
                          }`}
                        >
                          <Filter className="w-4 h-4 mr-1 sm:mr-2" />
                          <span>Фильтры</span>
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-cyan-600 text-white rounded-full">
                              {Object.values(appliedFilters.characteristics).flat().length}
                            </span>
                          )}
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/20 backdrop-blur-xl border-cyan-200/40 max-h-[80vh]">
                        <DrawerHeader className="pb-2">
                          <DrawerTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                            Фильтры
                          </DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 overflow-y-auto">
                          <div className="space-y-4">
                            {/* Активные фильтры */}
                            {Object.keys(appliedFilters.characteristics).length > 0 && (
                                <div className="bg-cyan-50/50 rounded-lg p-3 border border-cyan-200/30">
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium text-slate-700">Активные фильтры</h4>
                                    <button
                                      onClick={clearCharacteristicFilters}
                                      className="text-xs text-cyan-600 hover:text-cyan-700 font-medium px-2 py-1 rounded-full bg-cyan-100/50 hover:bg-cyan-200/50 transition-all duration-200"
                                    >
                                      Очистить все
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(appliedFilters.characteristics).map(([charName, values]) =>
                                      values.map((value) => (
                                        <button
                                          key={`${charName}-${value}`}
                                          onClick={() => handleCharacteristicFilterChange(charName, value, false)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full hover:bg-cyan-200 transition-colors"
                                        >
                                          {charName}: {value}
                                          <X className="w-3 h-3" />
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Список характеристик */}
                              {isLoadingCharacteristics ? (
                                <div className="space-y-4">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className="border border-cyan-200/30 rounded-lg p-3 bg-white/50 animate-pulse">
                                      <div className="h-4 bg-cyan-100/50 rounded w-24 mb-2"></div>
                                      <div className="h-3 bg-cyan-50/50 rounded w-full mb-1"></div>
                                      <div className="h-3 bg-cyan-50/50 rounded w-3/4"></div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                availableCharacteristics.map((characteristic) => (
                                  <div key={characteristic.name} className="border border-cyan-200/30 rounded-lg p-3 bg-white/50">
                                    <button
                                      onClick={() => toggleMobileCharGroup(characteristic.name)}
                                      className="flex items-center justify-between w-full text-left mb-2"
                                    >
                                      <h4 className="text-sm font-medium text-slate-700">{characteristic.name}</h4>
                                    {mobileExpandedCharGroups.has(characteristic.name) ?
                                        <ChevronUp className="w-4 h-4 text-cyan-600" /> :
                                        <ChevronDown className="w-4 h-4 text-cyan-600" />
                                      }
                                    </button>

                                    {mobileExpandedCharGroups.has(characteristic.name) && (
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {(characteristic.values || []).map((valueObj: any, index: number) => (
                                          <label
                                            key={`${characteristic.name}-${index}`}
                                            className="flex items-center gap-2 text-sm cursor-pointer hover:text-cyan-700 transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value) || false}
                                              onChange={(e) => handleCharacteristicFilterChange(characteristic.name, valueObj.value, e.target.checked)}
                                              className="h-4 w-4 text-cyan-600 border-cyan-300 rounded focus:ring-cyan-500 focus:ring-1"
                                            />
                                            <span className="flex-1">{valueObj.value}</span>
                                            <span className="text-cyan-500/70 bg-cyan-100/40 px-1.5 py-0.5 rounded text-xs">
                                              {valueObj.productCount}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                          </div>

                          {/* Кнопка применения фильтров */}
                          <div className="mt-6 flex justify-end">
                            <Button
                              onClick={() => setIsFilterDrawerOpen(false)}
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                            >
                              Применить
                            </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </div>
                </div>
              </div>
              
              {/* Активные фильтры для мобильной версии */}
              {(activeCategory !== "All" && activeCategory !== "Все категории" || Object.keys(appliedFilters.characteristics).length > 0) && (
                <div className="lg:hidden mt-3 space-y-2">
                  {/* Выбранная категория */}
                  {activeCategory !== "All" && activeCategory !== "Все категории" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-600 font-medium">Категория:</span>
                      <button
                        onClick={() => handleCategoryChange("All")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full hover:bg-cyan-200 transition-colors"
                      >
                        {activeCategory}
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  
                  {/* Выбранные характеристики */}
                  {Object.keys(appliedFilters.characteristics).length > 0 && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs text-slate-600 font-medium">Фильтры:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(appliedFilters.characteristics).slice(0, 3).map(([charKey, values]: [string, any]) => {
                          // Извлекаем название характеристики из ключа
                          const charName = charKey.includes(':') ? charKey.split(':')[1] : charKey;
                          return values.slice(0, 1).map((value: string) => (
                            <button
                              key={`${charKey}-${value}`}
                              onClick={() => handleCharacteristicFilterChange(charKey, value, false)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-cyan-100 text-cyan-700 rounded-full hover:bg-cyan-200 transition-colors"
                            >
                              {charName}: {value}
                              <X className="w-2.5 h-2.5" />
                            </button>
                          ));
                        })}
                        {Object.values(appliedFilters.characteristics).flat().length > 3 && (
                          <button
                            onClick={() => setIsFilterDrawerOpen(true)}
                            className="inline-flex items-center px-2 py-0.5 text-xs bg-cyan-50 text-cyan-600 rounded-full hover:bg-cyan-100 transition-colors"
                          >
                            +{Object.values(appliedFilters.characteristics).flat().length - 3} еще
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-6 xl:gap-8">
              {/* Desktop Sidebar - элегантная тиффани панель */}
              <div className="hidden lg:block lg:w-64 xl:w-72 2xl:w-80 3xl:w-96 lg:flex-shrink-0">
                <div className="sticky top-6">
                  <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-cyan-200/40 shadow-lg shadow-cyan-100/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-100/50 to-blue-100/40 p-6 border-b border-cyan-200/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                          {sidebarMode === 'categories' ? 'Категории' : 'Фильтры'}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSidebarMode('categories')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                            sidebarMode === 'categories'
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200/30'
                              : 'bg-white/50 text-cyan-700 hover:bg-cyan-50 border border-cyan-200/40'
                          }`}
                        >
                          Категории
                        </button>
                        <button
                          onClick={() => setSidebarMode('filters')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                            sidebarMode === 'filters'
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200/30'
                              : 'bg-white/50 text-cyan-700 hover:bg-cyan-50 border border-cyan-200/40'
                          }`}
                        >
                          <Filter className="w-4 h-4" />
                          Фильтры
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs bg-white/30 rounded-full">
                              {Object.values(appliedFilters.characteristics).flat().length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      {sidebarMode === 'categories' ? (
                        <CategorySidebarComponent />
                      ) : (
                        <div className="space-y-4">
                          {/* Активные фильтры */}
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <div className="bg-cyan-50/50 rounded-lg p-3 border border-cyan-200/30">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-medium text-slate-700">Активные фильтры</h4>
                                <button
                                  onClick={clearCharacteristicFilters}
                                  className="text-xs text-cyan-600 hover:text-cyan-700 font-medium px-2 py-1 rounded-full bg-cyan-100/50 hover:bg-cyan-200/50 transition-all duration-200"
                                >
                                  Очистить все
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(appliedFilters.characteristics).map(([charName, values]) =>
                                  values.map((value) => (
                                    <button
                                      key={`${charName}-${value}`}
                                      onClick={() => handleCharacteristicFilterChange(charName, value, false)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full hover:bg-cyan-200 transition-colors"
                                    >
                                      {charName}: {value}
                                      <X className="w-3 h-3" />
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* Список характеристик */}
                          {isLoadingCharacteristics ? (
                            <div className="space-y-4">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="border border-cyan-200/30 rounded-lg p-3 bg-white/50 animate-pulse">
                                  <div className="h-4 bg-cyan-100/50 rounded w-24 mb-2"></div>
                                  <div className="h-3 bg-cyan-50/50 rounded w-full mb-1"></div>
                                  <div className="h-3 bg-cyan-50/50 rounded w-3/4"></div>
                                </div>
                              ))}
                            </div>
                          ) : availableCharacteristics.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-8">
                              Выберите категорию для отображения фильтров
                            </div>
                          ) : (
                            availableCharacteristics.map((characteristic) => (
                              <div key={characteristic.name} className="border border-cyan-200/30 rounded-lg p-3 bg-white/50">
                                <button
                                  onClick={() => toggleDesktopCharGroup(characteristic.name)}
                                  className="flex items-center justify-between w-full text-left mb-2"
                                >
                                  <h4 className="text-sm font-medium text-slate-700">{characteristic.name}</h4>
                                  {desktopExpandedCharGroups.has(characteristic.name) ?
                                    <ChevronUp className="w-4 h-4 text-cyan-600" /> :
                                    <ChevronDown className="w-4 h-4 text-cyan-600" />
                                  }
                                </button>

                                {desktopExpandedCharGroups.has(characteristic.name) && (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {(characteristic.values || []).map((valueObj: any, index: number) => (
                                      <label
                                        key={`${characteristic.name}-${index}`}
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-cyan-700 transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value) || false}
                                          onChange={(e) => handleCharacteristicFilterChange(characteristic.name, valueObj.value, e.target.checked)}
                                          className="h-3 w-3 text-cyan-600 border-cyan-300 rounded focus:ring-cyan-500 focus:ring-1"
                                        />
                                        <span className="flex-1 truncate">{valueObj.value}</span>
                                        {valueObj.product_count && (
                                          <span className="text-cyan-500/70 bg-cyan-100/40 px-1.5 py-0.5 rounded text-xs">
                                            {valueObj.product_count}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Grid с тиффани обертками */}
              <div className="flex-1 min-w-0">

                <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-cyan-200/30 p-6 shadow-sm">
                  <ProductGrid
                    products={displayedProducts}
                    view={view}
                    onQuickView={handleQuickView}
                    isLoading={isLoading || (allProducts.length === 0 && !filteredProducts.length)}
                  />
                </div>

                {/* Infinite Scroll Trigger - тиффани стиль */}
                <div ref={loadMoreRef} className="mt-8">
                  {isLoadingMore && (
                    <div className="text-center py-8">
                      <div className="bg-white/60 backdrop-blur-lg rounded-2xl border border-cyan-200/40 p-6 shadow-lg shadow-cyan-100/20 max-w-sm mx-auto">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-cyan-500" />
                        <p className="text-cyan-700 font-medium">Загружаем еще товары...</p>
                      </div>
                    </div>
                  )}

                  {!hasMore && filteredProducts.length > 0 && (
                    <div className="text-center py-8">
                      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 backdrop-blur-lg rounded-2xl border border-cyan-200/40 p-6 shadow-lg shadow-cyan-100/20 max-w-sm mx-auto">
                        <p className="text-cyan-700 font-medium">Все товары загружены</p>
                        <div className="w-16 h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mx-auto mt-3"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick View Modal */}
        <ProductQuickView
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onProductChange={handleProductChange}
        />

        <Footer />
      </main>
    </div>
  )
}
