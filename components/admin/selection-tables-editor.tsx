'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { UI_CONFIG } from '@/lib/app-config'
import {
  Plus,
  Trash2,
  Table2,
  PlusCircle,
  MinusCircle
} from 'lucide-react'
interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}
// Predefined table types
const PREDEFINED_TABLES = {
  weightActivityTable: {
    label: 'По весу и активности',
    defaultTitle: 'ТАБЛИЦА ПОДБОРА ПО ВЕСУ И АКТИВНОСТИ',
    defaultHeaders: ['Активность', '50-60', '60-75', '75-90', '90-105', '105-125'],
    defaultRows: [
      ['Низкая', '', '', '', '', ''],
      ['Средняя', '', '', '', '', ''],
      ['Высокая', '', '', '', '', '']
    ]
  },
  sizeStiffnessTable: {
    label: 'По размеру и жёсткости',
    defaultTitle: 'ТАБЛИЦА ПОДБОРА ПО РАЗМЕРУ И ЖЁСТКОСТИ',
    defaultHeaders: ['Размер', '1', '2', '3', '4', '5'],
    defaultRows: [
      ['22', '', '', '', '', ''],
      ['23', '', '', '', '', ''],
      ['24', '', '', '', '', '']
    ]
  }
} as const;
// Dynamic selection data - can contain any table types
interface ProductSelectionData {
  [key: string]: TableData;
}
interface SelectionTablesEditorProps {
  productId?: number;
  productSku?: string;
  productName?: string;
  onSave?: (data: ProductSelectionData) => void;
  isNewProduct?: boolean;
  onNewProductChange?: (data: ProductSelectionData) => void;
  onExistingProductChange?: (data: ProductSelectionData) => void;
  className?: string;
}
export function SelectionTablesEditor({
  productId,
  productSku = '',
  productName = '',
  onSave,
  isNewProduct = false,
  onNewProductChange,
  onExistingProductChange,
  className = ''
}: SelectionTablesEditorProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  // Selection tables data - now supports any table types
  const [selectionTables, setSelectionTables] = useState<ProductSelectionData>({})
  const selectionTablesRef = useRef<ProductSelectionData>({})

  // Обновляем ref при изменении состояния
  useEffect(() => {
    selectionTablesRef.current = selectionTables
  }, [selectionTables])
  // State for managing tabs and custom table creation
  const [activeTab, setActiveTab] = useState('weightActivityTable')
  const [isCreatingCustomTable, setIsCreatingCustomTable] = useState(false)
  const [customTableName, setCustomTableName] = useState('')
  // Get all table keys (predefined + custom)
  const allTableKeys = Object.keys(selectionTables)
  const predefinedKeys = Object.keys(PREDEFINED_TABLES)
  const customKeys = allTableKeys.filter(key => !predefinedKeys.includes(key))
  // Handle tab change with special handling for add custom tab
  const handleTabChange = (value: string) => {
    if (value === '__add_custom__') {
      setIsCreatingCustomTable(true);
      // Keep current tab active while creating
      return;
    }
    setActiveTab(value);
    setIsCreatingCustomTable(false);
    setCustomTableName('');
  }
  // Auto-set active tab to first available when tables change
  useEffect(() => {
    if (allTableKeys.length > 0 && !allTableKeys.includes(activeTab) && activeTab !== '__add_custom__') {
      setActiveTab(allTableKeys[0]);
    }
  }, [allTableKeys, activeTab]);
  // Load existing selection tables
  useEffect(() => {
    if (productId) {
      loadSelectionTables()
    } else {
      setIsLoading(false) // Stop loading if no productId
    }
  }, [productId])
  const loadSelectionTables = async () => {
    if (!productId) return
    try {
      setIsLoading(true)
      const response = await fetch(`/api/products/${productId}/selection-tables`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSelectionTables(data.data)
        } else {
          console.error('Failed to load selection tables')
        }
      } else {
        console.error('Failed to fetch selection tables')
      }
    } catch (_error) {
    } finally {
      setIsLoading(false)
    }
  }

  // Хелпер для отложенного уведомления об изменениях
  const scheduleChangeNotification = useCallback(() => {
    setTimeout(() => {
      // Получаем актуальное состояние selectionTables через ref
      const currentTables = selectionTablesRef.current

      if (isNewProduct && onNewProductChange) {

        onNewProductChange(currentTables)
      } else if (!isNewProduct && onExistingProductChange) {

        onExistingProductChange(currentTables)
      }
    }, UI_CONFIG.TIMEOUTS.STATE_UPDATE_DELAY)
  }, [isNewProduct, onNewProductChange, onExistingProductChange])
  const _saveSelectionTables = async () => {
    if (!productId) {
      toast({
        title: "Ошибка",
        description: "ID товара не указан",
        variant: "destructive",
      })
      return
    }
    // Check if there are any tables to save
    const tableCount = Object.keys(selectionTables).length
    if (tableCount === 0) {
      toast({
        title: "Информация",
        description: "Нет таблиц для сохранения. Создайте таблицу сначала.",
        variant: "default",
      })
      return
    }
    try {
      setIsLoading(true)
      const response = await fetch(`/api/products/${productId}/selection-tables`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: productSku,
          tables: selectionTables
        }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setHasChanges(false)
          const savedTablesCount = Object.keys(selectionTables).length
          const hasWeightTable = selectionTables.weightActivityTable ? 'по весу/активности' : null
          const hasSizeTable = selectionTables.sizeStiffnessTable ? 'по размеру/жёсткости' : null
          const tableTypes = [hasWeightTable, hasSizeTable].filter(Boolean).join(' и ')
          toast({
            title: "✅ Успешно сохранено",
            description: `Сохранено ${savedTablesCount} таблиц${savedTablesCount > 1 ? 'ы' : 'а'} подбора (${tableTypes})`,
          })
          if (onSave) {
            onSave(selectionTables)
          }
        } else {
          throw new Error(data.error || 'Failed to save')
        }
      } else {
        throw new Error(`Server error: ${response.status}`)
      }
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        description: `Не удалось сохранить таблицы подбора: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }
  const createEmptyTable = (type: string): TableData => {
    // Check if it's a predefined table type
    if (type in PREDEFINED_TABLES) {
      const config = PREDEFINED_TABLES[type as keyof typeof PREDEFINED_TABLES];
      return {
        title: config.defaultTitle,
        headers: [...config.defaultHeaders],
        rows: config.defaultRows.map(row => [...row])
      };
    }
    // For custom tables, create a basic template
    return {
      title: `ТАБЛИЦА ПОДБОРА - ${type.toUpperCase()}`,
      headers: ['Параметр', 'Значение 1', 'Значение 2', 'Значение 3'],
      rows: [
        ['Вариант 1', '', '', ''],
        ['Вариант 2', '', '', ''],
        ['Вариант 3', '', '', '']
      ]
    };
  }
  // Create custom table with user-defined name
  const createCustomTable = () => {
    if (!customTableName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название таблицы",
        variant: "destructive",
      });
      return;
    }
    // Generate unique key from name
    const tableKey = customTableName
      .toLowerCase()
      .replace(/[^a-zа-я0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (selectionTables[tableKey]) {
      toast({
        title: "Ошибка",
        description: "Таблица с таким названием уже существует",
        variant: "destructive",
      });
      return;
    }
    const newTable = createEmptyTable(customTableName);
    setSelectionTables(prev => ({
      ...prev,
      [tableKey]: newTable
    }));
    setHasChanges(true);
    setActiveTab(tableKey);
    setIsCreatingCustomTable(false);
    setCustomTableName('');
    // Notify parent of changes
    scheduleChangeNotification()
    toast({
      title: "✅ Таблица создана",
      description: `Создана новая таблица: ${customTableName}`,
    });
  }
  const addTable = (type: string) => {
    setSelectionTables(prev => ({
      ...prev,
      [type]: createEmptyTable(type)
    }))
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const removeTable = (type: string) => {

    setSelectionTables(prev => {
      const updated = { ...prev }
      delete updated[type]

      return updated
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const updateTableTitle = (type: string, _title: string) => {
    setSelectionTables(prev => ({
      ...prev,
      [type]: prev[type] ? { ...prev[type], title } : createEmptyTable(type)
    }))
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const _updateTableHeaders = (type: string, _headers: string[]) => {
    setSelectionTables(prev => ({
      ...prev,
      [type]: prev[type] ? { ...prev[type], headers } : createEmptyTable(type)
    }))
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const _updateTableRows = (type: string, _rows: string[][]) => {
    setSelectionTables(prev => ({
      ...prev,
      [type]: prev[type] ? { ...prev[type], rows } : createEmptyTable(type)
    }))
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const addColumn = (type: string) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table) return prev
      const newHeaders = [...table.headers, '']
      const newRows = table.rows.map(row => [...row, ''])
      return {
        ...prev,
        [type]: { ...table, headers: newHeaders, rows: newRows }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const removeColumn = (type: string, columnIndex: number) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table || columnIndex === 0) return prev // Prevent removing first column
      const newHeaders = table.headers.filter((_, index) => index !== columnIndex)
      const newRows = table.rows.map(row => row.filter((_, index) => index !== columnIndex))
      return {
        ...prev,
        [type]: { ...table, headers: newHeaders, rows: newRows }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const addRow = (type: string) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table) return prev
      const newRow = new Array(table.headers.length).fill('')
      return {
        ...prev,
        [type]: { ...table, rows: [...table.rows, newRow] }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const removeRow = (type: string, rowIndex: number) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table || table.rows.length <= 1) return prev // Keep at least one row
      const newRows = table.rows.filter((_, index) => index !== rowIndex)
      return {
        ...prev,
        [type]: { ...table, rows: newRows }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const updateCell = (type: string, rowIndex: number, columnIndex: number, value: string) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table) return prev
      const newRows = table.rows.map((row, rIndex) =>
        rIndex === rowIndex
          ? row.map((cell, cIndex) => cIndex === columnIndex ? value : cell)
          : row
      )
      return {
        ...prev,
        [type]: { ...table, rows: newRows }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const updateHeader = (type: string, columnIndex: number, value: string) => {
    setSelectionTables(prev => {
      const table = prev[type]
      if (!table) return prev
      const newHeaders = table.headers.map((header, index) =>
        index === columnIndex ? value : header
      )
      return {
        ...prev,
        [type]: { ...table, headers: newHeaders }
      }
    })
    setHasChanges(true)
    // Notify parent of changes
    scheduleChangeNotification()
  }
  const renderTableEditor = (type: string, typeLabel: string) => {
    const table = selectionTables[type]
    if (!table) {
      return (
        <div className="text-center py-8">
          <Table2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Таблица не создана</p>
          <Button onClick={() => addTable(type)} variant="outline" className="h-10 px-4">
            <Plus className="w-4 h-4 mr-2" />
            Создать {typeLabel.toLowerCase()}
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Table title */}
        <div>
          <Label htmlFor={`${type}-title`} className="text-sm font-medium">Название таблицы</Label>
          <Input
            id={`${type}-title`}
            value={table.title}
            onChange={(e) => updateTableTitle(type, e.target.value)}
            placeholder="Введите название таблицы"
            className="h-10 sm:h-9 mt-1"
          />
        </div>

        {/* Table data */}
        <div className="border rounded-lg p-3 sm:p-4 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h4 className="font-medium text-sm sm:text-base">Данные таблицы</h4>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addColumn(type)} className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm">
                <PlusCircle className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Столбец</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => addRow(type)} className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm">
                <PlusCircle className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Строка</span>
              </Button>
              <Button size="sm" variant="destructive" onClick={() => removeTable(type)} className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm">
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Удалить</span>
              </Button>
            </div>
          </div>

          {/* Mobile-first responsive table */}
          <div className="block sm:hidden">
            {/* Mobile card-based layout */}
            <div className="space-y-4">
              {/* Headers management */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="font-medium text-sm mb-3">Заголовки столбцов</h5>
                <div className="space-y-2">
                  {table.headers.map((header, columnIndex) => (
                    <div key={columnIndex} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-8 flex-shrink-0">#{columnIndex + 1}</span>
                      <Input
                        value={header}
                        onChange={(e) => updateHeader(type, columnIndex, e.target.value)}
                        className="text-sm h-9"
                        placeholder={`Столбец ${columnIndex + 1}`}
                      />
                      {columnIndex > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeColumn(type, columnIndex)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows management */}
              {table.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="bg-white rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-sm">Строка {rowIndex + 1}</h5>
                    {table.rows.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(type, rowIndex)}
                        className="h-8 w-8 p-0 text-red-600"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {row.map((cell, columnIndex) => (
                      <div key={columnIndex}>
                        <Label className="text-xs text-gray-600 mb-1 block">
                          {table.headers[columnIndex] || `Столбец ${columnIndex + 1}`}
                        </Label>
                        <Input
                          value={cell}
                          onChange={(e) => updateCell(type, rowIndex, columnIndex, e.target.value)}
                          className={`h-9 text-sm ${columnIndex === 0 ? 'font-semibold' : ''}`}
                          placeholder={columnIndex === 0 ? 'Параметр' : 'Значение'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-gray-50">
                  {table.headers.map((header, columnIndex) => (
                    <th key={columnIndex} className="border border-gray-200 p-2 min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <Input
                          value={header}
                          onChange={(e) => updateHeader(type, columnIndex, e.target.value)}
                          className="text-center font-semibold text-sm h-8"
                          placeholder={`Столбец ${columnIndex + 1}`}
                        />
                        {columnIndex > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeColumn(type, columnIndex)}
                            className="p-1 h-6 w-6 hover:bg-gray-100 flex-shrink-0"
                          >
                            <MinusCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50 transition-colors duration-200`}>
                    {row.map((cell, columnIndex) => (
                      <td key={columnIndex} className="border border-gray-200 p-1">
                        <div className="flex items-center gap-1">
                          <Input
                            value={cell}
                            onChange={(e) => updateCell(type, rowIndex, columnIndex, e.target.value)}
                            className={`text-center text-sm h-8 ${columnIndex === 0 ? 'font-semibold' : ''}`}
                            placeholder={columnIndex === 0 ? 'Параметр' : 'Значение'}
                          />
                          {columnIndex === 0 && table.rows.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeRow(type, rowIndex)}
                              className="p-1 h-6 w-6 hover:bg-gray-100 flex-shrink-0"
                            >
                              <MinusCircle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5 flex-shrink-0" />
              Таблицы подбора
            </CardTitle>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isNewProduct && Object.keys(selectionTables).length > 0 && (
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                Готово к сохранению
              </Badge>
            )}
            {!isNewProduct && hasChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Есть изменения
              </Badge>
            )}
            {!isNewProduct && !hasChanges && Object.keys(selectionTables).length > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Сохранено
              </Badge>
            )}
            {/* Removed Save button for batch saving: Tables will be saved when main form is submitted */}
            {/*
            {!isNewProduct && (
              <Button
                onClick={() => {
                  );
                  saveSelectionTables();
                }}
                disabled={isLoading || (Object.keys(selectionTables).length === 0)}
                size="sm"
                variant={hasChanges ? "default" : "outline"}
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Сохранение...' : hasChanges ? 'Сохранить изменения' : 'Сохранить'}
              </Button>
            )}
            */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            <span className="ml-3 text-gray-600">Загрузка таблиц подбора...</span>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              {allTableKeys.length > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex-1 overflow-x-auto">
                      <TabsList className="inline-flex h-auto p-1 gap-1 min-w-max w-full sm:w-auto">
                        {/* Predefined tables */}
                        {predefinedKeys.map(key => (
                          <TabsTrigger key={key} value={key} className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap flex-1 sm:flex-initial">
                            <span className="truncate">
                              {PREDEFINED_TABLES[key as keyof typeof PREDEFINED_TABLES].label}
                            </span>
                            {selectionTables[key] && (
                              <Badge variant="secondary" className="ml-1 text-xs">✓</Badge>
                            )}
                          </TabsTrigger>
                        ))}
                        {/* Custom tables */}
                        {customKeys.map(key => (
                          <TabsTrigger key={key} value={key} className="text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap flex-1 sm:flex-initial">
                            <span className="truncate max-w-16 sm:max-w-20" title={selectionTables[key]?.title || key}>
                              {selectionTables[key]?.title?.replace('ТАБЛИЦА ПОДБОРА - ', '').replace('ТАБЛИЦА ПОДБОРА', '') || key}
                            </span>
                            <Badge variant="secondary" className="ml-1 text-xs">✓</Badge>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    {/* Add table buttons - responsive */}
                    <div className="flex-shrink-0 flex flex-wrap gap-2">
                      {/* Show buttons for missing predefined tables */}
                      {Object.keys(PREDEFINED_TABLES).map(key => {
                        if (!selectionTables[key]) {
                          const config = PREDEFINED_TABLES[key as keyof typeof PREDEFINED_TABLES];
                          return (
                            <Button
                              key={key}
                              size="sm"
                              variant="outline"
                              onClick={() => addTable(key)}
                              className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                              title={`Создать ${config.label.toLowerCase()}`}
                            >
                              <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden lg:inline">{config.label}</span>
                              <span className="lg:hidden">+{config.label.split(' ')[0]}</span>
                            </Button>
                          );
                        }
                        return null;
                      })}

                      {/* Custom table button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsCreatingCustomTable(true)}
                        disabled={isCreatingCustomTable}
                        className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Кастомная</span>
                        <span className="sm:hidden">+</span>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Table2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Нет созданных таблиц подбора</p>
                  <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 max-w-2xl mx-auto">
                    <Button
                      onClick={() => addTable('weightActivityTable')}
                      variant="outline"
                      className="h-10 px-4 text-sm"
                    >
                      <span className="hidden sm:inline">Создать таблицу по весу и активности</span>
                      <span className="sm:hidden">По весу и активности</span>
                    </Button>
                    <Button
                      onClick={() => addTable('sizeStiffnessTable')}
                      variant="outline"
                      className="h-10 px-4 text-sm"
                    >
                      <span className="hidden sm:inline">Создать таблицу по размеру и жёсткости</span>
                      <span className="sm:hidden">По размеру и жёсткости</span>
                    </Button>
                    <Button
                      onClick={() => setIsCreatingCustomTable(true)}
                      variant="outline"
                      className="h-10 px-4 text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Создать кастомную таблицу</span>
                      <span className="sm:hidden">Кастомная таблица</span>
                    </Button>
                  </div>
                </div>
              )}
              {/* Custom table creation dialog */}
              {isCreatingCustomTable && (
                <div className="mb-4 p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <h4 className="font-medium mb-3 text-sm sm:text-base">Создать новую таблицу подбора</h4>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      value={customTableName}
                      onChange={(e) => setCustomTableName(e.target.value)}
                      placeholder="Название таблицы (например: По возрасту, По размеру стопы)"
                      className="flex-1 h-10 sm:h-9 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          createCustomTable();
                        }
                        if (e.key === 'Escape') {
                          setIsCreatingCustomTable(false);
                          setCustomTableName('');
                        }
                      }}
                    />
                    <div className="flex gap-2 sm:gap-3">
                      <Button
                        onClick={createCustomTable}
                        disabled={!customTableName.trim()}
                        className="h-10 px-4 text-sm sm:h-9 flex-1 sm:flex-initial"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Создать</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCreatingCustomTable(false);
                          setCustomTableName('');
                        }}
                        className="h-10 px-4 text-sm sm:h-9 flex-1 sm:flex-initial"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {/* Tab contents for predefined tables */}
              {predefinedKeys.map(key => (
                <TabsContent key={key} value={key} className="space-y-4">
                  {renderTableEditor(key, PREDEFINED_TABLES[key as keyof typeof PREDEFINED_TABLES].label)}
                </TabsContent>
              ))}
              {/* Tab contents for custom tables */}
              {customKeys.map(key => (
                <TabsContent key={key} value={key} className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">
                      {selectionTables[key]?.title || key}
                    </h3>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        removeTable(key);
                        // Switch to first available tab after removal
                        const remainingKeys = allTableKeys.filter(k => k !== key);
                        if (remainingKeys.length > 0) {
                          setActiveTab(remainingKeys[0]);
                        } else {
                          setActiveTab('weightActivityTable');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Удалить таблицу
                    </Button>
                  </div>
                  {renderTableEditor(key, selectionTables[key]?.title || key)}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  )
}