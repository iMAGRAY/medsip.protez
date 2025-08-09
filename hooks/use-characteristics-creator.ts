import { useCallback } from 'react'

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

export function useCharacteristicsCreator(
  specGroups: SpecGroup[],
  productCharacteristics: ProductCharacteristic[],
  productId?: number | null
) {
  // Helper function to find enum value by ID
  const findEnumById = useCallback((enumId: number): { enum: SpecEnum, group: SpecGroup } | null => {
    const searchInGroups = (groups: SpecGroup[]): { enum: SpecEnum, group: SpecGroup } | null => {
      for (const group of groups) {
        if (group.enums) {
          const enumValue = group.enums.find(e => e.id === enumId)
          if (enumValue) {
            return { enum: enumValue, group }
          }
        }

        if (group.children && group.children.length > 0) {
          const result = searchInGroups(group.children)
          if (result) return result
        }
      }
      return null
    }

    return searchInGroups(specGroups)
  }, [specGroups])

  // Create characteristics list from selection state
  const createCharacteristicsFromSelection = useCallback((selectedIds: Set<string>): ProductCharacteristic[] => {
    // Safety check: ensure specGroups are loaded
    if (specGroups.length === 0) {
      return []
    }

    const characteristics: ProductCharacteristic[] = []
    const addedCharacteristicIds = new Set<string>()

    // Add all custom/user-created characteristics (these are kept as-is)
    const customCharacteristics = productCharacteristics.filter(char => char.source === 'user_created')
    customCharacteristics.forEach(char => {
      characteristics.push(char)
      // Track which characteristics we've already added to avoid duplicates
      if (char.selected_enum_id) {
        addedCharacteristicIds.add(`enum_${char.selected_enum_id}`)
      } else if (char.template_id) {
        addedCharacteristicIds.add(`template_${char.template_id}`)
      }
    })

         // Process selected enum characteristics
     selectedIds.forEach(selectedId => {
       // Skip if we already added this characteristic as a custom one
       if (addedCharacteristicIds.has(selectedId)) {
         return
       }

       if (selectedId.startsWith('enum_')) {
         const enumId = parseInt(selectedId.replace('enum_', ''))

        // Find the enum value in spec groups
        const foundResult = findEnumById(enumId)

        if (foundResult) {
          const { enum: foundEnum, group: foundGroup } = foundResult

          // Check if we already have this characteristic loaded from API
          const existingChar = productCharacteristics.find(char =>
            char.selected_enum_id === enumId && char.source === 'api_loaded'
          )

                     if (existingChar) {
             // Use the existing characteristic from API
             characteristics.push(existingChar)
           } else {
             // Create a new characteristic for this selection
             const template_id = foundGroup.original_id || foundGroup.id
             const variant_id = productId || 89 // Use productId if available, fallback to 89

             const newChar: ProductCharacteristic = {
              id: `selected-${template_id}-${variant_id}-enum-${enumId}`,
              group_id: foundEnum.group_id,
              group_name: foundGroup.name,
              characteristic_type: 'select',
              label: foundEnum.value,
              selected_enum_id: foundEnum.id,
              selected_enum_value: foundEnum.value,
              template_id: Number(template_id),
              variant_id: variant_id,
              is_primary: false,
              is_required: false,
              sort_order: foundEnum.ordering,
              source: 'user_selected' // Mark as user selection
            }
            characteristics.push(newChar)
          }
        } else {
          console.error(`❌ Enum ${enumId} not found in spec groups!`)
        }
      }
      // TODO: Handle template_ IDs for text characteristics if needed
         })

     return characteristics
  }, [specGroups, productCharacteristics, productId, findEnumById])

  return {
    createCharacteristicsFromSelection,
    findEnumById
  }
}