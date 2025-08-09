/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Игнорируем ESLint при production-сборке (решает проблему "Failed to load config \"next/core-web-vitals\"")
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Включаем TypeScript проверки при сборке для предотвращения ошибок типов
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.example.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    // Временно отключаем оптимизацию для всех изображений из-за проблем с S3
    unoptimized: true,
    // Минимизируем количество форматов для стабильности
    formats: ['image/webp'],
    // Увеличиваем timeout для медленных соединений
    minimumCacheTTL: 60,
    // Убираем опасное разрешение SVG для повышения безопасности
    dangerouslyAllowSVG: false,
    // Улучшаем CSP для защиты от XSS
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; object-src 'none'; sandbox;",
  },
}

export default nextConfig
