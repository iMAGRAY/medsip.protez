const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Генерируем сложный пароль
function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Гарантируем наличие разных типов символов
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Заглавная
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Строчная
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Цифра
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Спецсимвол

    // Добавляем остальные символы
    for (let i = 4; i < 24; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Перемешиваем пароль
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Генерируем JWT секрет
function generateJWTSecret() {
    return crypto.randomBytes(64).toString('hex');
}

function setupAdminCredentials() {
    try {
        const envPath = path.join(process.cwd(), '.env.local');

        // Читаем существующий .env.local
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        } else {
        }

        // Удаляем старые admin настройки построчно
        const lines = envContent.split('\n');
        const filteredLines = lines.filter(line => {
            return !line.includes('Admin Authentication') &&
                   !line.startsWith('ADMIN_USERNAME=') &&
                   !line.startsWith('ADMIN_PASSWORD=') &&
                   !line.startsWith('JWT_SECRET=') &&
                   !line.startsWith('SESSION_SECRET=') &&
                   !line.startsWith('BCRYPT_ROUNDS=') &&
                   !line.startsWith('SESSION_TIMEOUT=') &&
                   !line.startsWith('RATE_LIMIT_WINDOW=') &&
                   !line.startsWith('RATE_LIMIT_MAX=');
        });

        // Генерируем безопасные данные
        const adminUsername = 'medsip_admin';
        const adminPassword = generateSecurePassword();
        const jwtSecret = generateJWTSecret();
        const sessionSecret = generateJWTSecret();

        // Добавляем новые admin настройки
        filteredLines.push('');
        filteredLines.push('# Admin Authentication - SECURE CREDENTIALS');
        filteredLines.push(`ADMIN_USERNAME=${adminUsername}`);
        filteredLines.push(`ADMIN_PASSWORD=${adminPassword}`);
        filteredLines.push(`JWT_SECRET=${jwtSecret}`);
        filteredLines.push(`SESSION_SECRET=${sessionSecret}`);
        filteredLines.push('');
        filteredLines.push('# Security Settings');
        filteredLines.push('BCRYPT_ROUNDS=12');
        filteredLines.push('SESSION_TIMEOUT=3600000');
        filteredLines.push('RATE_LIMIT_WINDOW=900000');
        filteredLines.push('RATE_LIMIT_MAX=100');

        const newEnvContent = filteredLines.join('\n');

        // Записываем файл
        fs.writeFileSync(envPath, newEnvContent);
        console.log('   - JWT секрет: 128 символов (скрыт)');
        console.log('   - Session секрет: 128 символов (скрыт)');
        // Создаем backup с timestamp
        const backupPath = path.join(process.cwd(), `.env.local.backup.${Date.now()}`);
        fs.copyFileSync(envPath, backupPath);
    } catch (error) {
        console.error('❌ Ошибка при настройке учетных данных:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Запускаем скрипт
setupAdminCredentials();