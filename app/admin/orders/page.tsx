"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { useOrders } from "@/lib/orders-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  ClipboardList,
  Eye,
  Phone,
  Mail,
  Calendar,
  Package,
  User,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Trash2,
  Share2,
  Copy,
  MessageCircle,
  FileSpreadsheet,
  Archive,
  RotateCcw
} from "lucide-react"
import * as XLSX from 'xlsx'
import { SafeImage } from "@/components/safe-image"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

interface OrderItem {
  id: number
  product_id: string
  product_name: string
  product_price: number
  product_image_url: string
  quantity: number
  total_price: number
  sku?: string
  article_number?: string
  is_on_request?: boolean
  custom_price?: number
  status?: string
  notes?: string
  variant_id?: number
  configuration?: any
}

interface Order {
  id: number
  customer_phone: string
  customer_email: string
  total_amount: number
  status: string
  created_at: string
  updated_at: string
  notes: string
  items_count: number
  items?: OrderItem[]
}

const statusConfig = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'Подтвержден', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  processing: { label: 'В обработке', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: 'Отправлен', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Выполнено', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Отменен', color: 'bg-red-100 text-red-800', icon: XCircle },
  deleted: { label: 'Удален', color: 'bg-gray-100 text-gray-800', icon: Archive }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('active')
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const { refreshOrdersCount } = useOrders()

  const loadOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      const response = await fetch(`/api/orders?${params}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.pages)
      } else {
        console.error('Ошибка загрузки заказов:', data.error)
      }
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error)
    } finally {
      setLoading(false)
    }
  }

  // Функция для фильтрации заказов по вкладкам
  const getOrdersByTab = (tabName: string) => {
    const searchFiltered = orders.filter(order => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        order.customer_phone.toLowerCase().includes(query) ||
        order.customer_email.toLowerCase().includes(query) ||
        order.id.toString().includes(query)
      )
    })

    switch (tabName) {
      case 'active':
        return searchFiltered.filter(order =>
          !['completed', 'cancelled', 'deleted'].includes(order.status)
        )
      case 'completed':
        return searchFiltered.filter(order => order.status === 'completed')
      case 'deleted':
        return searchFiltered.filter(order => order.status === 'deleted')
      default:
        return searchFiltered
    }
  }

  const loadOrderDetails = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      const data = await response.json()

      if (data.success) {
        setSelectedOrder(data.data)
        setShowOrderDialog(true)
      } else {
        console.error('Ошибка загрузки деталей заказа:', data.error)
      }
    } catch (error) {
      console.error('Ошибка загрузки деталей заказа:', error)
    }
  }

  const updateOrderStatus = async (orderId: number, newStatus: string, notes?: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, notes }),
      })

      const data = await response.json()

      if (data.success) {
        // Обновляем локальное состояние
        setOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, status: newStatus, notes: notes || order.notes, updated_at: new Date().toISOString() }
            : order
        ))

        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => prev ? { ...prev, status: newStatus, notes: notes || prev.notes } : null)
        }

        // Обновляем счетчики админки
        refreshOrdersCount()
      } else {
        console.error('Ошибка обновления заказа:', data.error)
        alert('Ошибка при обновлении заказа')
      }
    } catch (error) {
      console.error('Ошибка обновления заказа:', error)
      alert('Ошибка при обновлении заказа')
    } finally {
      setUpdating(false)
    }
  }

  // Мягкое удаление - перенос в "Удаленные"
  const moveToDeleted = async (orderId: number) => {
    await updateOrderStatus(orderId, 'deleted')
    setShowDeleteDialog(false)
    setDeletingOrderId(null)
  }

  // Восстановление из удаленных
  const restoreOrder = async (orderId: number) => {
    await updateOrderStatus(orderId, 'pending')
  }

  // Обновление товара в заказе (цена, статус, заметки)
  const updateOrderItem = async (orderId: number, itemId: number, updates: { custom_price?: number; status?: string; notes?: string }) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (data.success) {
        // Обновляем локальное состояние
        let newTotalAmount = 0
        if (selectedOrder && selectedOrder.id === orderId && selectedOrder.items) {
          const updatedItems = selectedOrder.items.map(item => {
            if (item.id === itemId) {
              const updatedItem = { ...item, ...updates }
              if (updates.custom_price !== undefined) {
                updatedItem.product_price = updates.custom_price
                updatedItem.total_price = updates.custom_price * item.quantity
              }
              return updatedItem
            }
            return item
          })
          newTotalAmount = updatedItems.reduce((total: number, item: OrderItem) => total + item.total_price, 0)
          setSelectedOrder({
            ...selectedOrder,
            items: updatedItems,
            total_amount: newTotalAmount
          })
        }

        // Также обновляем в списке заказов если изменилась цена
        if (updates.custom_price !== undefined) {
          setOrders(prev => prev.map(order =>
            order.id === orderId
              ? { ...order, total_amount: newTotalAmount }
              : order
          ))
        }

        // Toast уведомление вместо alert
        if (updates.custom_price !== undefined) {
          toast.success('Цена товара обновлена')
        }
        if (updates.status !== undefined) {
          toast.success('Статус товара обновлен')
        }
        if (updates.notes !== undefined) {
          toast.success('Заметка сохранена')
        }
      } else {
        console.error('Ошибка обновления товара:', data.error)
        toast.error('Ошибка при обновлении товара')
      }
    } catch (error) {
      console.error('Ошибка обновления товара:', error)
      toast.error('Ошибка при обновлении товара')
    }
  }

  // Полное удаление заказа
  const permanentDeleteOrder = async (orderId: number) => {
    try {
      setDeleting(orderId)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // Удаляем из локального состояния
        setOrders(prev => prev.filter(order => order.id !== orderId))

        // Обновляем счетчики админки
        refreshOrdersCount()

        alert('Заказ полностью удален')
      } else {
        console.error('Ошибка удаления заказа:', data.error)
        alert('Ошибка при удалении заказа')
      }
    } catch (error) {
      console.error('Ошибка удаления заказа:', error)
      alert('Ошибка при удалении заказа')
    } finally {
      setDeleting(null)
      setShowPermanentDeleteDialog(false)
      setDeletingOrderId(null)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [page, activeTab])

  const _formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const _getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    return (
      <Badge className={`${config.color} border-0 font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Заказы</h1>
            <p className="text-slate-600">Просмотр и управление заказами клиентов</p>
          </div>
          <Button
            onClick={loadOrders}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {/* Поиск */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex-1 max-w-md">
                <Label htmlFor="search" className="text-slate-700 font-medium">
                  Поиск заказов
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Поиск по номеру, телефону или email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Вкладки заказов */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Активные ({getOrdersByTab('active').length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Выполненные ({getOrdersByTab('completed').length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Удаленные ({getOrdersByTab('deleted').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <OrdersTable
              orders={getOrdersByTab('active')}
              loading={loading}
              deleting={deleting}
              onViewOrder={loadOrderDetails}
              onDeleteOrder={(id) => {
                setDeletingOrderId(id)
                setShowDeleteDialog(true)
              }}
              selectedOrder={selectedOrder}
              onStatusUpdate={updateOrderStatus}
              updating={updating}
            />
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <OrdersTable
              orders={getOrdersByTab('completed')}
              loading={loading}
              deleting={deleting}
              onViewOrder={loadOrderDetails}
              onDeleteOrder={(id) => {
                setDeletingOrderId(id)
                setShowDeleteDialog(true)
              }}
              selectedOrder={selectedOrder}
              onStatusUpdate={updateOrderStatus}
              updating={updating}
            />
          </TabsContent>

          <TabsContent value="deleted" className="space-y-4">
            <DeletedOrdersTable
              orders={getOrdersByTab('deleted')}
              loading={loading}
              deleting={deleting}
              onViewOrder={loadOrderDetails}
              onRestoreOrder={restoreOrder}
              onPermanentDelete={(id) => {
                setDeletingOrderId(id)
                setShowPermanentDeleteDialog(true)
              }}
              selectedOrder={selectedOrder}
              onStatusUpdate={updateOrderStatus}
              updating={updating}
            />
                     </TabsContent>
         </Tabs>

         {/* Диалог подтверждения мягкого удаления */}
         <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Удалить заказ?</AlertDialogTitle>
               <AlertDialogDescription>
                 Заказ #{deletingOrderId} будет перемещен в раздел &quot;Удаленные&quot;.
                 Вы сможете восстановить его в любое время.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel>Отмена</AlertDialogCancel>
               <AlertDialogAction
                 onClick={() => deletingOrderId && moveToDeleted(deletingOrderId)}
                 className="bg-red-600 hover:bg-red-700"
               >
                 Удалить
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>

         {/* Диалог подтверждения полного удаления */}
         <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Удалить заказ навсегда?</AlertDialogTitle>
               <AlertDialogDescription>
                 Заказ #{deletingOrderId} будет удален навсегда.
                 Это действие нельзя отменить. Все данные заказа будут потеряны.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel>Отмена</AlertDialogCancel>
               <AlertDialogAction
                 onClick={() => deletingOrderId && permanentDeleteOrder(deletingOrderId)}
                 className="bg-red-600 hover:bg-red-700"
               >
                 Удалить навсегда
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>

         {/* Централизованный диалог просмотра заказа */}
         <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog} modal={true}>
                            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                              <OrderDetailsDialog
                                order={selectedOrder}
                                onStatusUpdate={updateOrderStatus}
                                onUpdateItem={updateOrderItem}
                                updating={updating}
                                onDeleteOrder={(orderId) => {
                                  setDeletingOrderId(orderId)
                                  setShowDeleteDialog(true)
                                  setShowOrderDialog(false)
                                }}
                              />
                            </DialogContent>
                          </Dialog>
      </div>
    </AdminLayout>
  )
}

// Компонент для отображения деталей заказа
function OrderDetailsDialog({
  order,
  onStatusUpdate,
  onUpdateItem,
  updating,
  onDeleteOrder
}: {
  order: Order | null
  onStatusUpdate: (orderId: number, status: string, notes?: string) => void
  onUpdateItem: (orderId: number, itemId: number, updates: { custom_price?: number; status?: string; notes?: string }) => Promise<void>
  updating: boolean
  onDeleteOrder?: (orderId: number) => void
}) {
  const [newStatus, setNewStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [itemPrices, setItemPrices] = useState<Record<number, string>>({})
  const [itemStatuses, setItemStatuses] = useState<Record<number, string>>({})
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({})

  useEffect(() => {
    if (order) {
      setNewStatus(order.status)
      setNotes(order.notes || '')

      // Инициализируем цены, статусы и заметки товаров
      const prices: Record<number, string> = {}
      const statuses: Record<number, string> = {}
      const notes: Record<number, string> = {}

      order.items?.forEach(item => {
        // Для всех товаров можно редактировать цену
        prices[item.id] = item.custom_price?.toString() || item.product_price?.toString() || ''
        statuses[item.id] = item.status || ''
        notes[item.id] = item.notes || ''
      })

      setItemPrices(prices)
      setItemStatuses(statuses)
      setItemNotes(notes)
    }
  }, [order])

  if (!order) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-500" />
        <p className="text-slate-600">Загрузка деталей заказа...</p>
      </div>
    )
  }

  const handleStatusUpdate = () => {
    if (newStatus !== order.status || notes !== order.notes) {
      onStatusUpdate(order.id, newStatus, notes)
    }
  }

  // Функции для поделиться заказом
  const copyOrderToClipboard = async () => {
    if (!order) {
      toast.error('Заказ не найден')
      return
    }
    const orderText = `
🛒 ЗАКАЗ #${order.id}

👤 КЛИЕНТ:
📞 Телефон: ${order.customer_phone}
📧 Email: ${order.customer_email}

📦 ТОВАРЫ:
${order.items?.map(item => {
  const price = item.custom_price || item.product_price;
  let itemText = `• ${item.product_name}${item.sku ? ` (${item.sku})` : ''}${item.article_number ? ` [${item.article_number}]` : ''}
  ${item.quantity} шт. × ${price.toLocaleString('ru-RU')} ₽ = ${item.total_price.toLocaleString('ru-RU')} ₽${item.status ? ` - ${getItemStatusText(item.status)}` : ''}${item.notes ? ` (${item.notes})` : ''}`;
  
  // Добавляем конфигурацию, если есть
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    const configText = Object.entries(item.configuration)
      .map(([key, config]: [string, any]) => `${config.characteristic_name}: ${config.value_name}`)
      .join(', ');
    itemText += `\n  Конфигурация: ${configText}`;
  }
  
  return itemText;
}).join('\n') || 'Товары не найдены'}

💰 ИТОГО: ${order.total_amount.toLocaleString('ru-RU')} ₽

📅 ДАТЫ:
Создан: ${new Date(order.created_at).toLocaleString('ru-RU')}
Обновлен: ${new Date(order.updated_at).toLocaleString('ru-RU')}

📋 СТАТУС: ${getStatusText(order.status)}
${order.notes ? `📝 КОММЕНТАРИЙ: ${order.notes}` : ''}
    `.trim()

    try {
      await navigator.clipboard.writeText(orderText)
      toast.success('Информация о заказе скопирована в буфер обмена!')
    } catch (error) {
      console.error('Ошибка копирования:', error)
      toast.error('Ошибка при копировании в буфер обмена')
    }
  }

  const shareViaWhatsApp = () => {
    if (!order) {
      toast.error('Заказ не найден')
      return
    }
    const message = `🛒 *ЗАКАЗ #${order.id}*

👤 *КЛИЕНТ:*
📞 ${order.customer_phone}
📧 ${order.customer_email}

📦 *ТОВАРЫ:*
${order.items?.map(item => {
  const price = item.custom_price || item.product_price;
  let itemText = `• ${item.product_name}${item.sku ? ` (${item.sku})` : ''}
  ${item.quantity} шт. × ${price.toLocaleString('ru-RU')} ₽${item.status ? ` - ${getItemStatusText(item.status)}` : ''}`;
  
  // Добавляем конфигурацию, если есть
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    const configText = Object.entries(item.configuration)
      .map(([key, config]: [string, any]) => `${config.characteristic_name}: ${config.value_name}`)
      .join(', ');
    itemText += `\n  _Конфигурация: ${configText}_`;
  }
  
  return itemText;
}).join('\n') || 'Товары не найдены'}

💰 *ИТОГО: ${order.total_amount.toLocaleString('ru-RU')} ₽*

📋 Статус: ${getStatusText(order.status)}
📅 ${new Date(order.created_at).toLocaleString('ru-RU')}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    toast.success('Переход в WhatsApp...')
  }

  const _shareViaEmail = () => {
    if (!order) {
      toast.error('Заказ не найден')
      return
    }
    const subject = `Заказ #${order.id} - ${order.customer_phone}`
    const body = `Информация о заказе #${order.id}

КЛИЕНТ:
Телефон: ${order.customer_phone}
Email: ${order.customer_email}

ТОВАРЫ:
${order.items?.map(item => {
  const price = item.custom_price || item.product_price;
  let itemText = `${item.product_name}${item.sku ? ` (${item.sku})` : ''}${item.article_number ? ` [${item.article_number}]` : ''}
Количество: ${item.quantity} шт.
Цена: ${price.toLocaleString('ru-RU')} ₽
Сумма: ${item.total_price.toLocaleString('ru-RU')} ₽${item.status ? `
Статус: ${getItemStatusText(item.status)}` : ''}${item.notes ? `
Заметка: ${item.notes}` : ''}`;

  // Добавляем конфигурацию, если есть
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    const configText = Object.entries(item.configuration)
      .map(([key, config]: [string, any]) => `${config.characteristic_name}: ${config.value_name}`)
      .join(', ');
    itemText += `\nКонфигурация: ${configText}`;
  }
  
  return itemText;
}).join('\n\n') || 'Товары не найдены'}

ИТОГО: ${order.total_amount.toLocaleString('ru-RU')} ₽

СТАТУС: ${getStatusText(order.status)}
СОЗДАН: ${new Date(order.created_at).toLocaleString('ru-RU')}
ОБНОВЛЕН: ${new Date(order.updated_at).toLocaleString('ru-RU')}

${order.notes ? `КОММЕНТАРИЙ: ${order.notes}` : ''}`

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoUrl)
    toast.success('Переход в почтовый клиент...')
  }

  // Общая функция поделиться для мобильных устройств
  const shareViaNative = async () => {
    if (!order) {
      toast.error('Заказ не найден')
      return
    }

    // Проверяем поддержку Web Share API
    if (!navigator.share) {
      toast.error('Функция "поделиться" не поддерживается в этом браузере')
      return
    }

    const shareText = `🛒 ЗАКАЗ #${order.id}

👤 КЛИЕНТ:
📞 ${order.customer_phone}
📧 ${order.customer_email}

📦 ТОВАРЫ:
${order.items?.map(item => {
  const price = item.custom_price || item.product_price;
  let itemText = `• ${item.product_name}${item.sku ? ` (${item.sku})` : ''}
  ${item.quantity} шт. × ${price.toLocaleString('ru-RU')} ₽${item.status ? ` - ${getItemStatusText(item.status)}` : ''}`;
  
  // Добавляем конфигурацию, если есть
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    const configText = Object.entries(item.configuration)
      .map(([key, config]: [string, any]) => `${config.characteristic_name}: ${config.value_name}`)
      .join(', ');
    itemText += `\n  Конфигурация: ${configText}`;
  }
  
  return itemText;
}).join('\n') || 'Товары не найдены'}

💰 ИТОГО: ${order.total_amount.toLocaleString('ru-RU')} ₽

📋 Статус: ${getStatusText(order.status)}
📅 ${new Date(order.created_at).toLocaleString('ru-RU')}`

    try {
      await navigator.share({
        title: `Заказ #${order.id}`,
        text: shareText,
      })
      toast.success('Заказ отправлен!')
    } catch (error) {
      // Пользователь отменил шаринг или произошла ошибка
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Ошибка при использовании Web Share API:', error)
        toast.error('Ошибка при отправке')
      }
    }
  }

  // Проверка поддержки Web Share API
  const isWebShareSupported = () => {
    return typeof navigator !== 'undefined' && 'share' in navigator
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Ожидает',
      'confirmed': 'Подтвержден',
      'processing': 'В обработке',
      'shipped': 'Отправлен',
      'delivered': 'Доставлен',
      'completed': 'Выполнено',
      'cancelled': 'Отменен',
      'deleted': 'Удален'
    }
    return statusMap[status] || status
  }

  const getItemStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Ожидает',
      'confirmed': 'Подтвержден',
      'processing': 'В обработке',
      'ready': 'Готов',
      'completed': 'Выполнен',
      'cancelled': 'Отменен',
      'out_of_stock': 'Нет в наличии'
    }
    return statusMap[status] || status
  }

  const getItemStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Ожидает', color: 'bg-gray-100 text-gray-700' },
      'confirmed': { label: 'Подтвержден', color: 'bg-blue-100 text-blue-800' },
      'processing': { label: 'В обработке', color: 'bg-yellow-100 text-yellow-700' },
      'ready': { label: 'Готов', color: 'bg-purple-100 text-purple-700' },
      'completed': { label: 'Выполнен', color: 'bg-green-100 text-green-700' },
      'cancelled': { label: 'Отменен', color: 'bg-red-100 text-red-700' },
      'out_of_stock': { label: 'Нет в наличии', color: 'bg-orange-100 text-orange-700' }
    }

    const config = statusConfig[status] || statusConfig.pending
    return (
      <Badge className={`${config.color} border-0 text-xs font-medium px-2 py-1`}>
        {config.label}
      </Badge>
    )
  }

  const getItemsStatusSummary = (items: OrderItem[]) => {
    const statusCounts = items.reduce((acc, item) => {
      if (item.status) {
        acc[item.status] = (acc[item.status] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    // Подсчитываем товары без статуса
    const itemsWithoutStatus = items.filter(item => !item.status).length

    const statusOrder = ['completed', 'ready', 'processing', 'confirmed', 'pending', 'cancelled', 'out_of_stock']

    const result = []

    // Добавляем товары без статуса
    if (itemsWithoutStatus > 0) {
      result.push(
        <span key="no-status" className="text-slate-500 font-medium">
          Без статуса: {itemsWithoutStatus}
        </span>
      )
    }

    // Добавляем товары со статусами
    statusOrder
      .filter(status => statusCounts[status] > 0)
      .forEach(status => {
        const count = statusCounts[status]
        const config = {
          'pending': { label: 'Ожидает', color: 'text-gray-600' },
          'confirmed': { label: 'Подтвержден', color: 'text-blue-600' },
          'processing': { label: 'В обработке', color: 'text-yellow-600' },
          'ready': { label: 'Готов', color: 'text-purple-600' },
          'completed': { label: 'Выполнен', color: 'text-green-600' },
          'cancelled': { label: 'Отменен', color: 'text-red-600' },
          'out_of_stock': { label: 'Нет в наличии', color: 'text-orange-600' }
        }[status]

        result.push(
          <span key={status} className={`${config?.color} font-medium`}>
            {config?.label}: {count}
          </span>
        )
      })

    return result
  }

  const exportToExcel = () => {
    if (!order) {
      toast.error('Заказ не найден')
      return
    }

    try {
      // Создаем данные для Excel
      const orderInfoData = [
        ['ТОВАРНЫЙ СПИСОК ЗАКАЗА'],
        [''],
        ['Номер заказа:', `#${order.id}`],
        ['Дата создания:', new Date(order.created_at).toLocaleString('ru-RU')],
        ['Статус:', getStatusText(order.status)],
        [''],
        ['КЛИЕНТ:'],
        ['Телефон:', order.customer_phone],
        ['Email:', order.customer_email],
        [''],
        ['ТОВАРЫ:']
      ]

      // Заголовки таблицы товаров
              const headers = ['№', 'Наименование товара', 'Конфигурация', 'SKU', 'Артикул', 'Статус', 'Заметки', 'Количество, шт.', 'Цена за ед., ₽', 'Сумма, ₽']

      // Данные товаров
      const itemsData = order.items?.map((item, index) => [
        index + 1,
        item.product_name,
        item.configuration && Object.keys(item.configuration).length > 0
          ? Object.entries(item.configuration)
              .map(([key, config]: [string, any]) => `${config.characteristic_name}: ${config.value_name}`)
              .join(', ')
          : '',
        item.sku || '',
        item.article_number || '',
        (() => {
          if (!item.status) return 'Не установлен'
          const statusLabels: Record<string, string> = {
            'pending': 'Ожидает',
            'confirmed': 'Подтвержден',
            'processing': 'В обработке',
            'ready': 'Готов',
            'completed': 'Выполнен',
            'cancelled': 'Отменен',
            'out_of_stock': 'Нет в наличии'
          }
          return statusLabels[item.status] || 'Неизвестный'
        })(),
        item.notes || '',
        item.quantity,
        item.product_price,
        item.total_price
      ]) || []

      // Итоговая строка
      const totalRow = ['', '', '', '', '', 'ИТОГО:', '', '', order.total_amount]

      // Объединяем все данные
      const allData = [
        ...orderInfoData,
        headers,
        ...itemsData,
        totalRow
      ]

      if (order.notes) {
        allData.push([''], ['КОММЕНТАРИЙ:'], [order.notes])
      }

      // Создаем рабочую книгу
      const ws = XLSX.utils.aoa_to_sheet(allData)
      const wb = XLSX.utils.book_new()

      // Настраиваем ширину колонок
      ws['!cols'] = [
        { wch: 5 },   // №
        { wch: 35 },  // Наименование
        { wch: 30 },  // Конфигурация
        { wch: 15 },  // SKU
        { wch: 15 },  // Артикул
        { wch: 15 },  // Статус
        { wch: 20 },  // Заметки
        { wch: 12 },  // Количество
        { wch: 15 },  // Цена
        { wch: 15 }   // Сумма
      ]

      // Стили для заголовка
      const headerStyle = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      }

      // Применяем стили к заголовку
      if (ws['A1']) {
        ws['A1'].s = headerStyle
      }

      // Добавляем лист в книгу
      XLSX.utils.book_append_sheet(wb, ws, 'Заказ')

      // Сохраняем файл
      const fileName = `Заказ_${order.id}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

      alert('Excel файл успешно создан и скачан!')
    } catch (error) {
      console.error('Ошибка экспорта в Excel:', error)
      alert('Ошибка при создании Excel файла')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6" />
          Заказ #{order.id}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Объединенная информация о заказе */}
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Информация о заказе
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Колонка 1: Клиент и даты */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Клиент
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-800">{order.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-800">{order.customer_email}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Даты
                </h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-slate-600">Создан:</span>
                    <p className="font-medium text-slate-800">
                      {new Date(order.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Обновлен:</span>
                    <p className="font-medium text-slate-800">
                      {new Date(order.updated_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Колонка 2: Управление статусом */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  Статус заказа
                </Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="confirmed">Подтвержден</SelectItem>
                    <SelectItem value="processing">В обработке</SelectItem>
                    <SelectItem value="shipped">Отправлен</SelectItem>
                    <SelectItem value="delivered">Доставлен</SelectItem>
                    <SelectItem value="completed">Выполнено</SelectItem>
                    <SelectItem value="cancelled">Отменен</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Комментарий
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Заметки к заказу..."
                  className="min-h-[60px] text-sm"
                />
            </div>
            </div>

            {/* Колонка 3: Действия */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Управление
                </Label>
                <div className="space-y-2">
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating || (newStatus === order.status && notes === order.notes)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9"
                    size="sm"
                  >
                    {updating ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Обновить
                  </Button>

                  {onDeleteOrder && (
                    <Button
                      onClick={() => onDeleteOrder(order.id)}
                      variant="outline"
                      className="w-full h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить заказ
                    </Button>
                  )}
                </div>
              </div>

                              <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Экспорт и отправка
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyOrderToClipboard}
                      className="h-9 text-xs flex-1 min-w-[90px]"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Копировать
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      className="h-9 text-xs flex-1 min-w-[80px]"
                    >
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Excel
                    </Button>

                    {/* Общая функция поделиться для мобильных или WhatsApp для десктопа */}
                    {isWebShareSupported() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={shareViaNative}
                        className="h-9 text-xs flex-1 min-w-[95px]"
                      >
                        <Share2 className="w-3 h-3 mr-1" />
                        Поделиться
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={shareViaWhatsApp}
                        className="h-9 text-xs flex-1 min-w-[90px]"
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                  </div>

                </div>
            </div>
          </div>
        </div>

        {/* Товары в заказе - перемещен вниз для лучшего UX */}
        {order.items && order.items.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Товары в заказе ({order.items.length})
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {getItemsStatusSummary(order.items)}
              </div>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  {/* Увеличенное изображение с возможностью просмотра */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="relative cursor-pointer group self-start sm:self-auto">
                        <SafeImage
                          src={item.product_image_url || PROSTHETIC_FALLBACK_IMAGE}
                          alt={item.product_name}
                          width={100}
                          height={100}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-slate-200 group-hover:border-blue-400 transition-colors"
                          sizes="(max-width: 640px) 80px, 100px"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Search className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600" />
                          </div>
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{item.product_name}</DialogTitle>
                      </DialogHeader>
                      <div className="flex justify-center">
                        <SafeImage
                          src={item.product_image_url || PROSTHETIC_FALLBACK_IMAGE}
                          alt={item.product_name}
                          width={600}
                          height={600}
                          className="max-h-[70vh] w-auto rounded-lg object-contain"
                          sizes="600px"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Компактная информация о товаре */}
                  <div className="flex-1 min-w-0">
                    {/* Заголовок и статус в одной строке */}
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-800 truncate flex-1">{item.product_name}</h4>
                      {item.status && getItemStatusBadge(item.status)}
                    </div>

                    {/* Основная информация в сетке */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      {/* Количество и тип */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          {item.quantity} шт.
                          {item.is_on_request && (
                            <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                              По запросу
                            </span>
                          )}
                        </span>
                      </div>

                      {/* SKU и артикул */}
                      {(item.sku || item.article_number) && (
                        <div className="flex gap-2 text-xs">
                          {item.sku && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                              {item.sku}
                            </span>
                          )}
                          {item.article_number && (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                              {item.article_number}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Конфигурация варианта */}
                    {item.configuration && Object.keys(item.configuration).length > 0 && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-slate-700 mb-1">Конфигурация:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.configuration).map(([key, config]: [string, any]) => (
                            <Badge 
                              key={key} 
                              variant="secondary" 
                              className="text-xs bg-cyan-100 text-cyan-800 border-cyan-200"
                            >
                              {config.characteristic_name}: {config.value_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Управление: адаптивная сетка */}
                    <div className="space-y-3">
                      {/* Первая строка: цена и статус */}
                      <div className="flex flex-wrap gap-3">
                        {/* Цена */}
                        <div className="flex items-center gap-2 min-w-0">
                          <Label className="text-xs text-slate-600 shrink-0">Цена:</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={itemPrices[item.id] || ''}
                            onChange={(e) => setItemPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="h-7 text-xs w-20"
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              const newPrice = parseFloat(itemPrices[item.id]) || 0
                              await onUpdateItem(order.id, item.id, { custom_price: newPrice })
                            }}
                          >
                            ✓
                          </Button>
                        </div>

                        {/* Статус */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Label className="text-xs text-slate-600 shrink-0">Статус:</Label>
                          <Select
                            value={itemStatuses[item.id] || ''}
                            onValueChange={async (value) => {
                              if (value === 'none') {
                                setItemStatuses(prev => ({ ...prev, [item.id]: '' }))
                                await onUpdateItem(order.id, item.id, { status: '' })
                              } else {
                                setItemStatuses(prev => ({ ...prev, [item.id]: value }))
                                await onUpdateItem(order.id, item.id, { status: value })
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-40 max-w-full">
                              <SelectValue placeholder="Не установлен" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-slate-400">Сбросить</SelectItem>
                              <SelectItem value="pending">Ожидает</SelectItem>
                              <SelectItem value="confirmed">Подтвержден</SelectItem>
                              <SelectItem value="processing">В обработке</SelectItem>
                              <SelectItem value="ready">Готов</SelectItem>
                              <SelectItem value="completed">Выполнен</SelectItem>
                              <SelectItem value="cancelled">Отменен</SelectItem>
                              <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Вторая строка: заметки */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600">Заметки:</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Добавить заметку..."
                            value={itemNotes[item.id] || ''}
                            onChange={(e) => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={async () => {
                              await onUpdateItem(order.id, item.id, { notes: itemNotes[item.id] || '' })
                            }}
                          >
                            ✓
                          </Button>
                        </div>
                        {itemNotes[item.id] && (
                          <p className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded break-words">
                            {itemNotes[item.id]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">
                      {item.is_on_request && item.custom_price ?
                        (item.custom_price * item.quantity).toLocaleString('ru-RU') + ' ₽' :
                        item.is_on_request ? 'По запросу' :
                        item.total_price.toLocaleString('ru-RU') + ' ₽'
                      }
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-lg font-bold text-slate-800">Итого:</span>
                <span className="text-xl font-bold text-slate-800">
                  {order.total_amount.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Компонент таблицы заказов
function OrdersTable({
  orders,
  loading,
  deleting,
  onViewOrder,
  onDeleteOrder,
  selectedOrder,
  onStatusUpdate,
  updating
}: {
  orders: Order[]
  loading: boolean
  deleting: number | null
  onViewOrder: (id: number) => void
  onDeleteOrder: (id: number) => void
  selectedOrder: Order | null
  onStatusUpdate: (orderId: number, status: string, notes?: string) => void
  updating: boolean
}) {

  // Быстрое поделиться заказом из таблицы
  const quickShareOrder = async (order: Order) => {
    const shareText = `🛒 Заказ #${order.id}
👤 ${order.customer_phone}
💰 ${order.total_amount.toLocaleString('ru-RU')} ₽
📦 ${order.items_count} товар${order.items_count > 1 ? 'ов' : ''}
📅 ${new Date(order.created_at).toLocaleString('ru-RU')}`

    // Проверяем поддержку Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Заказ #${order.id}`,
          text: shareText,
        })
        toast.success('Заказ отправлен!')
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка при использовании Web Share API:', error)
          toast.error('Ошибка при отправке')
        }
      }
    } else {
      // Fallback - отправляем в WhatsApp
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
      window.open(whatsappUrl, '_blank')
      toast.success('Переход в WhatsApp...')
    }
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    return (
      <Badge className={`${config.color} border-0 font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
          Список заказов ({orders.length})
            </CardTitle>
          </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-500" />
              <p className="text-slate-600">Загрузка заказов...</p>
            </div>
        ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Заказы не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">№ заказа</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Клиент</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Товары</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Сумма</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Статус</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Дата</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Действия</th>
                  </tr>
                </thead>
                <tbody>
                {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                          #{order.id}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{order.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{order.customer_email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {order.items_count} товар{order.items_count > 1 ? 'ов' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800">
                          {order.total_amount.toLocaleString('ru-RU')} ₽
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-slate-600">
                          {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                          onClick={() => onViewOrder(order.id)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Просмотр
                              </Button>

                          <Button
                            variant="outline"
                            size="sm"
                          onClick={() => quickShareOrder(order)}
                          className="w-9 h-9 p-0"
                          title="Поделиться заказом"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteOrder(order.id)}
                            disabled={deleting === order.id}
                          className="w-9 h-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          title="Удалить заказ"
                          >
                            {deleting === order.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                            <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
  )
}

// Компонент таблицы удаленных заказов
function DeletedOrdersTable({
  orders,
  loading,
  deleting,
  onViewOrder,
  onRestoreOrder,
  onPermanentDelete,
  selectedOrder,
  onStatusUpdate,
  updating
}: {
  orders: Order[]
  loading: boolean
  deleting: number | null
  onViewOrder: (id: number) => void
  onRestoreOrder: (id: number) => void
  onPermanentDelete: (id: number) => void
  selectedOrder: Order | null
  onStatusUpdate: (orderId: number, status: string, notes?: string) => void
  updating: boolean
}) {

  // Быстрое поделиться заказом из таблицы
  const quickShareOrder = async (order: Order) => {
    const shareText = `🛒 Заказ #${order.id} (Удален)
👤 ${order.customer_phone}
💰 ${order.total_amount.toLocaleString('ru-RU')} ₽
📦 ${order.items_count} товар${order.items_count > 1 ? 'ов' : ''}
📅 ${new Date(order.created_at).toLocaleString('ru-RU')}`

    // Проверяем поддержку Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Заказ #${order.id}`,
          text: shareText,
        })
        toast.success('Заказ отправлен!')
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка при использовании Web Share API:', error)
          toast.error('Ошибка при отправке')
        }
      }
    } else {
      // Fallback - отправляем в WhatsApp
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
      window.open(whatsappUrl, '_blank')
      toast.success('Переход в WhatsApp...')
    }
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const _getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
  return (
      <Badge className={`${config.color} border-0 font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="w-5 h-5" />
          Удаленные заказы ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-500" />
            <p className="text-slate-600">Загрузка заказов...</p>
            </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Удаленные заказы не найдены</p>
            </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">№ заказа</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Клиент</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Товары</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Сумма</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Дата удаления</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                        #{order.id}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{order.customer_phone}</span>
          </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{order.customer_email}</span>
        </div>
                  </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                        {order.items_count} товар{order.items_count > 1 ? 'ов' : ''}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-800">
                  {order.total_amount.toLocaleString('ru-RU')} ₽
                </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-600">
                        {formatDate(order.updated_at)}
              </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewOrder(order.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Просмотр
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickShareOrder(order)}
                          className="w-9 h-9 p-0"
                          title="Поделиться заказом"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>

              <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreOrder(order.id)}
                          disabled={deleting === order.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                        >
                          {deleting === order.id ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                            <RotateCcw className="w-4 h-4 mr-2" />
                )}
                          Восстановить
              </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPermanentDelete(order.id)}
                          disabled={deleting === order.id}
                          className="w-9 h-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          title="Удалить навсегда"
                        >
                          {deleting === order.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
            </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
        )}
      </CardContent>
    </Card>
  )
}