"use client"
import { SafeImage } from "@/components/safe-image"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Phone, Mail, ClipboardList, CheckCircle, Loader2, Share2, MessageCircle } from "lucide-react"
import { CartItem } from "@/lib/cart-context"
import { useOrders } from "@/lib/orders-context"
import { toast } from "sonner"

interface OrderFormProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  totalPrice: number
  onOrderComplete: () => void
}

export function OrderForm({ isOpen, onClose, items, totalPrice, onOrderComplete }: OrderFormProps) {
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [createdOrder, setCreatedOrder] = useState<{id: number, phone: string, email: string, total: number, itemsCount: number, createdAt: string} | null>(null)
  const { refreshOrdersCount } = useOrders()

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    // Валидация телефона
    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен для связи'
    } else if (!/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Введите корректный номер телефона'
    }

    // Валидация email
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен для связи'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Введите корректный email адрес'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const orderData = {
        customer_phone: formData.phone.trim(),
        customer_email: formData.email.trim(),
        total_amount: totalPrice,
        notes: formData.notes.trim(),
        items: items.map(item => {
          // Для товаров "По запросу" цена будет 0, менеджер установит цену в админке
          const finalPrice = item.is_on_request ? 0 : item.price
          return {
            product_id: item.id,
            product_name: item.name,
            product_price: finalPrice,
            product_image_url: item.image_url,
            quantity: item.quantity,
            total_price: finalPrice * item.quantity,
            sku: item.sku || '',
            article_number: item.article_number || '',
            is_on_request: item.is_on_request || false,
            variant_id: item.variant_id || null,
            configuration: item.configuration || null
          }
        })
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ошибка HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Обновляем счетчики админки
        refreshOrdersCount()

        // Сохраняем информацию о созданном заказе
        setCreatedOrder({
          id: result.data.orderId,
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          total: totalPrice,
          itemsCount: items.length,
          createdAt: result.data.createdAt
        })

        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          onOrderComplete()
          onClose()
          // Сброс формы
          setFormData({ phone: '', email: '', notes: '' })
          setCreatedOrder(null)
        }, 2000)
      } else {
        throw new Error(result.error || 'Ошибка при создании заказа')
      }
    } catch (error) {
      console.error('Ошибка создания заказа:', error)
      alert(`Произошла ошибка при оформлении заказа: ${error?.message || 'Неизвестная ошибка'}. Пожалуйста, попробуйте снова.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Убираем ошибку при вводе
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Функция поделиться заказом
  const shareOrder = async () => {
    if (!createdOrder) return

    const shareText = `🛒 Заказ #${createdOrder.id}
👤 ${createdOrder.phone}
💰 ${createdOrder.total.toLocaleString('ru-RU')} ₽
📦 ${createdOrder.itemsCount} товар${createdOrder.itemsCount > 1 ? 'ов' : ''}
📅 ${new Date(createdOrder.createdAt).toLocaleString('ru-RU')}

Заказ успешно оформлен! Ожидайте звонка для подтверждения.`

    // Проверяем поддержку Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `Заказ #${createdOrder.id}`,
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

  // Проверка поддержки Web Share API
  const isWebShareSupported = () => {
    return typeof navigator !== 'undefined' && 'share' in navigator
  }

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border border-cyan-200/50 shadow-2xl shadow-cyan-200/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent">
              Заказ успешно оформлен!
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Мы свяжемся с вами в ближайшее время для подтверждения заказа
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>

            {/* Информация о заказе */}
            {createdOrder && (
              <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-xl p-4 border border-cyan-200/30 mb-6">
                <div className="text-left space-y-2">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Номер заказа:</span> #{createdOrder.id}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Сумма:</span> {createdOrder.total.toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Товаров:</span> {createdOrder.itemsCount} шт.
                  </p>
                </div>
              </div>
            )}

            {/* Кнопка поделиться */}
            <div className="flex gap-3 mb-4">
              {isWebShareSupported() ? (
                <Button
                  onClick={shareOrder}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                  size="sm"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Поделиться заказом
                </Button>
              ) : (
                <Button
                  onClick={shareOrder}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Отправить в WhatsApp
                </Button>
              )}
            </div>

            <div className="w-16 h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mx-auto"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-xl border border-cyan-200/50 shadow-2xl shadow-cyan-200/20 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent flex items-center gap-2">
                          <ClipboardList className="w-6 h-6 text-cyan-600" />
            Оформление заказа
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Заполните контактные данные для связи с вами
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Контактные данные */}
          <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-200/30">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
              <Phone className="w-5 h-5 text-cyan-600" />
              Контактные данные
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 font-medium">
                  Номер телефона *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`bg-white/80 border-cyan-200/50 focus:border-cyan-400 focus:ring-cyan-400/20 ${
                    errors.phone ? 'border-red-300 focus:border-red-400' : ''
                  }`}
                />
                {errors.phone && (
                  <p className="text-slate-600 text-sm">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">
                  Email адрес *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`bg-white/80 border-cyan-200/50 focus:border-cyan-400 focus:ring-cyan-400/20 ${
                    errors.email ? 'border-red-300 focus:border-red-400' : ''
                  }`}
                />
                {errors.email && (
                  <p className="text-slate-600 text-sm">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="notes" className="text-slate-700 font-medium">
                Комментарий к заказу
              </Label>
              <Textarea
                id="notes"
                placeholder="Дополнительные пожелания или вопросы..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="bg-white/80 border-cyan-200/50 focus:border-cyan-400 focus:ring-cyan-400/20 min-h-[80px]"
              />
            </div>
          </div>

          {/* Итоги заказа */}
          <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-200/30">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">
              Итоги заказа
            </h3>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-cyan-200/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <SafeImage src={item.image_url} alt={item.name} width={48} height={48} className="w-12 h-12 rounded-lg object-cover border border-cyan-200/30" />
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-600">
                        {item.quantity} шт.
                        {item.is_on_request ? ' (цена по запросу)' : ` × ${item.price.toLocaleString('ru-RU')} ₽`}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {item.is_on_request ? 'По запросу' : (item.price * item.quantity).toLocaleString('ru-RU') + ' ₽'}
                  </p>
                </div>
              ))}

              <div className="flex justify-between items-center pt-4 border-t border-cyan-300/50">
                <p className="text-lg font-bold text-slate-800">Итого:</p>
                <p className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {totalPrice.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 hover:from-slate-100 hover:to-slate-200 hover:border-slate-300 transition-all duration-300"
              disabled={isSubmitting}
            >
              Отменить
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 hover:scale-[1.02]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Оформляем заказ...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Подтвердить заказ
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}