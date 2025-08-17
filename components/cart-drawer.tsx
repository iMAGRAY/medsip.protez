"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Trash2, ClipboardList, Phone, MessageCircle, Share2 } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import { OrderForm } from "@/components/order-form"
import { toast } from "sonner"
import { SafeImage } from "@/components/safe-image"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"

interface CartDrawerProps {
  children: React.ReactNode
}

export function CartDrawer({ children }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({})

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id)
    } else {
      updateQuantity(id, newQuantity)
    }
  }

  const handleOrderClick = () => {
    setShowOrderForm(true)
    setIsOpen(false)
  }

  const handleOrderComplete = () => {
    clearCart()
    setShowOrderForm(false)
  }

  // Функция поделиться заявкой
  const shareCart = async () => {
    const shareText = `🛒 Заявка на товары
📦 ${items.length} товар${items.length > 1 ? 'ов' : ''}
💰 ${totalPrice.toLocaleString('ru-RU')} ₽

${items.map(item => {
  let itemText = `• ${item.name} - ${item.quantity} шт.${item.is_on_request ? ' (цена по запросу)' : ` × ${item.price.toLocaleString('ru-RU')} ₽`}`
  
  // Добавляем конфигурацию, если есть
  if (item.configuration && Object.keys(item.configuration).length > 0) {
    const configText = Object.values(item.configuration)
      .map(config => config.value_name)
      .join(', ')
    itemText += `\n  Конфигурация: ${configText}`
  }
  
  return itemText
}).join('\n')}

Хочу оформить заказ на эти товары.`

    // Проверяем поддержку Web Share API
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Заявка на товары',
          text: shareText,
        })
        toast.success('Заявка отправлена!')
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

  const handleConsultationClick = () => {
    const message = `Здравствуйте! Меня интересует консультация по следующим товарам:\n\n${items.map(item => {
      let itemText = `• ${item.name} - ${item.quantity} шт.${item.is_on_request ? ' (цена по запросу)' : ` × ${item.price.toLocaleString('ru-RU')} ₽`}`
      
      // Добавляем конфигурацию, если есть
      if (item.configuration && Object.keys(item.configuration).length > 0) {
        const configText = Object.values(item.configuration)
          .map(config => config.value_name)
          .join(', ')
        itemText += `\n  Конфигурация: ${configText}`
      }
      
      return itemText
    }).join('\n')}\n\nОбщая стоимость: ${totalPrice.toLocaleString('ru-RU')} ₽\n\nМожете ли вы проконсультировать по данным товарам?`

    const whatsappUrl = `https://wa.me/79123456789?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  if (items.length === 0) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            {children}
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg bg-white/95 backdrop-blur-xl border-cyan-200/50 shadow-2xl shadow-cyan-200/20">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-cyan-600" />
              Заявка
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-3xl p-12 text-center border border-cyan-200/30">
                <ClipboardList className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-slate-800 mb-4">
                  Заявка пуста
                </h3>
                <p className="text-slate-600 mb-6">
                  Добавьте товары в заявку для оформления заказа
                </p>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 hover:scale-[1.02]"
                >
                  Продолжить формирование заявки
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-white/95 backdrop-blur-xl border-cyan-200/50 shadow-2xl shadow-cyan-200/20 flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-cyan-700 to-blue-800 bg-clip-text text-transparent flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-cyan-600" />
              Заявка
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 text-sm">
                {items.length}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          {/* Товары в заявке */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-4">
              {items.map((item, index) => {
                const uniqueKey = `${item.id}-${index}`
                return (
                  <div key={uniqueKey} className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-2xl p-4 border border-cyan-200/30">
                    <div className="flex items-start gap-4">
                      {!imageErrors[uniqueKey] ? (
                        <SafeImage
                          src={item.image_url || PROSTHETIC_FALLBACK_IMAGE}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-xl object-cover border border-cyan-200/30 flex-shrink-0"
                          onError={() => setImageErrors(prev => ({ ...prev, [uniqueKey]: true }))}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 border border-cyan-200/30 flex-shrink-0 flex items-center justify-center">
                          <ClipboardList className="w-6 h-6 text-cyan-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-2">
                          {item.name}
                        </h4>
                        
                        {/* Отображаем конфигурацию */}
                        {item.configuration && Object.keys(item.configuration).length > 0 && (
                          <div className="mb-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(item.configuration).map(([groupId, config]) => (
                                <Badge 
                                  key={groupId} 
                                  variant="outline" 
                                  className="text-xs bg-cyan-50/80 border-cyan-200/50"
                                >
                                  {config.value_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Цена */}
                        <p className="text-lg font-bold text-cyan-600 mb-3">
                          {item.is_on_request ? 'По запросу' : `${item.price.toLocaleString('ru-RU')} ₽`}
                        </p>

                        {/* Количество и управление */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="w-8 h-8 p-0 bg-white/80 border-cyan-200/50 hover:bg-cyan-50 hover:border-cyan-300"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value)
                                if (!isNaN(val)) {
                                  handleQuantityChange(item.id, val)
                                }
                              }}
                              className="w-12 text-center font-semibold text-slate-800 bg-white/70 border border-cyan-200/50 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-300"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="w-8 h-8 p-0 bg-white/80 border-cyan-200/50 hover:bg-cyan-50 hover:border-cyan-300"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="w-8 h-8 p-0 bg-white/80 border-slate-200/50 hover:bg-slate-50 hover:border-slate-300 text-slate-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Итоги и действия */}
          <div className="border-t border-cyan-200/30 pt-4 space-y-4">
            {/* Итоговая сумма */}
            <div className="bg-gradient-to-r from-cyan-50/50 to-blue-50/40 backdrop-blur-sm rounded-2xl p-4 border border-cyan-200/30">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-800">Итого:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {totalPrice.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="space-y-3">
              <Button
                onClick={handleOrderClick}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 transition-all duration-300 shadow-lg shadow-cyan-200/30 hover:shadow-xl hover:shadow-cyan-300/40 hover:scale-[1.02] py-3"
              >
                <Phone className="w-4 h-4 mr-2" />
                Оформить заказ
              </Button>

              <Button
                onClick={handleConsultationClick}
                variant="outline"
                className="w-full bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 hover:border-green-300 transition-all duration-300 shadow-sm hover:shadow-md py-3"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Консультация в WhatsApp
              </Button>

              {/* Кнопка поделиться заявкой - показываем только если есть товары */}
              {items.length > 0 && (
                isWebShareSupported() ? (
                  <Button
                    onClick={shareCart}
                    variant="outline"
                    className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md py-3"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Поделиться заявкой
                  </Button>
                ) : (
                  <Button
                    onClick={shareCart}
                    variant="outline"
                    className="w-full bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 hover:border-green-300 transition-all duration-300 shadow-sm hover:shadow-md py-3"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Отправить в WhatsApp
                  </Button>
                )
              )}

              <Button
                onClick={clearCart}
                variant="outline"
                className="w-full bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700 hover:from-slate-100 hover:to-slate-200 hover:border-slate-300 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Очистить заявку
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Форма заказа */}
      <OrderForm
        isOpen={showOrderForm}
        onClose={() => setShowOrderForm(false)}
        items={items}
        totalPrice={totalPrice}
        onOrderComplete={handleOrderComplete}
      />
    </>
  )
}