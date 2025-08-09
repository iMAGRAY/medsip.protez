"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import {
  Copy,
  Upload,
  AlertTriangle,
  FileImage,
  Calendar,
  HardDrive,
  Hash
} from "lucide-react"
import { DuplicateFileInfo } from "@/lib/file-hash"
import { formatFileSize } from "@/lib/file-hash"

interface DuplicateFileDialogProps {
  isOpen: boolean
  onClose: () => void
  onUseExisting: () => void
  onUploadNew: () => void
  existingFile: DuplicateFileInfo
  newFileName: string
  newFileSize: number
}

export function DuplicateFileDialog({
  isOpen,
  onClose,
  onUseExisting,
  onUploadNew,
  existingFile,
  newFileName,
  newFileSize
}: DuplicateFileDialogProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const handleUseExisting = () => {
    onUseExisting()
    onClose()
  }

  const handleUploadNew = () => {
    onUploadNew()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Обнаружен дубликат файла
          </DialogTitle>
          <DialogDescription>
            Файл с таким содержимым уже существует в системе. Выберите действие:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Предупреждение */}
          <Alert>
            <Copy className="w-4 h-4" />
            <AlertDescription>
              Система обнаружила, что загружаемый файл идентичен уже существующему в хранилище.
              Это позволяет экономить место и ускорить загрузку.
            </AlertDescription>
          </Alert>

          {/* Сравнение файлов */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Новый файл */}
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-blue-700">Загружаемый файл</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Имя:</span>
                    <span className="truncate" title={newFileName}>{newFileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Размер:</span>
                    <span>{formatFileSize(newFileSize)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Существующий файл */}
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Copy className="w-4 h-4 text-green-500" />
                  <h3 className="font-semibold text-green-700">Существующий файл</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Имя:</span>
                    <span className="truncate" title={existingFile.original_name}>
                      {existingFile.original_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Размер:</span>
                    <span>{formatFileSize(existingFile.file_size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Загружен:</span>
                    <span>{formatDate(existingFile.first_uploaded_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">Загрузок:</span>
                    <Badge variant="secondary">
                      {existingFile.upload_count}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Действия */}
          <div className="space-y-3">
            <h4 className="font-medium">Выберите действие:</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="cursor-pointer border-green-200 hover:border-green-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Copy className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-green-700">Использовать существующий</h5>
                      <p className="text-sm text-slate-600 mt-1">
                        Быстрее и экономит место в хранилище
                      </p>
                      <Badge variant="outline" className="mt-2 text-green-600 border-green-300">
                        Рекомендуется
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer border-blue-200 hover:border-blue-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Upload className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-blue-700">Загрузить дубликат</h5>
                      <p className="text-sm text-slate-600 mt-1">
                        Создать копию файла с новым именем
                      </p>
                      <Badge variant="outline" className="mt-2 text-slate-600">
                        Если нужна отдельная копия
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="outline" onClick={handleUploadNew}>
            <Upload className="w-4 h-4 mr-2" />
            Загрузить дубликат
          </Button>
          <Button onClick={handleUseExisting} className="bg-green-600 hover:bg-green-700">
            <Copy className="w-4 h-4 mr-2" />
            Использовать существующий
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}