"use client"

import { useState, useEffect, useCallback } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

import { apiClient } from "@/lib/api-client"

// Интерфейсы для типизации данных
interface _Category {
  id: number
  name: string
  is_active: boolean
}

interface _Feature {
  id: number
  name: string
  is_active: boolean
}

interface SidebarFiltersProps {
  onFilterChange: (filters: any) => void
  availableCharacteristics?: any[]
  isLoadingCharacteristics?: boolean
}

export function SidebarFilters({
  onFilterChange,
  availableCharacteristics = [],
  isLoadingCharacteristics = false
}: SidebarFiltersProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<Record<string, string[]>>({})

  // Data from API
  const [categories, setCategories] = useState<string[]>([])
  const [features, setFeatures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
    const loadFilterData = useCallback(async () => {
              try {
                const [categoriesData, featuresData] = await Promise.all([
                  apiClient.getCategories(),
                  apiClient.getFeatures()
                ])

                setCategories(categoriesData.filter((cat: any) => cat.is_active).map((cat: any) => cat.name))
                setFeatures(featuresData.filter((feat: any) => feat.is_active).map((feat: any) => feat.name))
              } catch (error) {
                console.error("Failed to load filter data:", error)
                // Fallback data
                setCategories(["Протезы рук", "Протезы ног", "Специальные протезы", "Детские протезы"])
                setFeatures(["Миоэлектрическое управление", "Водонепроницаемость", "Регулируемая посадка", "Легкий вес", "Высокая прочность"])
              } finally {
                setLoading(false)
              }
            }, [])


  useEffect(() => {
    loadFilterData()
  }, [loadFilterData])

  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  const handleFeatureChange = (feature: string) => {
    setSelectedFeatures((prev) => (prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]))
  }

  const handleCharacteristicChange = (charId: string, charName: string, value: string) => {
    setSelectedCharacteristics((prev) => {
      const newState = { ...prev }
      const key = `${charId}:${charName}` // Используем комбинацию ID и названия
      
      if (!newState[key]) {
        newState[key] = []
      }

      if (newState[key].includes(value)) {
        newState[key] = newState[key].filter(v => v !== value)
        if (newState[key].length === 0) {
          delete newState[key]
        }
      } else {
        newState[key] = [...newState[key], value]
      }

      return newState
    })
  }

  const applyFilters = () => {
    onFilterChange({
      categories: selectedCategories,
      features: selectedFeatures,
      characteristics: selectedCharacteristics,
    })
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedFeatures([])
    setSelectedCharacteristics({})
    onFilterChange({ categories: [], features: [], characteristics: {} })
  }

  if (loading) {
    return (
      <aside className="w-full p-6 space-y-6 tiffany-card lg:w-72">
        <div className="animate-pulse">
          <div className="h-6 rounded mb-4"
               style={{ backgroundColor: 'var(--obsidian-muted, #e4e7ea)' }}></div>
          <div className="space-y-2">
            <div className="h-4 rounded"
                 style={{ backgroundColor: 'var(--obsidian-muted, #e4e7ea)' }}></div>
            <div className="h-4 rounded"
                 style={{ backgroundColor: 'var(--obsidian-muted, #e4e7ea)' }}></div>
            <div className="h-4 rounded"
                 style={{ backgroundColor: 'var(--obsidian-muted, #e4e7ea)' }}></div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-full p-4 space-y-4 notion-card lg:w-80 notion-fade-in">
      <h3 className="notion-text-medium mb-4">
        Фильтры товаров
      </h3>
      <Accordion type="multiple" defaultValue={["category"]} className="w-full">
        <AccordionItem value="category" className="notion-separator">
          <AccordionTrigger className="notion-text-medium py-3 hover:no-underline">
            Категория
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {categories.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${category}`}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => handleCategoryChange(category)}
                  className="notion-checkbox"
                />
                <Label htmlFor={`cat-${category}`} className="notion-text-small cursor-pointer">
                  {category}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="features" className="notion-separator">
          <AccordionTrigger className="notion-text-medium py-3 hover:no-underline">
            Особенности
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center space-x-2">
                <Checkbox
                  id={`feat-${feature}`}
                  checked={selectedFeatures.includes(feature)}
                  onCheckedChange={() => handleFeatureChange(feature)}
                  className="notion-checkbox"
                />
                <Label htmlFor={`feat-${feature}`} className="notion-text-small cursor-pointer">
                  {feature}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="characteristics" className="notion-separator">
          <AccordionTrigger className="notion-text-medium py-3 hover:no-underline">
            Характеристики
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {isLoadingCharacteristics ? (
              <div className="space-y-2">
                <div className="h-3 rounded animate-pulse"
                     style={{ backgroundColor: 'var(--notion-secondary)' }}></div>
                <div className="h-3 rounded animate-pulse"
                     style={{ backgroundColor: 'var(--notion-secondary)' }}></div>
                <div className="h-3 rounded animate-pulse"
                     style={{ backgroundColor: 'var(--notion-secondary)' }}></div>
              </div>
            ) : (
              availableCharacteristics.map((characteristic) => {
                const charKey = `${characteristic.id}:${characteristic.originalName || characteristic.name}`
                return (
                  <div key={characteristic.id} className="space-y-2">
                    <h4 className="notion-text-small font-medium">
                      {characteristic.name}
                    </h4>
                    <div className="space-y-2 pl-2">
                      {characteristic.values.map((valueObj: any, index: number) => (
                        <div key={`${characteristic.id}-${index}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`char-${characteristic.id}-${index}`}
                            checked={selectedCharacteristics[charKey]?.includes(valueObj.value) || false}
                            onCheckedChange={() => handleCharacteristicChange(
                              characteristic.id, 
                              characteristic.originalName || characteristic.name, 
                              valueObj.value
                            )}
                            className="notion-checkbox"
                          />
                          <Label htmlFor={`char-${characteristic.id}-${index}`} className="notion-text-small cursor-pointer">
                          {valueObj.value}
                          <span className="ml-1 notion-text-caption">
                            ({valueObj.productCount})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )})
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col space-y-3">
        <Button
          onClick={applyFilters}
          className="w-full notion-button-primary"
        >
          Применить фильтры
        </Button>
        <Button
          variant="outline"
          onClick={clearFilters}
          className="w-full notion-button-secondary"
        >
          Очистить фильтры
        </Button>
      </div>
    </aside>
  )
}
