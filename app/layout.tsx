import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SkeletonProvider } from "@/components/skeleton-provider"
import { InstantNavigationProvider } from "@/components/instant-navigation-provider"
import { CartProvider } from "@/lib/cart-context"
import { OrdersProvider } from "@/lib/orders-context"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "МедСИП - Медицинские протезы и ортопедические изделия",
  description: "Протезирование, ортопедические изделия, медицинские товары. Качественные решения для восстановления здоровья.",
  keywords: "протезы, ортопедия, медицинские изделия, протезирование, реабилитация",
  icons: {
    icon: [
      {
        url: '/Logo.webp',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/dark_logo.webp',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Обработчик ошибок загрузки чанков
              window.addEventListener('error', function(event) {
                if (event.message && event.message.includes('ChunkLoadError')) {
                  console.warn('ChunkLoadError detected, reloading page...');
                  window.location.reload();
                }
              });

              // Обработчик необработанных промисов
              window.addEventListener('unhandledrejection', function(event) {
                if (event.reason && event.reason.name === 'ChunkLoadError') {
                  console.warn('ChunkLoadError in promise, reloading page...');
                  event.preventDefault();
                  window.location.reload();
                }
              });
            `,
          }}
        />
      </head>
      <body className={`${inter.className} notion-page`}>
        <OrdersProvider>
        <CartProvider>
          <InstantNavigationProvider>
            <SkeletonProvider>
              {children}
              <Toaster position="top-right" />
            </SkeletonProvider>
          </InstantNavigationProvider>
        </CartProvider>
        </OrdersProvider>
      </body>
    </html>
  )
}
