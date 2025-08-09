"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"

const HeroVideo = () => {
  const [videoError, setVideoError] = useState(false)
  const [isSlowConnection, setIsSlowConnection] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Проверка только на очень медленное соединение для fallback
  useEffect(() => {
    const checkSlowConnection = () => {
      // Проверка на медленное соединение
      const isSlowConn = 'connection' in navigator &&
        ((navigator as any).connection.effectiveType === '2g' ||
        (navigator as any).connection.saveData === true)

      setIsSlowConnection(isSlowConn)
    }

    checkSlowConnection()
  }, [])

  // Отслеживание скролла для эффекта параллакса
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Автоматический запуск видео при загрузке
  useEffect(() => {
    let loadTimeout: NodeJS.Timeout | undefined;

    if (videoRef.current && !isSlowConnection) {
      const video = videoRef.current;

      // Устанавливаем таймаут для проверки загрузки видео
      loadTimeout = setTimeout(() => {
        if (!isVideoLoaded) {
          setVideoError(true)
        }
      }, 10000) // Увеличиваем время ожидания для мобильных сетей

      // Пытаемся воспроизвести видео
      const attemptPlay = () => {
        const playPromise = video.play()

        if (playPromise !== undefined) {
          playPromise
            .then(() => {

              setIsVideoLoaded(true)
              if (loadTimeout) clearTimeout(loadTimeout)
            })
            .catch((error) => {

              // Не сразу показываем ошибку, пользователь может кликнуть
              setTimeout(() => {
                setVideoError(true)
                if (loadTimeout) clearTimeout(loadTimeout)
              }, 1000)
            })
        }
      }

      // Пытаемся воспроизвести сразу, если видео готово
      if (video.readyState >= 3) {
        attemptPlay()
      }

      // Также слушаем событие canplay
      const handleCanPlay = () => attemptPlay()
      video.addEventListener('canplay', handleCanPlay)

      return () => {
        video.removeEventListener('canplay', handleCanPlay)
        if (loadTimeout) clearTimeout(loadTimeout)
      }
    } else if (isSlowConnection) {
      // Если очень медленное соединение, показываем статичное изображение
      setVideoError(true)
    }

    // Возвращаем пустую функцию очистки для остальных случаев
    return () => {}
  }, [isSlowConnection, isVideoLoaded])

  // Fallback SVG как data URL - используем его как основной fallback
  const fallbackSVG = `data:image/svg+xml;base64,${Buffer.from(`
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E0F2F7;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#87CEEB;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#5F9EA0;stop-opacity:0.9" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bgGradient)"/>
    </svg>
  `).toString('base64')}`
  
  // Используем SVG fallback напрямую вместо несуществующего файла
  const staticImageUrl = fallbackSVG

  // Используем fallback для медленного соединения или при ошибке видео
  if (videoError || isSlowConnection) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={staticImageUrl}
          alt="Семья с протезом идет вместе"
          className="relative w-full h-full object-cover transition-transform duration-75 ease-out
            sm:object-center object-left-center"
          style={{
            transform: `translateY(${scrollY * 0.1}px)`,
            objectPosition: 'left center'
          }}
          // No onError handler needed since we're already using the SVG fallback
        />

        {/* Добавляем медиа-запрос для точного позиционирования fallback */}
        <style jsx>{`
          @media (max-width: 640px) {
            img {
              object-position: left center !important;
            }
          }
          @media (min-width: 641px) {
            img {
              object-position: center center !important;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <video
        ref={videoRef}
        className="relative w-full h-full object-cover transition-transform duration-75 ease-out
          sm:object-center object-left-center"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
          objectPosition: 'left center',
          WebkitTransform: `translateY(${scrollY * 0.1}px)` // Для Safari
        }}
        autoPlay
        muted
        loop
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        preload="auto"
        controls={false}
        disablePictureInPicture
        poster={staticImageUrl}
        onError={() => setVideoError(true)}
        onLoadedData={() => {
          // Более надежный способ запуска для мобильных устройств
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsVideoLoaded(true)
            }).catch(() => {
              // Не устанавливаем ошибку сразу, даем еще шанс
              setTimeout(() => {
                if (videoRef.current && videoRef.current.paused) {
                  setVideoError(true)
                }
              }, 2000)
            })
          }
        }}
        onCanPlayThrough={() => setIsVideoLoaded(true)}
      >
        <source src="/hero.webm" type="video/webm" />
        <source src="/hero.mp4" type="video/mp4" />
        Ваш браузер не поддерживает видео.
      </video>

      {/* Добавляем медиа-запрос для точного позиционирования */}
      <style jsx>{`
        @media (max-width: 640px) {
          video {
            object-position: left center !important;
          }
        }
        @media (min-width: 641px) {
          video {
            object-position: center center !important;
          }
        }
      `}</style>
    </div>
  )
}

export default HeroVideo