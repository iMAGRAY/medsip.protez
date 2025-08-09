"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Upload, FileSpreadsheet } from "lucide-react"

export function ExportImport() {
  const [importFile, setImportFile] = useState<File | null>(null)

  const exportData = async () => {
    try {
      const res = await fetch("/api/products/export")
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `products-${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export Excel error:", error)
      alert("Ошибка экспорта в Excel")
    }
  }

  // Функция импорта Excel (заглушка для будущей реализации)
  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Заглушка - будет реализовано при необходимости
    console.warn('Import Excel functionality not yet implemented')
    alert('Импорт Excel будет реализован в следующих версиях')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Экспорт / Импорт (Excel)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-2">Экспорт</h4>
          <p className="text-sm text-slate-600 mb-4">Скачайте таблицу Excel со всеми товарами и характеристиками.</p>
          <Button onClick={exportData} className="bg-gray-600 hover:bg-gray-700">
            <Download className="w-4 h-4 mr-2" />
            Скачать Excel
          </Button>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium mb-2">Импорт</h4>
          <p className="text-sm text-slate-600 mb-4">
            Загрузите файл Excel для обновления базы данных (в разработке).
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-file">Выберите .xlsx файл</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx"
                onChange={handleImportExcel}
              />
            </div>
            <Button
              onClick={() => setImportFile(null)}
              disabled={!importFile}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Импортировать
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
