"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, Star, Percent, Crown, Gem, Leaf, ShieldCheck, Truck, Flag, Tag, ChevronDown, ChevronUp } from 'lucide-react'

interface ProductTag {
  id: number
  name: string
  slug: string
  color: string
  bg_color: string
  icon?: string
  sort_order: number
  product_id?: number | null
}

interface ProductTagsDisplayProps {
  productId: string | number
  variantId?: string | number
  variant?: 'default' | 'compact'
  className?: string
  maxTags?: number
}

const ICON_MAP: Record<string, any> = {
  'sparkles': Sparkles,
  'trending-up': TrendingUp,
  'star': Star,
  'percent': Percent,
  'crown': Crown,
  'gem': Gem,
  'leaf': Leaf,
  'shield-check': ShieldCheck,
  'truck': Truck,
  'flag': Flag,
  'tag': Tag,
}

export function ProductTagsDisplay({ 
  productId, 
  variantId,
  variant = 'default',
  className = '',
  maxTags = 3 
}: ProductTagsDisplayProps) {
  const [tags, setTags] = useState<ProductTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    fetchProductTags()
  }, [productId, variantId])

  const fetchProductTags = async () => {
    try {
      const _allTags: ProductTag[] = []
      const tagMap = new Map<number, ProductTag>()
      
      // Загружаем теги товара
      const productResponse = await fetch(`/api/products/${productId}/tags`)
      
      if (productResponse.ok) {
        const productData = await productResponse.json()
        if (productData.success && Array.isArray(productData.data)) {
          productData.data.forEach((tag: ProductTag) => {
            tagMap.set(tag.id, tag)
          })
        }
      }
      
      // Загружаем теги варианта, если variantId указан
      if (variantId) {
        const variantResponse = await fetch(`/api/variants/${variantId}/tags`)
        
        if (variantResponse.ok) {
          const variantData = await variantResponse.json()
          if (variantData.success && Array.isArray(variantData.data)) {
            variantData.data.forEach((tag: ProductTag) => {
              tagMap.set(tag.id, tag) // Дубликаты автоматически заменятся
            })
          }
        }
      }
      
      // Преобразуем Map в массив и сортируем по sort_order
      const uniqueTags = Array.from(tagMap.values()).sort((a, b) => a.sort_order - b.sort_order)
      setTags(uniqueTags)
      
    } catch (error) {
      console.error('Error fetching tags:', error)
      setTags([])
    } finally {
      setIsLoading(false)
    }
  }

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return null
    return ICON_MAP[iconName] || null
  }

  if (isLoading || tags.length === 0) {
    return null
  }

  const displayTags = isExpanded ? tags : tags.slice(0, maxTags)
  const remainingCount = tags.length - maxTags

  return (
    <div className={`flex flex-wrap gap-1 transition-all duration-300 ${className}`}>
      {displayTags.map((tag) => {
        const IconComponent = getIconComponent(tag.icon)
        
        if (variant === 'compact') {
          return (
            <Badge
              key={tag.id}
              style={{
                backgroundColor: tag.bg_color,
                color: tag.color,
                borderColor: tag.color
              }}
              className="text-[10px] px-1.5 py-0.5 flex items-center gap-0.5"
            >
              {IconComponent && <IconComponent className="h-2.5 w-2.5" />}
              {tag.name}
            </Badge>
          )
        }
        
        return (
          <Badge
            key={tag.id}
            style={{
              backgroundColor: tag.bg_color,
              color: tag.color,
              borderColor: tag.color
            }}
            className="text-xs px-2 py-1 flex items-center gap-1"
          >
            {IconComponent && <IconComponent className="h-3 w-3" />}
            {tag.name}
          </Badge>
        )
      })}
      
      {remainingCount > 0 && !isExpanded && (
        <Badge 
          variant="secondary" 
          className={`cursor-pointer hover:bg-gray-200 transition-colors flex items-center gap-0.5 ${
            variant === 'compact' ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
          }`}
          onClick={() => setIsExpanded(true)}
        >
          +{remainingCount}
          <ChevronDown className={variant === 'compact' ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </Badge>
      )}
      
      {isExpanded && tags.length > maxTags && (
        <Badge 
          variant="secondary" 
          className={`cursor-pointer hover:bg-gray-200 transition-colors flex items-center gap-0.5 ${
            variant === 'compact' ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
          }`}
          onClick={() => setIsExpanded(false)}
        >
          Свернуть
          <ChevronUp className={variant === 'compact' ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </Badge>
      )}
    </div>
  )
}