'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Activity,
  Database,
  Trash2,
  Search,
  Clock,
  Key,
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'

interface RedisStats {
  success: boolean
  redis: {
    connected: boolean
    connection_status: {
      connected: boolean
      attempts: number
    }
    response_time_ms: number
  }
  cache_stats: {
    total_keys: number
    by_prefix: {
      [key: string]: {
        keys: string[]
        count: number
      }
    }
    ttl_samples: {
      [key: string]: number
    }
  }
  operations: string[]
}

export default function RedisMonitorPage() {
  const [stats, setStats] = useState<RedisStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [operationLoading, setOperationLoading] = useState(false)

  // Form states
  const [cacheType, setCacheType] = useState('api')
  const [key, setKey] = useState('')
  const [data, setData] = useState('')
  const [ttl, setTtl] = useState('300')
  const [pattern, setPattern] = useState('')
  const [operationResult, setOperationResult] = useState<any>(null)
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const { toast } = useToast()

  const fetchRedisStats = useCallback(async () => {
      try {
        const response = await fetch('/api/redis-status')
        const data = await response.json()

        if (data.success) {
          setStats(data)
          setLastUpdate(new Date())
        } else {
          toast({
            title: "Ошибка",
            description: data.error || "Не удалось получить статус Redis",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('Error fetching Redis stats:', error)
        if (loading || refreshing) { // Показываем toast только при ручном обновлении
          toast({
            title: "Ошибка подключения",
            description: "Не удалось связаться с Redis сервером",
            variant: "destructive"
          })
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    }, [autoUpdateEnabled])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchRedisStats()
  }

  const handleFlushCache = async (cacheType?: string, pattern?: string) => {
    setOperationLoading(true)
    try {
      let url = '/api/redis-status'
      if (cacheType) {
        url += `?cache_type=${cacheType}`
      }
      if (pattern) {
        url += `${cacheType ? '&' : '?'}pattern=${pattern}`
      }

      const response = await fetch(url, { method: 'DELETE' })
      const result = await response.json()

      setOperationResult(result)

      if (result.success) {
        toast({
          title: "Кеш очищен",
          description: `Удалено ${result.deleted_keys} ключей`,
          variant: "default"
        })
        await fetchRedisStats()
      } else {
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (_error) {
      toast({
        title: "Ошибка",
        description: "Не удалось очистить кеш",
        variant: "destructive"
      })
    } finally {
      setOperationLoading(false)
    }
  }

  const handleSetCache = async () => {
    if (!key || !data) {
      toast({
        title: "Ошибка",
        description: "Укажите ключ и данные",
        variant: "destructive"
      })
      return
    }

    setOperationLoading(true)
    try {
      const response = await fetch('/api/redis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          cache_type: cacheType,
          key,
          data: JSON.parse(data),
          ttl: parseInt(ttl)
        })
      })

      const result = await response.json()
      setOperationResult(result)

      if (result.success) {
        toast({
          title: "Кеш установлен",
          description: `Ключ ${key} сохранен на ${ttl} секунд`,
          variant: "default"
        })
        await fetchRedisStats()
      } else {
        toast({
          title: "Ошибка",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (_error) {
      toast({
        title: "Ошибка",
        description: "Неверный JSON или ошибка сохранения",
        variant: "destructive"
      })
    } finally {
      setOperationLoading(false)
    }
  }

  const handleGetCache = async () => {
    if (!key) {
      toast({
        title: "Ошибка",
        description: "Укажите ключ",
        variant: "destructive"
      })
      return
    }

    setOperationLoading(true)
    try {
      const response = await fetch('/api/redis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get',
          cache_type: cacheType,
          key
        })
      })

      const result = await response.json()
      setOperationResult(result)

      if (result.success && result.exists) {
        setData(JSON.stringify(result.data, null, 2))
        toast({
          title: "Данные получены",
          description: `Ключ ${key} найден в кеше`,
          variant: "default"
        })
      } else if (result.success && !result.exists) {
        toast({
          title: "Ключ не найден",
          description: `Ключ ${key} отсутствует в кеше`,
          variant: "destructive"
        })
      }
    } catch (_error) {
      toast({
        title: "Ошибка",
        description: "Не удалось получить данные",
        variant: "destructive"
      })
    } finally {
      setOperationLoading(false)
    }
  }

  const handlePing = async () => {
    setOperationLoading(true)
    try {
      const response = await fetch('/api/redis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' })
      })

      const result = await response.json()
      setOperationResult(result)

      if (result.success && result.result) {
        toast({
          title: "Подключение активно",
          description: "Redis сервер отвечает на ping",
          variant: "default"
        })
      } else {
        toast({
          title: "Нет подключения",
          description: "Redis сервер не отвечает",
          variant: "destructive"
        })
      }
    } catch (_error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить ping",
        variant: "destructive"
      })
    } finally {
      setOperationLoading(false)
    }
  }

  useEffect(() => {
    // Инициальная загрузка
    fetchRedisStats()

    // Автообновление каждые 5 секунд
    let interval: NodeJS.Timeout | null = null

    if (autoUpdateEnabled) {
      interval = setInterval(() => {
        fetchRedisStats()
      }, 5000)
    }

    // Очистка интервала при размонтировании или изменении autoUpdateEnabled
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [fetchRedisStats])

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Загрузка статуса Redis...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const formatTTL = (ttl: number) => {
    if (ttl === -1) return 'Бессрочно'
    if (ttl === -2) return 'Не существует'
    if (ttl < 60) return `${ttl}с`
    if (ttl < 3600) return `${Math.floor(ttl / 60)}м ${ttl % 60}с`
    return `${Math.floor(ttl / 3600)}ч ${Math.floor((ttl % 3600) / 60)}м`
  }

  return (
    <AdminLayout>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            Redis Monitor
          </h1>
          <p className="text-muted-foreground">
            Мониторинг состояния Redis и управление кешированием
            {lastUpdate && (
              <span className="ml-2 text-xs">
                • Обновлено: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
            variant={autoUpdateEnabled ? "default" : "outline"}
            size="sm"
          >
            <Clock className={`h-4 w-4 mr-2 ${autoUpdateEnabled ? 'animate-pulse' : ''}`} />
            {autoUpdateEnabled ? 'Авто: ВКЛ' : 'Авто: ВЫКЛ'}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Connection Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Подключение</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {stats.redis.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-slate-400" />
                )}
                <Badge variant={stats.redis.connected ? "default" : "secondary"}>
                  {stats.redis.connected ? "Подключен" : "Отключен"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Время ответа: {stats.redis.response_time_ms}мс
              </p>
              <p className="text-xs text-muted-foreground">
                Попытки: {stats.redis.connection_status.attempts}
              </p>
            </CardContent>
          </Card>

          {/* Total Keys */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего ключей</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cache_stats.total_keys}</div>
              <p className="text-xs text-muted-foreground">
                Активных записей в кеше
              </p>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Производительность</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.redis.response_time_ms}мс</div>
              <p className="text-xs text-muted-foreground">
                Время отклика Redis
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="operations">Операции</TabsTrigger>
          <TabsTrigger value="management">Управление</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cache Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Распределение кеша
                  </CardTitle>
                  <CardDescription>
                    Количество ключей по типам кеша
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.cache_stats.by_prefix).map(([prefix, info]) => (
                      <div key={prefix} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{prefix}</Badge>
                          <span className="text-sm">{info.count} ключей</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            TTL: {formatTTL(stats.cache_stats.ttl_samples[prefix] ?? 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Быстрые действия
                  </CardTitle>
                  <CardDescription>
                    Основные операции с кешем
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handlePing}
                    disabled={operationLoading}
                    variant="outline"
                    className="w-full"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Проверить подключение (PING)
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(stats.cache_stats.by_prefix).map(prefix => (
                      <Button
                        key={prefix}
                        onClick={() => handleFlushCache(prefix)}
                        disabled={operationLoading}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Очистить {prefix}
                      </Button>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleFlushCache('all')}
                    disabled={operationLoading}
                    variant="outline"
                    className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Очистить весь кеш
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Set Cache */}
            <Card>
              <CardHeader>
                <CardTitle>Установить данные в кеш</CardTitle>
                <CardDescription>
                  Сохранить данные в Redis с указанным TTL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cache-type">Тип кеша</Label>
                    <Select value={cacheType} onValueChange={setCacheType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="page">Page</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ttl">TTL (секунды)</Label>
                    <Input
                      id="ttl"
                      value={ttl}
                      onChange={(e) => setTtl(e.target.value)}
                      placeholder="300"
                      type="number"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="key">Ключ</Label>
                  <Input
                    id="key"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="test-key"
                  />
                </div>

                <div>
                  <Label htmlFor="data">Данные (JSON)</Label>
                  <Textarea
                    id="data"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={6}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={handleSetCache}
                    disabled={operationLoading}
                    className="flex-1"
                  >
                    Установить
                  </Button>
                  <Button
                    onClick={handleGetCache}
                    disabled={operationLoading}
                    variant="outline"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Получить
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Operation Result */}
            <Card>
              <CardHeader>
                <CardTitle>Результат операции</CardTitle>
                <CardDescription>
                  Последний результат выполненной операции
                </CardDescription>
              </CardHeader>
              <CardContent>
                {operationResult ? (
                  <div className="space-y-2">
                    <Badge
                      variant={operationResult.success ? "default" : "secondary"}
                    >
                      {operationResult.success ? "Успешно" : "Ошибка"}
                    </Badge>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                      {JSON.stringify(operationResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Результаты операций появятся здесь
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Расширенное управление кешем</CardTitle>
              <CardDescription>
                Операции очистки кеша по паттернам и типам
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pattern">Паттерн для очистки</Label>
                <Input
                  id="pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="api:products-*"
                />
              </div>

              <Button
                onClick={() => handleFlushCache(undefined, pattern)}
                disabled={operationLoading || !pattern}
                variant="outline"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Очистить по паттерну
              </Button>

              {stats && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Активные ключи:</h4>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {Object.entries(stats.cache_stats.by_prefix).map(([prefix, info]) => (
                      <div key={prefix} className="border-l-4 border-blue-500 pl-3">
                        <div className="font-medium text-sm">{prefix}</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {info.keys.slice(0, 5).map(key => (
                            <div key={key} className="font-mono">{key}</div>
                          ))}
                          {info.keys.length > 5 && (
                            <div className="text-xs">...и еще {info.keys.length - 5} ключей</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AdminLayout>
  )
}