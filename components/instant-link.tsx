"use client"

import { useInstantNavigation } from './instant-navigation-provider'
import { ReactNode, MouseEvent } from 'react'

interface InstantLinkProps {
  href: string
  children: ReactNode
  className?: string
  replace?: boolean
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  prefetch?: boolean
}

export function InstantLink({
  href,
  children,
  className = '',
  replace = false,
  onClick,
  prefetch = true,
  ...props
}: InstantLinkProps) {
  const { navigate } = useInstantNavigation()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

    if (onClick) {
      onClick(e)
    }

    navigate(href, { replace })
  }

  const handleMouseEnter = () => {
    if (prefetch && typeof window !== 'undefined') {
      // Простая предзагрузка через создание link элемента
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = href
      document.head.appendChild(link)

      // Удаляем через 5 секунд
      setTimeout(() => {
        if (document.head.contains(link)) {
          document.head.removeChild(link)
        }
      }, 5000)
    }
  }

  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </a>
  )
}