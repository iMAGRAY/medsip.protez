'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, RefreshCw, Database } from 'lucide-react'

export default function SetupTemplatesPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'unknown' | 'exists' | 'missing'>('unknown')
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [message, setMessage] = useState('')

  const checkTableStatus = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/form-templates/setup')
      const data = await response.json()

      if (data.success) {
        setStatus('exists')
        setTableInfo(data.data)
        setMessage(data.message)
      } else {
        setStatus('missing')
        setMessage(data.message)
      }
    } catch (error) {
      setStatus('missing')
      setMessage('Ошибка при проверке таблицы')
    } finally {
      setIsLoading(false)
    }
  }

  const createTable = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/form-templates/setup', {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        setStatus('exists')
        setTableInfo(data.data)
        setMessage(data.message)
      } else {
        setMessage(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      setMessage('Ошибка при создании таблицы')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkTableStatus()
  }, [])

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Настройка таблицы шаблонов</h1>
        <p className="text-slate-600">Управление таблицей form_templates в базе данных</p>
      </div>

      <div className="grid gap-6">
        {/* Статус таблицы */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Состояние таблицы form_templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                {status === 'exists' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {status === 'missing' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {status === 'unknown' && <RefreshCw className="w-5 h-5 text-gray-500" />}

                <Badge variant={status === 'exists' ? 'default' : status === 'missing' ? 'destructive' : 'secondary'}>
                  {status === 'exists' ? 'Существует' : status === 'missing' ? 'Не найдена' : 'Проверяется...'}
                </Badge>
              </div>

              <Button
                onClick={checkTableStatus}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Обновить
              </Button>
            </div>

            {message && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
                {message}
              </div>
            )}

            {tableInfo && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Количество записей:</span>
                    <span className="ml-2 text-lg font-semibold">{tableInfo.count}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Структура:</span>
                    <span className="ml-2 text-lg font-semibold">{tableInfo.structure?.length || 0} столбцов</span>
                  </div>
                </div>

                {tableInfo.structure && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Структура таблицы:</h4>
                    <div className="space-y-1">
                      {tableInfo.structure.map((column: any, index: number) => (
                        <div key={index} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-b-0">
                          <span className="font-mono text-sm">{column.column_name}</span>
                          <span className="text-xs text-slate-500">{column.data_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Действия */}
        <Card>
          <CardHeader>
            <CardTitle>Действия</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {status === 'missing' && (
                <div>
                  <Button
                    onClick={createTable}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Database className="w-4 h-4 mr-2" />
                    )}
                    Создать таблицу form_templates
                  </Button>
                  <p className="text-sm text-slate-600 mt-2">
                    Создаст таблицу с необходимой структурой, индексами и тестовыми данными
                  </p>
                </div>
              )}

              {status === 'exists' && (
                <div className="text-center text-green-600">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-medium">Таблица настроена и готова к использованию!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Информация */}
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-slate-600">
              <p>• Таблица form_templates используется для хранения шаблонов характеристик</p>
              <p>• Характеристики сохраняются в формате JSONB для гибкости</p>
              <p>• Автоматически создаются индексы для оптимизации производительности</p>
              <p>• Включены тестовые данные для проверки функциональности</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}