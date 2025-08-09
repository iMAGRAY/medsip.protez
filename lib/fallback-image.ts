// Fallback image for MedSIP (broken image icon)
export const PROSTHETIC_FALLBACK_IMAGE = `data:image/svg+xml;base64,${Buffer.from(String.raw`
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" role="img" aria-labelledby="title desc">
    <title>MedSIP — изображение недоступно</title>
    <desc>Логотип MedSIP и иконка сломанного изображения как заполнитель.</desc>

    <defs>
      <!-- Фон -->
      <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f0f9ff"/>
        <stop offset="55%" stop-color="#e0f2fe"/>
        <stop offset="100%" stop-color="#cfeafe"/>
      </linearGradient>
      <!-- Градиент рамки/иконки -->
      <linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0891b2"/>
        <stop offset="100%" stop-color="#0e7490"/>
      </linearGradient>
      <!-- Градиент логотипа -->
      <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0891b2"/>
        <stop offset="100%" stop-color="#0e7490"/>
      </linearGradient>
      <filter id="iconShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
        <feOffset dy="3"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Фон -->
    <rect width="400" height="300" fill="url(#bgGradient)"/>

    <!-- Лёгкий декор -->
    <g opacity="0.16" fill="#0891b2">
      <circle cx="60" cy="60" r="44"/>
    </g>
    <g opacity="0.10" fill="#06b6d4">
      <circle cx="350" cy="250" r="60"/>
    </g>

    <!-- Иконка "сломанное изображение" -->
    <g transform="translate(200 120)" filter="url(#iconShadow)">
      <!-- Рамка -->
      <rect x="-70" y="-50" width="140" height="100" rx="12" fill="#ffffff" stroke="url(#frameGrad)" stroke-width="3"/>
      <!-- Внутренний плейсхолдер (гора + солнце) с "разрывом" -->
      <clipPath id="clipHole">
        <rect x="-58" y="-38" width="116" height="76" rx="8"/>
      </clipPath>
      <g clip-path="url(#clipHole)">
        <!-- Условный фон -->
        <rect x="-58" y="-38" width="116" height="76" fill="#e6f6fb"/>
        <!-- Ломаная линия (треснувшее) -->
        <path d="M-58 24 L-30 -5 L-8 10 L18 -18 L40 4 L58 -12" fill="none" stroke="#0e7490" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
        <!-- "Горы" -->
        <path d="M-36 24 L-14 -4 L10 20 L-36 20 Z" fill="url(#frameGrad)" opacity=".28"/>
        <path d="M-5 24 L18 2 L40 24 Z" fill="url(#frameGrad)" opacity=".20"/>
        <!-- Солнце -->
        <circle cx="33" cy="-12" r="10" fill="url(#frameGrad)" opacity=".55"/>
        <!-- Крест/икс символизирующий недоступность -->
        <g stroke="url(#frameGrad)" stroke-width="5" stroke-linecap="round" opacity=".75">
          <line x1="-20" y1="-22" x2="0" y2="-2"/>
          <line x1="0" y1="-22" x2="-20" y2="-2"/>
        </g>
      </g>
      <!-- Маленький уголок «оторван» (эффект) -->
      <path d="M52 -50h18v18c-10-4-14-8-18-18z" fill="#ffffff" stroke="url(#frameGrad)" stroke-width="3"/>
    </g>

    <!-- Логотип -->
    <text x="200" y="238"
          font-family="Arial, sans-serif"
          font-size="38"
          font-weight="700"
          text-anchor="middle"
          fill="url(#brandGrad)"
          letter-spacing="0.5">
      MedSIP
    </text>

    <!-- Подпись -->
    <text x="200" y="268"
          font-family="Arial, sans-serif"
          font-size="14"
          font-weight="500"
          text-anchor="middle"
          fill="#0e7490"
          opacity="0.7">
      Изображение недоступно
    </text>
  </svg>
  `.trim()).toString('base64')}`;

  export const getFallbackImage = (width = 400, height = 300) => PROSTHETIC_FALLBACK_IMAGE;
