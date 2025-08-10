"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Package,
  TrendingUp,
  Shield,
  Database,
  Bell,
  CheckCircle,
  Save,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface WarehouseSettings {
  // Общие настройки
  auto_reorder_enabled: boolean
  low_stock_threshold: number
  critical_stock_threshold: number
  default_warehouse_capacity: number

  // Уведомления
  email_notifications: boolean
  low_stock_alerts: boolean
  movement_notifications: boolean
  daily_reports: boolean

  // Автоматизация
  auto_zone_assignment: boolean
  auto_section_optimization: boolean
  batch_processing_enabled: boolean

  // Безопасность
  require_confirmation_for_deletion: boolean
  audit_trail_enabled: boolean
  user_activity_tracking: boolean

  // Производительность
  cache_analytics_minutes: number
  max_concurrent_operations: number
  enable_background_sync: boolean
}

export function WarehouseSettings() {
  const [settings, setSettings] = useState<WarehouseSettings>({
    auto_reorder_enabled: false,
    low_stock_threshold: 10,
    critical_stock_threshold: 5,
    default_warehouse_capacity: 1000,
    email_notifications: true,
    low_stock_alerts: true,
    movement_notifications: false,
    daily_reports: true,
    auto_zone_assignment: false,
    auto_section_optimization: false,
    batch_processing_enabled: true,
    require_confirmation_for_deletion: true,
    audit_trail_enabled: true,
    user_activity_tracking: true,
    cache_analytics_minutes: 15,
    max_concurrent_operations: 5,
    enable_background_sync: true
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/warehouse/settings')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setSettings({ ...settings, ...result.data })
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error)
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/warehouse/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('Настройки сохранены')
      } else {
        toast.error('Ошибка сохранения настроек')
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error)
      toast.error('Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  const handleSettingChange = (key: keyof WarehouseSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const resetToDefaults = () => {
    setSettings({
      auto_reorder_enabled: false,
      low_stock_threshold: 10,
      critical_stock_threshold: 5,
      default_warehouse_capacity: 1000,
      email_notifications: true,
      low_stock_alerts: true,
      movement_notifications: false,
      daily_reports: true,
      auto_zone_assignment: false,
      auto_section_optimization: false,
      batch_processing_enabled: true,
      require_confirmation_for_deletion: true,
      audit_trail_enabled: true,
      user_activity_tracking: true,
      cache_analytics_minutes: 15,
      max_concurrent_operations: 5,
      enable_background_sync: true
    })
    toast.success('Настройки сброшены к значениям по умолчанию')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-600">Загрузка настроек...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Настройки складской системы
          </h2>
          <p className="text-gray-600 mt-1">
            Конфигурация автоматизации, уведомлений и параметров работы системы
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Сбросить
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {/* Общие настройки */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Управление запасами
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold">Порог низкого остатка</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                value={settings.low_stock_threshold}
                onChange={(e) => handleSettingChange('low_stock_threshold', parseInt(e.target.value))}
                min="1"
                max="100"
              />
              <p className="text-xs text-gray-500">
                Количество товара, при котором отправляется предупреждение
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="critical_stock_threshold">Критический порог</Label>
              <Input
                id="critical_stock_threshold"
                type="number"
                value={settings.critical_stock_threshold}
                onChange={(e) => handleSettingChange('critical_stock_threshold', parseInt(e.target.value))}
                min="1"
                max="50"
              />
              <p className="text-xs text-gray-500">
                Критически низкий остаток - срочные алерты
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_capacity">Емкость склада по умолчанию</Label>
              <Input
                id="default_capacity"
                type="number"
                value={settings.default_warehouse_capacity}
                onChange={(e) => handleSettingChange('default_warehouse_capacity', parseInt(e.target.value))}
                min="100"
                max="100000"
              />
              <p className="text-xs text-gray-500">
                Стандартная вместимость для новых складов
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Автоматический перезаказ</Label>
                <p className="text-sm text-gray-500">
                  Автоматически создавать заказы при низких остатках
                </p>
              </div>
              <Switch
                checked={settings.auto_reorder_enabled}
                onCheckedChange={(checked) => handleSettingChange('auto_reorder_enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Уведомления */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email уведомления</Label>
                <p className="text-sm text-gray-500">
                  Отправлять уведомления на email администраторов
                </p>
              </div>
              <Switch
                checked={settings.email_notifications}
                onCheckedChange={(checked) => handleSettingChange('email_notifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Алерты о низких остатках</Label>
                <p className="text-sm text-gray-500">
                  Уведомления при достижении порога низкого остатка
                </p>
              </div>
              <Switch
                checked={settings.low_stock_alerts}
                onCheckedChange={(checked) => handleSettingChange('low_stock_alerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Уведомления о движении товаров</Label>
                <p className="text-sm text-gray-500">
                  Информировать о поступлениях и отгрузках
                </p>
              </div>
              <Switch
                checked={settings.movement_notifications}
                onCheckedChange={(checked) => handleSettingChange('movement_notifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Ежедневные отчеты</Label>
                <p className="text-sm text-gray-500">
                  Ежедневная сводка по складской деятельности
                </p>
              </div>
              <Switch
                checked={settings.daily_reports}
                onCheckedChange={(checked) => handleSettingChange('daily_reports', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Автоматизация */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Автоматизация
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Автоматическое назначение зон</Label>
                <p className="text-sm text-gray-500">
                  Автоматически размещать товары в оптимальных зонах
                </p>
              </div>
              <Switch
                checked={settings.auto_zone_assignment}
                onCheckedChange={(checked) => handleSettingChange('auto_zone_assignment', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Оптимизация секций</Label>
                <p className="text-sm text-gray-500">
                  Автоматическая реорганизация секций для эффективности
                </p>
              </div>
              <Switch
                checked={settings.auto_section_optimization}
                onCheckedChange={(checked) => handleSettingChange('auto_section_optimization', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Пакетная обработка</Label>
                <p className="text-sm text-gray-500">
                  Группировать операции для повышения производительности
                </p>
              </div>
              <Switch
                checked={settings.batch_processing_enabled}
                onCheckedChange={(checked) => handleSettingChange('batch_processing_enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Безопасность */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Безопасность и аудит
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Подтверждение удаления</Label>
                <p className="text-sm text-gray-500">
                  Требовать подтверждение для операций удаления
                </p>
              </div>
              <Switch
                checked={settings.require_confirmation_for_deletion}
                onCheckedChange={(checked) => handleSettingChange('require_confirmation_for_deletion', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Журнал аудита</Label>
                <p className="text-sm text-gray-500">
                  Ведение подробного журнала всех операций
                </p>
              </div>
              <Switch
                checked={settings.audit_trail_enabled}
                onCheckedChange={(checked) => handleSettingChange('audit_trail_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Отслеживание активности пользователей</Label>
                <p className="text-sm text-gray-500">
                  Логирование действий пользователей в системе
                </p>
              </div>
              <Switch
                checked={settings.user_activity_tracking}
                onCheckedChange={(checked) => handleSettingChange('user_activity_tracking', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Производительность */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Производительность
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cache_minutes">Кеширование аналитики (минуты)</Label>
              <Select
                value={settings.cache_analytics_minutes.toString()}
                onValueChange={(value) => handleSettingChange('cache_analytics_minutes', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 минут</SelectItem>
                  <SelectItem value="15">15 минут</SelectItem>
                  <SelectItem value="30">30 минут</SelectItem>
                  <SelectItem value="60">1 час</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Время хранения аналитических данных в кеше
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_operations">Максимум одновременных операций</Label>
              <Select
                value={settings.max_concurrent_operations.toString()}
                onValueChange={(value) => handleSettingChange('max_concurrent_operations', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 операции</SelectItem>
                  <SelectItem value="5">5 операций</SelectItem>
                  <SelectItem value="10">10 операций</SelectItem>
                  <SelectItem value="20">20 операций</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Ограничение параллельных операций для стабильности
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Фоновая синхронизация</Label>
                <p className="text-sm text-gray-500">
                  Автоматическое обновление данных в фоновом режиме
                </p>
              </div>
              <Switch
                checked={settings.enable_background_sync}
                onCheckedChange={(checked) => handleSettingChange('enable_background_sync', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статус настроек */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Статус системы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge variant={settings.email_notifications ? "default" : "secondary"}>
                Уведомления
              </Badge>
              <p className="text-xs text-gray-500 mt-1">
                {settings.email_notifications ? 'Включены' : 'Отключены'}
              </p>
            </div>
            <div className="text-center">
              <Badge variant={settings.audit_trail_enabled ? "default" : "secondary"}>
                Аудит
              </Badge>
              <p className="text-xs text-gray-500 mt-1">
                {settings.audit_trail_enabled ? 'Активен' : 'Неактивен'}
              </p>
            </div>
            <div className="text-center">
              <Badge variant={settings.auto_reorder_enabled ? "default" : "secondary"}>
                Автозаказ
              </Badge>
              <p className="text-xs text-gray-500 mt-1">
                {settings.auto_reorder_enabled ? 'Включен' : 'Отключен'}
              </p>
            </div>
            <div className="text-center">
              <Badge variant={settings.enable_background_sync ? "default" : "secondary"}>
                Синхронизация
              </Badge>
              <p className="text-xs text-gray-500 mt-1">
                {settings.enable_background_sync ? 'Активна' : 'Отключена'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}