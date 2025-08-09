"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Building2,
  Globe,
  Package2,
  FileText,
  Box,
  MapPin
} from 'lucide-react'

// Типы для дерева
export interface TreeNode {
  id: string
  name: string
  type: 'region' | 'city' | 'warehouse' | 'zone' | 'section' | 'article'
  children?: TreeNode[]
  data?: any
  expanded?: boolean
}

interface WarehouseTreeNodeProps {
  node: TreeNode
  level?: number
  expandedNodes: Set<string>
  onToggleNode: (nodeId: string) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  onNodeClick: (e: React.MouseEvent, node: TreeNode) => void
}

export const WarehouseTreeNode: React.FC<WarehouseTreeNodeProps> = ({
  node,
  level = 0,
  expandedNodes,
  onToggleNode,
  onContextMenu,
  onNodeClick
}) => {
  const isExpanded = expandedNodes.has(node.id)
  const hasChildren = node.children && node.children.length > 0

  const getNodeIcon = (type: string, expanded: boolean) => {
    switch (type) {
      case 'region':
        return <Globe className="w-4 h-4 text-blue-600" />
      case 'city':
        return <MapPin className="w-4 h-4 text-green-600" />
      case 'warehouse':
        return <Building2 className="w-4 h-4 text-purple-600" />
      case 'zone':
        return expanded ? <FolderOpen className="w-4 h-4 text-orange-600" /> : <Folder className="w-4 h-4 text-orange-600" />
      case 'section':
        return <Package2 className="w-4 h-4 text-cyan-600" />
      case 'article':
        return <Box className="w-4 h-4 text-gray-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = () => {
    if (node.data?.is_active === false) {
      return <Badge variant="destructive" className="text-xs">Неактивен</Badge>
    }
    if (node.data?.utilization_percentage && parseFloat(node.data.utilization_percentage) > 90) {
      return <Badge variant="destructive" className="text-xs">Переполнен</Badge>
    }
    if (node.data?.utilization_percentage && parseFloat(node.data.utilization_percentage) > 70) {
      return <Badge variant="secondary" className="text-xs">Заполнен</Badge>
    }
    return null
  }

  const getCountBadge = () => {
    const counts = []
    if (node.data?.cities_count) counts.push(`городов: ${node.data.cities_count}`)
    if (node.data?.warehouses_count) counts.push(`складов: ${node.data.warehouses_count}`)
    if (node.data?.zones_count) counts.push(`зон: ${node.data.zones_count}`)
    if (node.data?.sections_count) counts.push(`секций: ${node.data.sections_count}`)
    if (node.data?.items_count) counts.push(`товаров: ${node.data.items_count}`)

    return counts.length > 0 ? <span className="text-xs text-gray-500">({counts.join(', ')})</span> : null
  }

  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      <div
        className="flex items-center hover:bg-gray-50 rounded-md p-2 cursor-pointer"
        onClick={(e) => onNodeClick(e, node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {/* Кнопка раскрытия */}
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            className="w-6 h-6 p-0 mr-2"
            onClick={(e) => {
              e.stopPropagation()
              onToggleNode(node.id)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* Отступ для элементов без детей */}
        {!hasChildren && level > 0 && (
          <div className="w-6 mr-2"></div>
        )}

        {/* Иконка типа */}
        <div className="mr-2">
          {getNodeIcon(node.type, isExpanded)}
        </div>

        {/* Название и информация */}
        <div className="flex-1 flex items-center justify-between">
          <div className="flex flex-col">
            <span className={`font-medium ${level === 0 ? 'text-base' : 'text-sm'}`}>
              {node.name}
            </span>
            {getCountBadge()}
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>
      </div>

      {/* Дочерние элементы */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children!.map((child) => (
            <WarehouseTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleNode={onToggleNode}
              onContextMenu={onContextMenu}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}