"use client"

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  MapPin,
  Warehouse,
  Package2,
  Grid3x3,
  Building2,
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Copy,
  Move,
  Eye,
  TrendingUp,
  AlertCircle,
  Navigation,
  Target
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Интерфейсы для данных
interface TreeNode {
  id: string
  type: 'region' | 'city' | 'warehouse' | 'zone' | 'section'
  name: string
  code?: string
  description?: string
  status: 'active' | 'inactive' | 'maintenance'
  children: TreeNode[]
  data: any
  // Метрики для отображения
  metrics?: {
    capacity?: number
    used?: number
    efficiency?: number
    items_count?: number
    alerts?: number
  }
}

interface ContextPanelData {
  node: TreeNode | null
  breadcrumb: TreeNode[]
}

interface WarehouseTreeManagerProps {
  data: TreeNode[]
  onNodeSelect: (node: TreeNode | null) => void
  onNodeCreate: (parentId: string, type: string) => void
  onNodeEdit: (node: TreeNode) => void
  onNodeDelete: (node: TreeNode) => void
  onNodeMove: (nodeId: string, newParentId: string) => void
  loading?: boolean
}

export const WarehouseTreeManager: React.FC<WarehouseTreeManagerProps> = ({
  data,
  onNodeSelect,
  onNodeCreate,
  onNodeEdit,
  onNodeDelete,
  onNodeMove,
  loading = false
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [contextPanel, setContextPanel] = useState<ContextPanelData>({ node: null, breadcrumb: [] })

  // Ref для доступа к актуальным данным без зависимости в useCallback
  const dataRef = useRef(data)
  dataRef.current = data

  // Функция для получения иконки по типу узла
  const getNodeIcon = (type: string, status: string) => {
    // Определяем цвет по типу узла, как в блоках метрик сверху страницы
    let colorClass = 'text-gray-600'

    if (status === 'inactive') {
      colorClass = 'text-gray-400'
    } else if (status === 'maintenance') {
      colorClass = 'text-yellow-600'
    } else {
      // Цвета для активных узлов соответствуют блокам метрик
      switch (type) {
        case 'region':
          colorClass = 'text-blue-600'
          break
        case 'city':
          colorClass = 'text-green-600'
          break
        case 'warehouse':
          colorClass = 'text-purple-600'
          break
        case 'zone':
          colorClass = 'text-orange-600'
          break
        case 'section':
          colorClass = 'text-indigo-600'
          break
        default:
          colorClass = 'text-gray-600'
      }
    }

    const iconProps = { className: `w-4 h-4 ${colorClass}` }

    switch (type) {
      case 'region': return <MapPin {...iconProps} />
      case 'city': return <Building2 {...iconProps} />
      case 'warehouse': return <Warehouse {...iconProps} />
      case 'zone': return <Package2 {...iconProps} />
      case 'section': return <Grid3x3 {...iconProps} />
      default: return <Package2 {...iconProps} />
    }
  }

  // Функция для получения цвета типа узла (соответствует блокам метрик)
  const getNodeTypeColor = (type: string, status: string) => {
    if (status === 'inactive') return 'text-gray-400'
    if (status === 'maintenance') return 'text-yellow-600'

    switch (type) {
      case 'region': return 'text-blue-600'
      case 'city': return 'text-green-600'
      case 'warehouse': return 'text-purple-600'
      case 'zone': return 'text-orange-600'
      case 'section': return 'text-indigo-600'
      default: return 'text-gray-600'
    }
  }

  // Функция для получения типа узла на русском
  const getNodeTypeLabel = (type: string) => {
    const labels = {
      region: 'Регион',
      city: 'Город',
      warehouse: 'Склад',
      zone: 'Зона',
      section: 'Секция'
    }
    return labels[type as keyof typeof labels] || type
  }

  // Функция для получения Badge цвета типа узла
  const getNodeTypeBadgeColor = (type: string, status: string) => {
    if (status === 'inactive') return 'bg-gray-100 text-gray-500 border-gray-200'
    if (status === 'maintenance') return 'bg-yellow-100 text-yellow-700 border-yellow-200'

    switch (type) {
      case 'region': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'city': return 'bg-green-100 text-green-700 border-green-200'
      case 'warehouse': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'zone': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'section': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  // Функция для переключения раскрытия узла
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  // Функция для выбора узла
  const selectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node)
    onNodeSelect(node)

    // Обновляем контекстную панель с breadcrumb
    const breadcrumb: TreeNode[] = []
    const findParentPath = (nodes: TreeNode[], targetId: string, path: TreeNode[] = []): boolean => {
      for (const n of nodes) {
        const newPath = [...path, n]
        if (n.id === targetId) {
          breadcrumb.push(...newPath)
          return true
        }
        if (n.children && findParentPath(n.children, targetId, newPath)) {
          return true
        }
      }
      return false
    }

    // Используем dataRef.current для получения актуальных данных
    findParentPath(dataRef.current, node.id)
    setContextPanel({ node, breadcrumb })
  }, [onNodeSelect])

  // Фильтрация данных по поиску и статусу
  const filteredData = useMemo(() => {
    const filterTree = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.filter(node => {
        // Фильтр по статусу
        if (filterStatus !== 'all' && node.status !== filterStatus) {
          return false
        }

        // Фильтр по поиску
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          return (
            node.name.toLowerCase().includes(query) ||
            node.code?.toLowerCase().includes(query) ||
            node.description?.toLowerCase().includes(query)
          )
        }

        return true
      }).map(node => ({
        ...node,
        children: filterTree(node.children)
      }))
    }

    return filterTree(data)
  }, [data, searchQuery, filterStatus])

  // Компонент узла дерева
  const TreeNodeComponent: React.FC<{ node: TreeNode; level: number }> = ({ node, level }) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id

    return (
      <div className="select-none">
        <div
          className={`
            flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all
            hover:bg-gray-50 dark:hover:bg-gray-800
            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''}
          `}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => selectNode(node)}
        >
          {/* Кнопка раскрытия */}
          <Button
            variant="ghost"
            size="sm"
            className="w-6 h-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleNode(node.id)
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : (
              <div className="w-3 h-3" />
            )}
          </Button>

          {/* Иконка типа */}
          {getNodeIcon(node.type, node.status)}

          {/* Информация об узле */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{node.name}</span>
              {node.code && (
                <Badge variant="outline" className="text-xs">
                  {node.code}
                </Badge>
              )}
              <Badge
                variant={node.status === 'active' ? 'default' : node.status === 'inactive' ? 'secondary' : 'destructive'}
                className="text-xs"
              >
                {node.status === 'active' ? 'Активен' : node.status === 'inactive' ? 'Неактивен' : 'Обслуживание'}
              </Badge>
            </div>

            {/* Метрики */}
            {node.metrics && (
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {node.metrics.capacity && (
                  <span className="flex items-center gap-1">
                    <Package2 className="w-3 h-3" />
                    {Math.round((node.metrics.used || 0) / node.metrics.capacity * 100)}%
                  </span>
                )}
                {node.metrics.items_count && (
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {node.metrics.items_count}
                  </span>
                )}
                {node.metrics.alerts && node.metrics.alerts > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertCircle className="w-3 h-3" />
                    {node.metrics.alerts}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Контекстное меню */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNodeEdit(node)}>
                <Edit className="w-4 h-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const childTypes = {
                    region: 'city',
                    city: 'warehouse',
                    warehouse: 'zone',
                    zone: 'section'
                  }
                  const childType = childTypes[node.type as keyof typeof childTypes]
                  if (childType) onNodeCreate(node.id, childType)
                }}
                disabled={node.type === 'section'}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить дочерний элемент
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Дублировать
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Move className="w-4 h-4 mr-2" />
                Переместить
              </DropdownMenuItem>
              <Separator />
              <DropdownMenuItem
                onClick={() => onNodeDelete(node)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Дочерние узлы */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map(child => (
              <TreeNodeComponent
                key={child.id}
                node={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Контекстная панель
  const ContextPanel: React.FC = () => {
    if (!contextPanel.node) {
      return (
        <Card className="h-full">
          <CardContent className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Выберите элемент для просмотра деталей</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const { node, breadcrumb } = contextPanel

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm mb-2">
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                <button
                  className={`transition-colors hover:opacity-80 ${getNodeTypeColor(crumb.type, crumb.status)}`}
                  onClick={() => selectNode(crumb)}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {getNodeIcon(node.type, node.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{node.name}</CardTitle>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getNodeTypeBadgeColor(node.type, node.status)}`}
                >
                  {getNodeTypeLabel(node.type)}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {node.code && `${node.code}`}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Статус и базовая информация */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Статус</span>
              <Badge
                variant={node.status === 'active' ? 'default' : node.status === 'inactive' ? 'secondary' : 'destructive'}
              >
                {node.status === 'active' ? 'Активен' : node.status === 'inactive' ? 'Неактивен' : 'Обслуживание'}
              </Badge>
            </div>

            {node.description && (
              <div>
                <span className="text-sm font-medium">Описание</span>
                <p className="text-sm text-gray-600 mt-1">{node.description}</p>
              </div>
            )}
          </div>

          {/* Метрики */}
          {node.metrics && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Метрики</h4>

              {node.metrics.capacity && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Использование</span>
                    <span>{Math.round((node.metrics.used || 0) / node.metrics.capacity * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getNodeTypeColor(node.type, node.status).replace('text-', 'bg-')}`}
                      style={{ width: `${Math.round((node.metrics.used || 0) / node.metrics.capacity * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {node.metrics.items_count && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Package2 className="w-4 h-4" />
                    Товаров
                  </span>
                  <span className="font-medium">{node.metrics.items_count}</span>
                </div>
              )}

              {node.metrics.efficiency && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Эффективность
                  </span>
                  <span className="font-medium">{node.metrics.efficiency}%</span>
                </div>
              )}
            </div>
          )}

          {/* Дочерние элементы */}
          {node.children.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">
                Дочерние элементы ({node.children.length})
              </h4>
              <div className="space-y-2">
                {node.children.slice(0, 5).map(child => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 text-sm p-2 rounded border cursor-pointer hover:bg-gray-50"
                    onClick={() => selectNode(child)}
                  >
                    {getNodeIcon(child.type, child.status)}
                    <span className="flex-1">{child.name}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                ))}
                {node.children.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{node.children.length - 5} еще
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Быстрые действия */}
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium text-sm">Действия</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => onNodeEdit(node)}>
                <Edit className="w-3 h-3 mr-1" />
                Редактировать
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const childTypes = {
                    region: 'city',
                    city: 'warehouse',
                    warehouse: 'zone',
                    zone: 'section'
                  }
                  const childType = childTypes[node.type as keyof typeof childTypes]
                  if (childType) onNodeCreate(node.id, childType)
                }}
                disabled={node.type === 'section'}
              >
                <Plus className="w-3 h-3 mr-1" />
                Добавить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full gap-6">
      {/* Левая панель - дерево */}
      <div className="flex-1 space-y-4">
        {/* Панель поиска и фильтров */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Поиск по названию, коду или описанию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Фильтр
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                    Все статусы
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('active')}>
                    Активные
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                    Неактивные
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Дерево иерархии */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Структура складов
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px] p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Нет данных для отображения</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredData.map(node => (
                    <TreeNodeComponent
                      key={node.id}
                      node={node}
                      level={0}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Правая панель - контекстная информация */}
      <div className="w-80">
        <ContextPanel />
      </div>
    </div>
  )
}