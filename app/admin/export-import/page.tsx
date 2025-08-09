"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Table as TableIcon, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const AVAILABLE_TABLES = [
  { key: 'products', label: 'Товары' },
  { key: 'categories', label: 'Категории' },
  { key: 'model_lines', label: 'Модельные ряды' },
  { key: 'manufacturers', label: 'Производители' },
  { key: 'product_characteristics', label: 'Характеристики товаров' },
          { key: 'product_sizes', label: 'Размеры товаров' },
      { key: 'product_images', label: 'Изображения товаров' },
  { key: 'catalog_menu_settings', label: 'Настройки каталога' },
  { key: 'site_settings', label: 'Настройки сайта' },
  { key: 'spec_groups', label: 'Группы характеристик' },
] as const

const DEFAULT_SELECTED = AVAILABLE_TABLES.slice(0, 10).map(t => t.key)

export default function ExportImportAdminPage() {
  const [selectedTables, setSelectedTables] = useState<string[]>(DEFAULT_SELECTED)
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [previewTable, setPreviewTable] = useState<string>('products')

  // Fetch preview when table changes
  useEffect(() => {
    const loadPreview = async () => {
      try {
        const res = await fetch(`/api/sql-table/${previewTable}`)
        const data = await res.json()
        setPreviewRows(data.rows || [])
      } catch (error) {
        console.error('Preview load error', error)
        setPreviewRows([])
      }
    }
    loadPreview()
  }, [previewTable])

  const toggleTable = (key: string) => {
    setSelectedTables((prev) => {
      if (prev.includes(key)) return prev.filter((t) => t !== key)
      return [...prev, key]
    })
  }

  const setPreview = (key: string) => {
    setPreviewTable(key)
  }

  const handleExportSelected = async () => {
    const qs = selectedTables.join(',')
    try {
      const res = await fetch(`/api/export/excel?tables=${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Ошибка экспорта')
    }
  }

  const handleExportCurrent = async () => {
    if (!previewTable) return
    try {
      const res = await fetch(`/api/export/excel?tables=${previewTable}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${previewTable}-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Ошибка экспорта')
    }
  }

  const columns = previewRows.length ? Object.keys(previewRows[0]) : []

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Export controls */}
        <Card>
          <CardHeader>
            <CardTitle>Экспорт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4" />
                    Таблицы ({selectedTables.length})
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {AVAILABLE_TABLES.map((tbl) => (
                    <DropdownMenuCheckboxItem
                      key={tbl.key}
                      checked={selectedTables.includes(tbl.key)}
                      onCheckedChange={() => toggleTable(tbl.key)}
                    >
                      {tbl.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={handleExportSelected}>
                <Download className="w-4 h-4 mr-2" /> Экспортировать
              </Button>

              <Button variant="outline" onClick={handleExportCurrent}>
                <Download className="w-4 h-4 mr-2" /> Экспортировать текущую
              </Button>
            </div>

            {selectedTables.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedTables.map((tbl) => (
                  <Button
                    key={tbl}
                    size="sm"
                    variant={tbl === previewTable ? "default" : "outline"}
                    onClick={() => setPreview(tbl)}
                  >
                    {AVAILABLE_TABLES.find((t) => t.key === tbl)?.label || tbl}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview table */}
        <Card>
          <CardHeader>
            <CardTitle>Предпросмотр: {previewTable}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[70vh] overflow-auto">
              <Table className="min-w-max text-xs">
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col}>{String(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {previewRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center">
                        Нет данных
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}