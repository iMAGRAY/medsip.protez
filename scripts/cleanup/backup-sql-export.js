#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const tablesArg = process.argv.slice(2)
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
const outDir = path.join(process.cwd(), 'database', 'backups')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const outFile = path.join(outDir, `export-${tablesArg.length ? tablesArg.join('_') : 'full'}-${TS}.sql`)

const useUrl = !!process.env.DATABASE_URL
const baseCmd = ['pg_dump', '--no-owner', '--no-acl', '--verbose']

if (useUrl) {
  baseCmd.push(`"${process.env.DATABASE_URL}"`)
} else {
  const { POSTGRESQL_HOST, POSTGRESQL_PORT = '5432', POSTGRESQL_USER, POSTGRESQL_DBNAME, POSTGRESQL_PASSWORD } = process.env
  if (!POSTGRESQL_HOST || !POSTGRESQL_USER || !POSTGRESQL_DBNAME) {
    console.error('❌ Укажите DATABASE_URL или POSTGRESQL_*')
    process.exit(1)
  }
  process.env.PGPASSWORD = POSTGRESQL_PASSWORD || ''
  baseCmd.unshift('-d', POSTGRESQL_DBNAME)
  baseCmd.unshift('-U', POSTGRESQL_USER)
  baseCmd.unshift('-p', POSTGRESQL_PORT)
  baseCmd.unshift('-h', POSTGRESQL_HOST)
}

if (tablesArg.length) {
  for (const t of tablesArg) {
    baseCmd.push('-t', t)
  }
}

baseCmd.push('--file', outFile)

try {
  execSync(baseCmd.join(' '), { stdio: 'inherit', shell: true })
  console.log(`✅ Экспорт создан: ${outFile}`)
} catch (e) {
  console.error('❌ Экспорт не был создан', e.message)
  process.exit(1)
}