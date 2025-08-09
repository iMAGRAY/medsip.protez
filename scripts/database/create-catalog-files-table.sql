-- Создание таблицы для хранения файлов каталогов
CREATE TABLE IF NOT EXISTS catalog_files (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    is_active BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_catalog_files_year ON catalog_files(year);
CREATE INDEX IF NOT EXISTS idx_catalog_files_active ON catalog_files(is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_files_created_at ON catalog_files(created_at);

-- Комментарии к таблице и столбцам
COMMENT ON TABLE catalog_files IS 'Таблица для хранения файлов каталогов';
COMMENT ON COLUMN catalog_files.title IS 'Название каталога';
COMMENT ON COLUMN catalog_files.description IS 'Описание каталога';
COMMENT ON COLUMN catalog_files.file_url IS 'URL файла каталога';
COMMENT ON COLUMN catalog_files.file_name IS 'Оригинальное имя файла';
COMMENT ON COLUMN catalog_files.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN catalog_files.file_type IS 'MIME тип файла';
COMMENT ON COLUMN catalog_files.year IS 'Год каталога';
COMMENT ON COLUMN catalog_files.is_active IS 'Активность каталога';
COMMENT ON COLUMN catalog_files.download_count IS 'Количество скачиваний';
COMMENT ON COLUMN catalog_files.created_by IS 'ID пользователя, создавшего запись'; 