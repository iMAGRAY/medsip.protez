#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()

function listFiles(dir) {
  const res = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name)
    if (entry.isDirectory()) res.push(...listFiles(fp))
    else if (entry.isFile() && fp.endsWith('.tsx')) res.push(fp)
  }
  return res
}

function fixFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  // Find directive lines exactly
  const lines = src.split(/\r?\n/)
  const directiveRegex = /^\s*['"]use client['"]\s*;?\s*$/
  let directiveFound = false
  const kept = []
  for (const ln of lines) {
    if (directiveRegex.test(ln)) {
      directiveFound = true
      continue
    }
    kept.push(ln)
  }
  if (!directiveFound) return false

  const newText = ['"use client"', ...kept].join('\n')
  if (newText === src) return false
  fs.writeFileSync(filePath, newText, 'utf8')
  return true
}

function main() {
  const targets = [path.join(ROOT, 'app'), path.join(ROOT, 'components')]
  let changed = 0
  for (const dir of targets) {
    if (!fs.existsSync(dir)) continue
    const files = listFiles(dir)
    for (const f of files) {
      try {
        if (fixFile(f)) { changed++ }
      } catch (e) {
        // ignore
      }
    }
  }
  console.log(`✅ use client fix complete. Files changed: ${changed}`)
}

main()