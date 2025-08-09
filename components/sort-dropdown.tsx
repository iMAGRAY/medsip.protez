"use client"

import { SearchableSelect, createSelectOptions } from "@/components/ui/searchable-select"
import { sortOptions } from "@/lib/data"

interface SortDropdownProps {
  onSort: (value: string) => void
  currentSort: string
}

export function SortDropdown({ onSort, currentSort }: SortDropdownProps) {
  const options = createSelectOptions(sortOptions, 'value', 'label')

  return (
    <div className="w-48">
      <SearchableSelect
        options={options}
        value={currentSort}
        onValueChange={onSort}
        placeholder="Сортировать по..."
        searchPlaceholder="Поиск вариантов сортировки..."
        className="notion-select"
      />
    </div>
  )
}
