// Утилиты для вычисления хеша файлов

/**
 * Вычисляет SHA-256 хеш файла на клиенте (в браузере)
 */
export async function calculateFileHashClient(file: File): Promise<string> {
  // Проверяем поддержку SubtleCrypto API
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('SubtleCrypto API не поддерживается в этом браузере');
  }

  try {
    // Читаем файл как ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Вычисляем SHA-256 хеш
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    // Конвертируем в hex строку
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('Ошибка при вычислении хеша файла:', error);
    throw new Error('Не удалось вычислить хеш файла');
  }
}

/**
 * Вычисляет SHA-256 хеш файла на сервере (Node.js)
 */
export function calculateFileHashServer(buffer: Buffer): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Вычисляет SHA-256 хеш файла по URL (для сервера)
 */
export async function calculateFileHashFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return calculateFileHashServer(buffer);
  } catch (error) {
    console.error('Ошибка при вычислении хеша по URL:', error);
    throw new Error('Не удалось вычислить хеш файла по URL');
  }
}

/**
 * Получает метаданные изображения (размеры)
 */
export async function getImageMetadata(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    // Проверяем, что это изображение
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Получает расширение файла из имени
 */
export function getFileExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ? `.${ext}` : '';
}

/**
 * Генерирует уникальный ключ для S3 на основе хеша и расширения
 */
export function generateS3KeyFromHash(hash: string, extension: string, folder = 'products'): string {
  // Используем первые 2 символа хеша для создания подпапки (распределение нагрузки)
  const subFolder = hash.substring(0, 2);
  return `${folder}/${subFolder}/${hash}${extension}`;
}

/**
 * Создает объект метаданных файла
 */
export interface FileMetadata {
  hash: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadedAt: Date;
}

export async function createFileMetadata(file: File, hash?: string): Promise<FileMetadata> {
  const calculatedHash = hash || await calculateFileHashClient(file);
  const imageMetadata = await getImageMetadata(file);

  return {
    hash: calculatedHash,
    originalName: file.name,
    extension: getFileExtension(file.name),
    size: file.size,
    mimeType: file.type,
    width: imageMetadata?.width,
    height: imageMetadata?.height,
    uploadedAt: new Date()
  };
}

/**
 * Форматирует размер файла для отображения
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Типы для работы с дубликатами
 */
export interface DuplicateFileInfo {
  id: number;
  s3_url: string;
  original_name: string;
  file_size: number;
  upload_count: number;
  first_uploaded_at: Date;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFile?: DuplicateFileInfo;
  hash: string;
  metadata: FileMetadata;
}