"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface DataReadyState {
  isLoading: boolean
  isInitializing: boolean
  specGroupsLoaded: boolean
  characteristicsLoaded: boolean
  canOperate: boolean
}

interface DataReadyIndicatorProps {
  dataReadyState: DataReadyState
  error?: string | null
  onRetry?: () => void
  className?: string
}

export function DataReadyIndicator({
  dataReadyState,
  error,
  onRetry,
  className = ""
}: DataReadyIndicatorProps) {
  const {
    isLoading,
    isInitializing,
    specGroupsLoaded,
    characteristicsLoaded,
    canOperate
  } = dataReadyState

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <XCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-4"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Повторить
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Loading state
  if (isLoading || isInitializing) {
    return (
      <Alert className={`${className} border-blue-200 bg-blue-50`}>
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <span className="font-medium">
                {isInitializing ? 'Инициализация данных...' : 'Загрузка данных...'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {specGroupsLoaded ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                )}
                <span className={specGroupsLoaded ? 'text-green-700' : 'text-blue-600'}>
                  Группы характеристик
                </span>
              </div>

              <div className="flex items-center gap-2">
                {characteristicsLoaded ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                )}
                <span className={characteristicsLoaded ? 'text-green-700' : 'text-blue-600'}>
                  Характеристики товара
                </span>
              </div>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Ready state
  if (canOperate) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span>Данные загружены и готовы к работе</span>
      </div>
    )
  }

  // Fallback - partial state
  return (
    <Alert variant="default" className={className}>
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription>
        <div className="space-y-2">
          <div className="text-amber-700 font-medium">
            Частичная загрузка данных
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {specGroupsLoaded ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : (
                <XCircle className="w-3 h-3 text-red-600" />
              )}
              <span className={specGroupsLoaded ? 'text-green-700' : 'text-red-600'}>
                Группы характеристик
              </span>
            </div>

            <div className="flex items-center gap-2">
              {characteristicsLoaded ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : (
                <XCircle className="w-3 h-3 text-red-600" />
              )}
              <span className={characteristicsLoaded ? 'text-green-700' : 'text-red-600'}>
                Характеристики товара
              </span>
            </div>
          </div>

          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Перезагрузить
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Compact version for use in headers/badges
export function DataReadyBadge({ dataReadyState }: { dataReadyState: DataReadyState }) {
  const { isLoading, isInitializing, canOperate } = dataReadyState

  if (isLoading || isInitializing) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Загрузка...
      </Badge>
    )
  }

  if (canOperate) {
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Готово
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />
      Ошибка
    </Badge>
  )
}