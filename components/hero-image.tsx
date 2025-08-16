"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

const HeroImage = () => {
  const [imageError, setImageError] = useState(false)
  const [backImageError, setBackImageError] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  // Отслеживание скролла для эффекта параллакса
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fallback SVG как data URL
  const fallbackSVG = `data:image/svg+xml;base64,${Buffer.from(`
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#E0F6FF;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#90EE90;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#228B22;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Небо -->
      <rect width="1200" height="500" fill="url(#skyGradient)"/>

      <!-- Земля -->
      <rect y="500" width="1200" height="300" fill="url(#groundGradient)"/>

      <!-- Солнце -->
      <circle cx="1000" cy="150" r="80" fill="#FFD700"/>

      <!-- Семья -->
      <g transform="translate(400, 400)">
        <!-- Папа с протезом -->
        <rect x="-15" y="0" width="30" height="80" fill="#4A90E2" rx="5"/>
              <circle cx="0" cy="-20" r="18" fill="#D1D5DB"/>
      <rect x="-35" y="10" width="20" height="50" fill="#D1D5DB" rx="10"/>
      <rect x="15" y="10" width="20" height="50" fill="#D1D5DB" rx="10"/>
        <rect x="-20" y="80" width="15" height="60" fill="#2C3E50" rx="7"/>
        <rect x="5" y="80" width="15" height="60" fill="#C0C0C0" rx="7"/>
      </g>

      <g transform="translate(500, 410)">
        <!-- Мама -->
        <rect x="-12" y="0" width="24" height="70" fill="#E74C3C" rx="5"/>
              <circle cx="0" cy="-18" r="16" fill="#D1D5DB"/>
      <rect x="-30" y="15" width="18" height="45" fill="#D1D5DB" rx="9"/>
      <rect x="12" y="15" width="18" height="45" fill="#D1D5DB" rx="9"/>
        <rect x="-15" y="70" width="12" height="55" fill="#2C3E50" rx="6"/>
        <rect x="3" y="70" width="12" height="55" fill="#2C3E50" rx="6"/>
      </g>

      <g transform="translate(580, 450)">
        <!-- Ребенок 1 -->
        <rect x="-10" y="0" width="20" height="50" fill="#27AE60" rx="4"/>
              <circle cx="0" cy="-12" r="12" fill="#D1D5DB"/>
      <rect x="-22" y="8" width="12" height="30" fill="#D1D5DB" rx="6"/>
      <rect x="10" y="8" width="12" height="30" fill="#D1D5DB" rx="6"/>
        <rect x="-12" y="50" width="10" height="40" fill="#2C3E50" rx="5"/>
        <rect x="2" y="50" width="10" height="40" fill="#2C3E50" rx="5"/>
      </g>

      <g transform="translate(650, 470)">
        <!-- Ребенок 2 -->
        <rect x="-8" y="0" width="16" height="40" fill="#F39C12" rx="3"/>
              <circle cx="0" cy="-10" r="10" fill="#D1D5DB"/>
      <rect x="-18" y="5" width="10" height="25" fill="#D1D5DB" rx="5"/>
      <rect x="8" y="5" width="10" height="25" fill="#D1D5DB" rx="5"/>
        <rect x="-10" y="40" width="8" height="30" fill="#2C3E50" rx="4"/>
        <rect x="2" y="40" width="8" height="30" fill="#2C3E50" rx="4"/>
      </g>

      <!-- Текст -->
      <text x="600" y="750" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#2C3E50">
        Семья идет вместе по жизни
      </text>
    </svg>
  `).toString('base64')}`

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Фоновый слой - медленное движение */}
      {!backImageError && (
        <Image
          src="/images/hero-family_back.webp"
          alt="Фон семьи"
          fill
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-75 ease-out"
          style={{
            transform: `translateY(${scrollY * 0.3}px) scale(1.1)`,
          }}
          onError={() => setBackImageError(true)}
        />
      )}

      {/* Основной слой - быстрое движение */}
      <Image
        src={imageError ? fallbackSVG : "/images/hero-family.webp"}
        alt="Семья с протезом идет вместе"
        fill
        className="relative w-full h-full object-contain transition-transform duration-75 ease-out"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
        onError={() => setImageError(true)}
      />
    </div>
  )
}

export default HeroImage