const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const execAsync = promisify(exec)
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
require('dotenv').config({ path: path.join(process.cwd(), 'database.env') })

async function ensureBackupDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
}

function assertDbEnv() {
  const missing = []
  const required = [
    'POSTGRESQL_HOST',
    'POSTGRESQL_PORT',
    'POSTGRESQL_USER',
    'POSTGRESQL_PASSWORD',
    'POSTGRESQL_DBNAME',
  ]
  for (const key of required) {
    if (!process.env[key]) missing.push(key)
  }
  if (!process.env.DATABASE_URL && missing.length) {
    throw new Error(`Не найдены переменные окружения для бэкапа: ${missing.join(', ')}. Укажите DATABASE_URL либо POSTGRESQL_*`) 
  }
}

function buildPgDumpCmd({ sqlFile, dumpFile }) {
  // Предпочитаем DATABASE_URL, иначе собираем строку подключения
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL
    return {
      sql: `pg_dump --no-owner --no-acl --verbose --format=p --file "${sqlFile}" "${url}"`,
      dump: `pg_dump --no-owner --no-acl --verbose --format=c --file "${dumpFile}" "${url}"`,
    }
  }

  const host = process.env.POSTGRESQL_HOST
  const port = process.env.POSTGRESQL_PORT || '5432'
  const user = process.env.POSTGRESQL_USER
  const db   = process.env.POSTGRESQL_DBNAME

  return {
    sql: `pg_dump -h ${host} -p ${port} -U ${user} -d ${db} --no-owner --no-acl --verbose --format=p --file "${sqlFile}"`,
    dump: `pg_dump -h ${host} -p ${port} -U ${user} -d ${db} --no-owner --no-acl --verbose --format=c --file "${dumpFile}"`,
  }
}

async function run() {
  console.log('🔐 Full PostgreSQL backup starting...')
  assertDbEnv()

  const backupsDir = path.join(process.cwd(), 'database', 'backups')
  await ensureBackupDir(backupsDir)

  const ts = getTimestamp()
  const baseName = `full-backup-${ts}`
  const sqlFile = path.join(backupsDir, `${baseName}.sql`)
  const dumpFile = path.join(backupsDir, `${baseName}.dump`)
  const metaFile = path.join(backupsDir, `${baseName}.json`)

  const cmds = buildPgDumpCmd({ sqlFile, dumpFile })
  const env = { ...process.env }

  // Передаем пароль в pg_dump через PGPASSWORD, если доступен
  if (!env.DATABASE_URL && process.env.POSTGRESQL_PASSWORD) {
    env.PGPASSWORD = process.env.POSTGRESQL_PASSWORD
  }

  try {
    console.log('📝 Creating plain SQL dump...')
    await execAsync(cmds.sql, { env, shell: true })

    console.log('🗜️  Creating compressed dump (custom format)...')
    await execAsync(cmds.dump, { env, shell: true })

    const sqlStats = fs.statSync(sqlFile)
    const dumpStats = fs.statSync(dumpFile)

    const metadata = {
      timestamp: new Date().toISOString(),
      database: {
        url: process.env.DATABASE_URL ? 'DATABASE_URL' : undefined,
        host: process.env.POSTGRESQL_HOST,
        port: process.env.POSTGRESQL_PORT,
        name: process.env.POSTGRESQL_DBNAME,
        user: process.env.POSTGRESQL_USER,
        ssl: !!process.env.DATABASE_URL?.includes('sslmode=require')
      },
      artifacts: {
        sql: path.basename(sqlFile),
        dump: path.basename(dumpFile)
      },
      sizes: {
        sqlBytes: sqlStats.size,
        dumpBytes: dumpStats.size
      }
    }

    fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2))

    // Создаем удобный restore-скрипт
    const restoreScriptLines = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      '# Restore from compressed dump by default',
      'BACKUPS_DIR="$(cd "$(dirname "$0")" && pwd)"',
      `DUMP_FILE="$BACKUPS_DIR/${path.basename(dumpFile)}"`,
      `SQL_FILE="$BACKUPS_DIR/${path.basename(sqlFile)}"`,
      '',
      'if [ -z "${DATABASE_URL:-}" ]; then',
      '  if [ -z "${POSTGRESQL_HOST:-}" ] || [ -z "${POSTGRESQL_PORT:-}" ] || [ -z "${POSTGRESQL_USER:-}" ] || [ -z "${POSTGRESQL_DBNAME:-}" ]; then',
      '    echo "Missing connection env. Set DATABASE_URL or POSTGRESQL_*" >&2',
      '    exit 1',
      '  fi',
      'fi',
      '',
      'read -p "⚠️  This will overwrite data. Continue? (yes/no) " -r ANSWER',
      'if [[ ! "$ANSWER" =~ ^[Yy][Ee][Ss]$ ]]; then',
      '  echo "Canceled"',
      '  exit 1',
      'fi',
      '',
      'if command -v pg_restore >/dev/null 2>&1; then',
      '  echo "🔁 Restoring from custom dump: $DUMP_FILE"',
      '  if [ -n "${DATABASE_URL:-}" ]; then',
      '    pg_restore --clean --no-owner --no-acl --verbose --dbname "$DATABASE_URL" "$DUMP_FILE"',
      '  else',
      '    PGPASSWORD="${POSTGRESQL_PASSWORD:-}" pg_restore \\',
      '      -h "$POSTGRESQL_HOST" -p "$POSTGRESQL_PORT" -U "$POSTGRESQL_USER" \\',
      '      --clean --no-owner --no-acl --verbose --dbname "$POSTGRESQL_DBNAME" "$DUMP_FILE"',
      '  fi',
      'else',
      '  echo "pg_restore not found, falling back to psql and plain SQL"',
      '  if [ -n "${DATABASE_URL:-}" ]; then',
      '    psql "$DATABASE_URL" < "$SQL_FILE"',
      '  else',
      '    PGPASSWORD="${POSTGRESQL_PASSWORD:-}" psql \\',
      '      -h "$POSTGRESQL_HOST" -p "$POSTGRESQL_PORT" -U "$POSTGRESQL_USER" -d "$POSTGRESQL_DBNAME" < "$SQL_FILE"',
      '  fi',
      'fi',
      '',
      'echo "✅ Restore complete"'
    ]
    const restoreScript = restoreScriptLines.join('\n')

    const restoreFile = path.join(backupsDir, `${baseName}.restore.sh`)
    fs.writeFileSync(restoreFile, restoreScript, { mode: 0o755 })

    console.log('✅ Full backup complete:')
    console.log(`   SQL:  ${sqlFile}`)
    console.log(`   DUMP: ${dumpFile}`)
    console.log(`   META: ${metaFile}`)
    console.log(`   RESTORE: ${restoreFile}`)
  } catch (error) {
    console.error('❌ Full backup failed:', error.message)
    console.error('💡 Убедитесь что установлены клиентские утилиты PostgreSQL (pg_dump, pg_restore) и заданы .env переменные')
    process.exit(1)
  }
}

run()