"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useAdminStore } from "@/lib/admin-store"

interface BulkActionsProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  type: "products" | "categories"
}

export function BulkActions({ selectedIds, onSelectionChange, type }: BulkActionsProps) {
  const [bulkAction, setBulkAction] = useState("")
  const {
    updateProduct,
    deleteProduct,
    updateCategory,
    deleteCategory,
  } = useAdminStore()

  const handleBulkAction = () => {
    if (!bulkAction || selectedIds.length === 0) return

    switch (bulkAction) {
      case "delete":
        if (confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) {
          selectedIds.forEach((id) => {
            switch (type) {
              case "products":
                deleteProduct(id)
                break
              case "categories":
                deleteCategory(id)
                break
            }
          })
          onSelectionChange([])
        }
        break
      case "activate":
        selectedIds.forEach((id) => {
          switch (type) {
            case "products":
              updateProduct(id, { inStock: true })
              break
            case "categories":
              updateCategory(id, { isActive: true })
              break
          }
        })
        onSelectionChange([])
        break
      case "deactivate":
        selectedIds.forEach((id) => {
          switch (type) {
            case "products":
              updateProduct(id, { inStock: false })
              break
            case "categories":
              updateCategory(id, { isActive: false })
              break
          }
        })
        onSelectionChange([])
        break
    }
    setBulkAction("")
  }

  if (selectedIds.length === 0) return null

  return (
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <span className="text-sm font-medium">
        {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
      </span>
      <SearchableSelect
        options={[
          { value: "activate", label: "Activate" },
          { value: "deactivate", label: "Deactivate" },
          { value: "delete", label: "Delete" }
        ]}
        value={bulkAction}
        onValueChange={setBulkAction}
        placeholder="Выберите действие..."
        searchPlaceholder="Поиск действий..."
        className="w-48"
      />
      <Button onClick={handleBulkAction} disabled={!bulkAction} className="bg-teal-500 hover:bg-teal-600">
        Apply
      </Button>
      <Button variant="outline" onClick={() => onSelectionChange([])}>
        Clear Selection
      </Button>
    </div>
  )
}
