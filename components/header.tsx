"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X, Phone, Mail, MapPin, ClipboardList } from "lucide-react"
import { useAdminStore } from "@/lib/admin-store"
import { AdditionalContacts } from "@/components/additional-contacts"
import { InstantLink } from "@/components/instant-link"
import { CartDrawer } from "@/components/cart-drawer"
import { useCart } from "@/lib/cart-context"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { SafeImage } from "@/components/safe-image"

  // Безопасный компонент списка
function SafeCartButton() {
  const [isClient, setIsClient] = useState(false)
  const cart = useCart()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const totalItems = cart?.totalItems ?? 0

  if (!isClient) {
    return (
      <Button
        variant="outline"
        className="relative bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300 shadow-sm hover:shadow-md p-3"
      >
        <ClipboardList className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <CartDrawer>
      <Button
        variant="outline"
        id="cart-button"
        className="relative bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300 shadow-sm hover:shadow-md p-3"
      >
        <ClipboardList className="w-5 h-5" />
        {totalItems > 0 && (
          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 text-xs min-w-[20px] h-5 flex items-center justify-center p-0">
            {totalItems}
          </Badge>
        )}
      </Button>
    </CartDrawer>
  )
}

export default function Header() {
  const { siteSettings } = useAdminStore()
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const navLinks = [
    { href: "#contact", label: "Контакты" },
  ]

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsContactModalOpen(true)
    // Закрываем боковое меню при открытии модального окна контактов
    setIsSheetOpen(false)
  }

  // Функция для обработки открытия/закрытия бокового меню
  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    // Закрываем модальное окно контактов при открытии бокового меню
    if (open) {
      setIsContactModalOpen(false)
    }
  }

  return (
    <>
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl border-b bg-white/90 border-cyan-200/40 shadow-sm shadow-cyan-100/20">
      <div className="container flex items-center h-16 mx-auto px-2 sm:px-6">
        {/* Левая часть - Логотип */}
        <div className="flex-1 flex justify-start">
          <InstantLink href="/" className="flex items-center gap-3 transition-all duration-200 hover:opacity-80">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              <SafeImage src="/logo.webp" alt="МедСИП Протезирование" width={28} height={28} className="h-7 w-auto max-w-none dark:hidden" />
              <SafeImage src="/dark_logo.webp" alt="МедСИП Протезирование" width={28} height={28} className="h-7 w-auto max-w-none hidden dark:block" />
            </div>
            <span className="text-lg font-semibold text-slate-800 whitespace-nowrap">
              МедСИП&nbsp;<span className="hidden sm:inline">Протезирование</span>
            </span>
          </InstantLink>
        </div>

        {/* Центральная часть - пустая для баланса */}
        <div className="flex-1 hidden md:block"></div>

        {/* Правая часть - Контакты и Заявка */}
        <div className="flex-1 flex justify-end items-center gap-4">
          <nav className="hidden md:flex gap-6">
            {navLinks.map((link) => (
              link.href === "#contact" ? (
                <button
                  key={link.label}
                  onClick={handleContactClick}
                  className="relative px-4 py-2 text-slate-700 font-medium transition-all duration-300 hover:text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 rounded-lg group"
                >
                  {link.label}
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:w-full transition-all duration-300"></div>
                </button>
              ) : (
                <InstantLink
                  key={link.label}
                  href={link.href}
                  className="relative px-4 py-2 text-slate-700 font-medium transition-all duration-300 hover:text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 rounded-lg group"
                >
                  {link.label}
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:w-full transition-all duration-300"></div>
                </InstantLink>
              )
            ))}
          </nav>

                      {/* Заявка */}
          <SafeCartButton />

          {/* Мобильное меню */}
          <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden w-10 h-10 bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700 hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300 transition-all duration-300"
              >
                <Menu className="w-5 h-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xs bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/20 backdrop-blur-xl border-cyan-200/40">
              <nav className="grid gap-4 py-4">
                  <InstantLink href="/" className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                      <Image
                        src="/logo.webp"
                        alt="МедСИП Протезирование"
                        width={32}
                        height={32}
                        className="h-6 w-auto max-w-none dark:hidden"
                        style={{
                          filter: 'brightness(1) contrast(1.1)',
                          display: 'block'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/Logo.webp';
                        }}
                      />
                      <SafeImage src="/dark_logo.webp" alt="МедСИП Протезирование" width={24} height={24} className="h-6 w-auto max-w-none hidden dark:block" />
                    </div>
                    <span className="text-lg font-semibold text-slate-800">
                      МедСИП
                    </span>
                </InstantLink>
                {navLinks.map((link) => (
                  link.href === "#contact" ? (
                    <button
                      key={link.label}
                      onClick={(e) => {
                        handleContactClick(e);
                        setIsSheetOpen(false);
                      }}
                      className="text-left px-4 py-3 text-slate-700 font-medium transition-all duration-300 hover:text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 rounded-lg"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <InstantLink
                      key={link.label}
                      href={link.href}
                      className="text-left px-4 py-3 text-slate-700 font-medium transition-all duration-300 hover:text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 rounded-lg"
                    >
                      {link.label}
                    </InstantLink>
                  )
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      </header>

      {/* Contact Modal - тиффани стиль */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto">
          {/* Backdrop с красивым блюром */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-cyan-900/30 to-blue-900/40 backdrop-blur-md"
            onClick={() => setIsContactModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Фоновый градиент */}
            <div className="absolute inset-0 sm:inset-auto sm:w-full sm:h-full bg-gradient-to-br from-cyan-100/30 to-blue-100/40 rounded-3xl blur-sm"></div>

            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-cyan-200/20 w-full sm:max-w-lg p-6 sm:p-8 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto border border-cyan-200/50">
              {/* Close Button - увеличен размер и добавлен отступ для мобильных */}
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-3 sm:p-2 rounded-full bg-gradient-to-r from-cyan-100/50 to-blue-100/50 text-cyan-700 hover:from-cyan-200/50 hover:to-blue-200/50 transition-all duration-300 hover:scale-110 z-10"
              >
                <X className="w-6 h-6 sm:w-5 sm:h-5" />
              </button>

              {/* Header - добавлен отступ справа для кнопки закрытия */}
              <div className="text-center mb-6 sm:mb-8 pr-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                  Контакты
                </h2>
                <p className="text-slate-600">
                  Свяжитесь с нами любым удобным способом
                </p>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                {/* Phone */}
                <a href="tel:+74951326265" className="block">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-50/80 to-blue-50/60 border border-cyan-200/30 hover:from-cyan-100/80 hover:to-blue-100/60 hover:border-cyan-300/50 transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Телефон</p>
                      <p className="text-cyan-600 font-medium">
                        +7 495 132-62-65
                      </p>
                    </div>
                  </div>
                </a>

                {/* Email */}
                <a href="mailto:protez@medsip.ru" className="block">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-50/80 to-blue-50/60 border border-cyan-200/30 hover:from-cyan-100/80 hover:to-blue-100/60 hover:border-cyan-300/50 transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Email</p>
                      <p className="text-cyan-600 font-medium">
                        protez@medsip.ru
                      </p>
                    </div>
                  </div>
                </a>

                {/* Address */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-50/80 to-blue-50/60 border border-cyan-200/30">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Адрес</p>
                    <p className="text-cyan-600 font-medium">
                      121615, Москва, Рублевское ш., д. 26
                    </p>
                  </div>
                </div>

                {/* Additional Contacts */}
                {siteSettings?.additionalContacts && siteSettings.additionalContacts.length > 0 && (
                  <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-cyan-200/50">
                    <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
                      Дополнительные контакты
                    </h3>
                    <AdditionalContacts
                      contacts={siteSettings.additionalContacts}
                      className="space-y-3"
                      theme="light"
                    />
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
