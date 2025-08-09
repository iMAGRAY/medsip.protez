# Project TODO

## Бэкап
- [ ] Заполнить `.env.local` / `database.env`
- [ ] Выполнить `node scripts/database/backup-full.js`
- [ ] Проверить артефакты в `database/backups/`

## Зависимости и качество кода
- [ ] npm ci
- [ ] npm run lint && npm run lint:fix
- [ ] npm run type-check
- [ ] npm run format
- [ ] depcheck: удалить неиспользуемые пакеты
- [ ] ts-prune: удалить мёртвые экспортируемые символы

## Безопасность
- [ ] Проверить отсутствие хардкодов (паролей/хостов)
- [ ] Обновить `.env.example`
- [ ] Проверить CSP и настройки `next.config.mjs`

## Тестирование
- [ ] node tests/run-all-tests.js
- [ ] Добавить недостающие тесты для всех API роутов
- [ ] Нагрузочные/профилирование критичных запросов к БД

## БД и миграции
- [ ] Проверить `/api/db-status`
- [ ] Применить необходимые миграции
- [ ] Сверить схему с `tests/database_schema.sql`

## Кэш/Redis
- [ ] Проверить `/api/cache-status` и `/api/redis-status`
- [ ] Выстроить TTL и инвалидацию ключей

## CI/CD
- [ ] Добавить GitHub Actions workflow: build/lint/type-check/tests
- [ ] Сбор артефактов тестов и покрытия

## Документация
- [ ] Обновить README разделы запуска/переменные/бэкап
- [ ] Документировать restore процедуру