"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react"
import { MediaManager, type UploadResult } from "@/lib/s3-client"
import { SafeImage } from "@/components/safe-image"

interface MediaUploaderProps {
  folder?: string
  maxFiles?: number
  acceptedTypes?: string[]
  existingImages?: string[]
  isUploading?: boolean
  onImageUpload?: (files: FileList) => Promise<void>
  onUploadComplete?: (urls: string[]) => void
}

export function MediaUploader({
  folder = "uploads",
  maxFiles = 10,
  acceptedTypes = ["image/*"],
  existingImages = [],
  isUploading = false,
  onImageUpload,
  onUploadComplete,
}: MediaUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles) return

    if (onImageUpload) {
      onImageUpload(selectedFiles)
      return
    }

    const newFiles = Array.from(selectedFiles).slice(0, maxFiles - files.length)
    setFiles(prev => [...prev, ...newFiles])
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    const mediaManager = MediaManager.getInstance()
    const results: UploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const result = await mediaManager.uploadFile(file, folder, (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress
          }))
        })
        results.push(result)
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        results.push({ success: false, error: `Failed to upload ${file.name}` })
      }
    }

    setUploadResults(results)
    setFiles([])
    setUploadProgress({})

    if (onUploadComplete) {
      const successfulUrls = results
        .filter((r) => r.success && r.url)
        .map((r) => r.url!) as string[]
      onUploadComplete(successfulUrls)
    }
  }

  const removeUpload = (index: number) => {
    setUploadResults((prev) => prev.filter((_, i) => i !== index))
  }

  const removeSelectedImage = (url: string) => {
    const newImages = existingImages.filter((img) => img !== url)
    setFiles([])
    setUploadResults([])
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "success": return "Готово"
      case "error": return "Ошибка"
      case "uploading": return "Загрузка"
      default: return "Ожидание"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Изображения товара ({existingImages.length + uploadResults.filter((u) => u.success).length}/{maxFiles})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Images */}
        {existingImages.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Текущие изображения</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {existingImages.map((url, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <SafeImage
                      src={url}
                      alt={`Product ${index + 1}`}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeSelectedImage(url)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isUploading ? "border-gray-500 bg-gray-50" : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-medium mb-2">Загрузить изображения</h3>
          <p className="text-slate-600 mb-4">Перетащите файлы сюда или нажмите для выбора</p>

          <input
            type="file"
            multiple
            accept={acceptedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />
          <label htmlFor="file-upload">
            <Button variant="outline" disabled={isUploading}>
              {isUploading ? "Загрузка..." : "Выбрать файлы"}
            </Button>
          </label>
          <p className="text-xs text-slate-500 mt-2">Поддерживаются: {acceptedTypes.map(type => type.replace("image/", "")).join(", ")}</p>
        </div>

        {/* Upload Files Button */}
        {files.length > 0 && !onImageUpload && (
          <Button onClick={uploadFiles} disabled={isUploading} className="w-full">
            {isUploading ? "Загрузка..." : `Загрузить ${files.length} файл(ов)`}
          </Button>
        )}

        {/* Upload Progress */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Загрузка файлов</h4>
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-shrink-0">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} МБ</p>

                  {isUploading && <Progress value={uploadProgress[file.name] || 0} className="mt-1" />}
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      uploadResults.length > index && uploadResults[index].success ? "default" : "destructive"
                    }
                  >
                    {getStatusText(uploadResults.length > index && uploadResults[index].success ? "success" : "error")}
                  </Badge>

                  <Button variant="ghost" size="sm" onClick={() => removeUpload(index)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Результаты загрузки</h4>
            {uploadResults.map((result, index) => (
              <div key={index} className={`p-3 rounded-lg ${result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <p className="text-sm font-medium">{result.success ? "Успешно загружено" : "Ошибка загрузки"}</p>
                {result.url && <p className="text-xs text-slate-600 truncate">{result.url}</p>}
                {result.error && <p className="text-xs text-red-600">{result.error}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
