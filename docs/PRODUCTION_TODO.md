# Production TODO

- [ ] Полный бэкап БД: `npm run db:backup`
- [ ] Проверка соединений: `/api/health`, `/api/db-status`, `npm run redis:test`
- [ ] Линт: `npm run lint` (исправить ошибки хуков и no-unescaped-entities)
- [ ] Тип-чек: `npm run type-check`
- [ ] Сборка: `npm run build`
- [ ] Тесты API: `npm test` и `npm run test:e2e`
- [ ] Миграции: `npm run db:migrate`
- [ ] Security audit: `npm run security:check`
- [ ] Очистка хардкодов/секретов в репозитории
- [ ] Обновить `.env.example` и развернуть `.env.production`