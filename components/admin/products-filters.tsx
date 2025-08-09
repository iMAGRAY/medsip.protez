"use client"

import { useMemo } from "react"
import type { Prosthetic } from "@/lib/data"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export interface ProductAdminFilters {
  manufacturer?: string
  modelLine?: string
  category?: string
  priceFrom?: number
  priceTo?: number
}

interface ProductsFiltersProps {
  products: Prosthetic[]
  value: ProductAdminFilters
  onChange: (f: ProductAdminFilters) => void
}

export default function ProductsFilters({ products, value, onChange }: ProductsFiltersProps) {
  const manufacturerOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => {
      if (p.manufacturer_name) set.add(p.manufacturer_name)
      else if (p.manufacturer) set.add(p.manufacturer)
    })
    return Array.from(set)
  }, [products])

  const modelLineOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => {
      if (value.manufacturer) {
        const man = p.manufacturer_name || p.manufacturer
        if (man !== value.manufacturer) return
      }
      if (p.model_line_name) set.add(p.model_line_name)
      else if (p.modelLine) set.add(p.modelLine)
    })
    return Array.from(set)
  }, [products, value.manufacturer])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => {
      if (p.category_name) set.add(p.category_name)
      else if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products])

  const handlePriceChange = (field: "priceFrom" | "priceTo", val: string) => {
    const num = val === "" ? undefined : Number(val)
    onChange({ ...value, [field]: isNaN(num as number) ? undefined : num })
  }

  return (
    <>
      {/* Manufacturer */}
      <div className="flex flex-col gap-1 w-40">
        <label className="text-xs font-medium text-slate-600">Производитель</label>
        <Select value={value.manufacturer ?? undefined} onValueChange={(v) => onChange({ ...value, manufacturer: v === '__all__' ? undefined : v, modelLine: undefined })}>
          <SelectTrigger className="bg-white/80 h-9 text-xs">
            <SelectValue placeholder="Все" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">Все</SelectItem>
            {manufacturerOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Line */}
      <div className="flex flex-col gap-1 w-40">
        <label className="text-xs font-medium text-slate-600">Модельный ряд</label>
        <Select value={value.modelLine ?? undefined} onValueChange={(v) => onChange({ ...value, modelLine: v === '__all__' ? undefined : v })}>
          <SelectTrigger className="bg-white/80 h-9 text-xs">
            <SelectValue placeholder="Все" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">Все</SelectItem>
            {modelLineOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1 w-40">
        <label className="text-xs font-medium text-slate-600">Категория</label>
        <Select value={value.category ?? undefined} onValueChange={(v) => onChange({ ...value, category: v === '__all__' ? undefined : v })}>
          <SelectTrigger className="bg-white/80 h-9 text-xs">
            <SelectValue placeholder="Все" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__">Все</SelectItem>
            {categoryOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-slate-600">Цена от</label>
          <Input type="number" min="0" value={value.priceFrom ?? ""} onChange={(e)=>handlePriceChange("priceFrom", e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-medium text-slate-600">до</label>
          <Input type="number" min="0" value={value.priceTo ?? ""} onChange={(e)=>handlePriceChange("priceTo", e.target.value)} className="h-9 text-xs" />
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={()=>onChange({})}>Сброс</Button>
    </>
  )
}