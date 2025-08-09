const fs = require('fs');
const path = require('path');

// Создаем SVG логотип для МедСИП Протезирование
const logoSVG = `<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="medGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="sipGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#047857;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Медицинский крест -->
  <g transform="translate(10, 15)">
    <circle cx="15" cy="15" r="14" fill="url(#medGradient)" stroke="#ffffff" stroke-width="1"/>
    <rect x="12" y="8" width="6" height="14" fill="white" rx="1"/>
    <rect x="8" y="12" width="14" height="6" fill="white" rx="1"/>
  </g>

  <!-- Протез символ -->
  <g transform="translate(35, 18)">
    <path d="M0 12 Q6 0 12 12 Q18 24 24 12" stroke="url(#sipGradient)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="6" cy="12" r="2" fill="url(#sipGradient)"/>
    <circle cx="18" cy="12" r="2" fill="url(#sipGradient)"/>
  </g>

  <!-- Текст МедСИП -->
  <text x="70" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1f2937">
    МедСИП
  </text>

  <!-- Текст Протезирование -->
  <text x="70" y="42" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
    Протезирование
  </text>
</svg>`;

// Создаем темную версию логотипа
const darkLogoSVG = `<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="medGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="sipGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#34d399;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Медицинский крест -->
  <g transform="translate(10, 15)">
    <circle cx="15" cy="15" r="14" fill="url(#medGradientDark)" stroke="#374151" stroke-width="1"/>
    <rect x="12" y="8" width="6" height="14" fill="#1f2937" rx="1"/>
    <rect x="8" y="12" width="14" height="6" fill="#1f2937" rx="1"/>
  </g>

  <!-- Протез символ -->
  <g transform="translate(35, 18)">
    <path d="M0 12 Q6 0 12 12 Q18 24 24 12" stroke="url(#sipGradientDark)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="6" cy="12" r="2" fill="url(#sipGradientDark)"/>
    <circle cx="18" cy="12" r="2" fill="url(#sipGradientDark)"/>
  </g>

  <!-- Текст МедСИП -->
  <text x="70" y="25" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f9fafb">
    МедСИП
  </text>

  <!-- Текст Протезирование -->
  <text x="70" y="42" font-family="Arial, sans-serif" font-size="12" fill="#d1d5db">
    Протезирование
  </text>
</svg>`;

// Сохраняем логотипы
const publicDir = path.join(__dirname, '..', 'public');

// Создаем папку public если её нет
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Сохраняем светлый логотип
fs.writeFileSync(path.join(publicDir, 'logo.svg'), logoSVG);
// Сохраняем темный логотип
fs.writeFileSync(path.join(publicDir, 'dark_logo.svg'), darkLogoSVG);