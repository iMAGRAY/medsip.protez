
## Database Backup

Полный бэкап PostgreSQL:

```bash
node scripts/database/backup-full.js
```

Скрипт создаёт файлы в `database/backups/`: `.sql`, `.dump`, `.json` и исполняемый restore-скрипт.

Требуются переменные окружения: `DATABASE_URL` или `POSTGRESQL_*`.