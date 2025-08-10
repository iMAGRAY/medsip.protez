import { useState, useEffect, useCallback, useMemo } from 'react'

interface SpecGroup {
  id: string | number
  name: string
  description?: string
  enum_count?: number
  enum_values?: SpecEnum[]
  parent_id?: string | number | null
  level?: number
  children?: SpecGroup[]
  source_type?: 'spec_group' | 'category'
  original_id?: number
  enums?: SpecEnum[]
  ordering?: number
  is_section?: boolean
}

interface SpecEnum {
  id: number
  group_id: number
  value: string
  ordering: number
  parent_id?: number
  color_value?: string
  color_hex?: string
}

interface ProductCharacteristic {
  id?: string
  group_id: number
  group_name: string
  characteristic_type: 'text' | 'numeric' | 'select' | 'boolean' | 'color'
  label: string
  value_numeric?: number
  value_text?: string
  value_color?: string
  selected_enum_id?: number
  selected_enum_value?: string
  unit_id?: number
  unit_code?: string
  is_primary?: boolean
  is_required?: boolean
  sort_order?: number
  template_id?: number
  variant_id?: number
  source?: 'api_loaded' | 'user_created' | 'user_selected'
}

interface DataReadyState {
  isLoading: boolean
  isInitializing: boolean
  specGroupsLoaded: boolean
  characteristicsLoaded: boolean
  canOperate: boolean
}

export function useCharacteristicsManager(productId?: number | null, isNewProduct = false) {
  // Core data states
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<ProductCharacteristic[]>([])
  const [selectedCharacteristicIds, setSelectedCharacteristicIds] = useState<Set<string>>(new Set())

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data ready state - SINGLE SOURCE OF TRUTH for operational readiness
  const dataReadyState: DataReadyState = useMemo(() => {
    const specGroupsLoaded = specGroups.length > 0
    const characteristicsLoaded = !productId || productCharacteristics.length >= 0 // Allow 0 for products without characteristics
    const _canOperate = !isLoading && !isInitializing && specGroupsLoaded && characteristicsLoaded

    return {
      isLoading,
      isInitializing,
      specGroupsLoaded,
      characteristicsLoaded,
      canOperate
    }
  }, [isLoading, isInitializing, specGroups.length, productCharacteristics.length, productId])

  // Load spec groups
  const loadSpecGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/spec-groups-optimized')

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const processedGroups = processHierarchicalGroups(data.data)
          setSpecGroups(processedGroups)
        }
      } else {
        throw new Error(`Failed to load spec groups: ${response.status}`)
      }
    } catch (error) {
      console.error('Error loading spec groups:', error)
      setError('Не удалось загрузить группы характеристик')
      throw error
    }
  }, [])

  // Load product characteristics
  const loadProductCharacteristics = useCallback(async () => {
    if (!productId) {
      setProductCharacteristics([])
      setSelectedCharacteristicIds(new Set())
      return
    }

    try {
      const response = await fetch(`/api/products/${productId}/characteristics`)

      if (response.ok) {
        const data = await response.json()

        if (data.success && data.data?.characteristics) {
          const characteristicsData = data.data.characteristics || []

          // Process characteristics
          const flatCharacteristics = characteristicsData.flatMap((group: any) => {
            return group.characteristics?.map((char: any) => {
              const isEnumChar = char.enum_value_id && char.type === 'enum'
              const uniqueId = char.id;

              return {
                id: uniqueId,
                group_id: group.group_id,
                group_name: group.group_name,
                characteristic_type: isEnumChar ? 'select' : 'text',
                label: char.enum_display_name || char.enum_value || char.raw_value || char.label,
                value_text: char.raw_value,
                value_numeric: char.numeric_value,
                value_color: char.enum_color || char.raw_value,
                selected_enum_id: isEnumChar ? char.enum_value_id : undefined,
                selected_enum_value: isEnumChar ? (char.enum_display_name || char.enum_value || char.display_value) : undefined,
                template_id: char.template_id,
                variant_id: char.variant_id,
                is_primary: false,
                is_required: false,
                sort_order: char.sort_order || 0,
                source: 'api_loaded' as const
              }
            }) || []
          })

          // Build selected characteristic IDs
          const selectedIds = new Set<string>()
          flatCharacteristics.forEach((char: ProductCharacteristic) => {
            if (char.selected_enum_id) {
              selectedIds.add(`enum_${char.selected_enum_id}`)
            } else if (char.value_text || char.value_numeric !== undefined) {
              selectedIds.add(`template_${char.template_id}`)
            }
          })

                     setProductCharacteristics(flatCharacteristics)
           setSelectedCharacteristicIds(selectedIds)
         } else {
           setProductCharacteristics([])
           setSelectedCharacteristicIds(new Set())
         }
       } else {
         setProductCharacteristics([])
         setSelectedCharacteristicIds(new Set())
       }
     } catch (error) {
       console.error('Error loading characteristics:', error)
      setProductCharacteristics([])
      setSelectedCharacteristicIds(new Set())
      setError('Не удалось загрузить характеристики товара')
    }
  }, [productId])

  // Save characteristics to API
  const _saveCharacteristicsToAPI = useCallback(async (characteristics: ProductCharacteristic[]) => {
    if (!productId) {
      throw new Error('No product ID provided for saving characteristics')
    }

    try {
      const variantId = productId

      const transformedCharacteristics = characteristics.map(char => {
        const transformed: any = {
          template_id: char.template_id,
        }

        if (char.characteristic_type === 'select' && char.selected_enum_id) {
          transformed.enum_value_id = char.selected_enum_id
          if (char.selected_enum_value || char.label) {
            transformed.raw_value = char.selected_enum_value || char.label
          }
        } else if (char.value_text) {
          transformed.raw_value = char.value_text
        } else if (char.value_numeric !== undefined) {
          transformed.numeric_value = char.value_numeric
        }

        return transformed
      })

      const apiData = {
        variant_characteristics: [
          {
            variant_id: variantId,
            characteristics: transformedCharacteristics
          }
        ]
      }

             const response = await fetch(`/api/products/${productId}/characteristics`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(apiData),
       })

       if (!response.ok) {
         const responseText = await response.text()
         throw new Error(`Failed to save characteristics: ${response.status} ${responseText}`)
       }

       const result = await response.json()
       return result
     } catch (error) {
       console.error('Error saving characteristics to API:', error)
      throw error
    }
  }, [productId])

  // Initialize data loading
    const loadData = useCallback(async () => {
              try {
                setIsLoading(true)
                setIsInitializing(true)
                setError(null)

                // Reset state for new products
                if (isNewProduct) {
                  setProductCharacteristics([])
                  setSelectedCharacteristicIds(new Set())
                }

                         await Promise.all([
                   loadSpecGroups(),
                   loadProductCharacteristics()
                 ])
               } catch (error) {
                 console.error('Failed to load data:', error)
                setError('Не удалось загрузить данные')
              } finally {
                setIsLoading(false)
                setIsInitializing(false)
              }
            }, [productId, isNewProduct, loadSpecGroups, loadProductCharacteristics])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper function to process hierarchical groups
  const processHierarchicalGroups = (groups: any[]): SpecGroup[] => {
    // Process flat groups from API into normalized structure
    const processedGroups = groups.map((group: any): SpecGroup => {
      // Fix: API endpoint returns enum values in 'characteristics' field
      const enumValues = group.enum_values || group.enums || group.characteristics || []

      return {
        id: group.id?.toString() || group.group_id?.toString() || 'unknown',
        name: group.name || group.group_name || 'Без названия',
        description: group.description,
        parent_id: group.parent_id,
        source_type: group.source_type || 'spec_group',
        original_id: group.original_id || group.id || group.group_id,
        enums: enumValues,
        enum_count: enumValues.length,
        ordering: group.ordering || 0,
        children: [], // Initialize empty children, will be populated by buildHierarchy
        level: 0 // Will be set by buildHierarchy
      }
    })

    return buildHierarchy(processedGroups)
  }

  // Build hierarchy helper
  const buildHierarchy = (flatGroups: SpecGroup[]): SpecGroup[] => {
    const groupMap = new Map<string, SpecGroup>()
    const rootGroups: SpecGroup[] = []

    // Create map of all groups using string keys for consistency
    flatGroups.forEach(group => {
      groupMap.set(String(group.id), { ...group, children: [] })
    })

    // Build hierarchy
    flatGroups.forEach(group => {
      const groupInMap = groupMap.get(String(group.id))!

      if (group.parent_id) {
        const parentKey = String(group.parent_id)
        const parent = groupMap.get(parentKey)
        if (parent) {
          parent.children!.push(groupInMap)
        } else {
          // If parent not found, treat as root
          rootGroups.push(groupInMap)
        }
      } else {
        rootGroups.push(groupInMap)
      }
    })

    // Set levels
    const setLevels = (groups: SpecGroup[], level: number = 0) => {
      groups.forEach(group => {
        group.level = level
        if (group.children && group.children.length > 0) {
          setLevels(group.children, level + 1)
        }
      })
    }

    setLevels(rootGroups)
    return rootGroups
  }

  return {
    // Data
    specGroups,
    productCharacteristics,
    selectedCharacteristicIds,

    // State
    dataReadyState,
    error,

    // Actions
    setSelectedCharacteristicIds,
    setProductCharacteristics,
    saveCharacteristicsToAPI,
    loadProductCharacteristics,

    // Computed
    canOperate: dataReadyState.canOperate
  }
}