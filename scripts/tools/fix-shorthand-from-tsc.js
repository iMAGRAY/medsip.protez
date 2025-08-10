#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function runTsc() {
  try {
    const out = execSync('npx tsc --noEmit --pretty false', { encoding: 'utf8' })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: e.stdout?.toString?.() || e.message || '' }
  }
}

function parseErrors(tscOut) {
  const results = []
  const lines = tscOut.split(/\r?\n/)
  for (const line of lines) {
    // Matches: /path/file.ts:123:45 Type error: No value exists in scope for the shorthand property 'name'.
    let m = line.match(/^(.*\.(?:ts|tsx)):(\d+):(\d+).*shorthand property '([A-Za-z0-9_]+)'/)
    if (m) {
      const [, file, lineNum, colNum, prop] = m
      results.push({ file, line: Number(lineNum), col: Number(colNum), prop })
      continue
    }
    // Matches: /path/file.ts:123:45 - error TS18004: No value exists in scope for the shorthand property 'name'
    m = line.match(/^(.*\.(?:ts|tsx)):(\d+):(\d+).*No value exists in scope for the shorthand property '([A-Za-z0-9_]+)'/)
    if (m) {
      const [, file, lineNum, colNum, prop] = m
      results.push({ file, line: Number(lineNum), col: Number(colNum), prop })
      continue
    }
    // Matches: Cannot find name 'name'. Did you mean '_name'?
    m = line.match(/^(.*\.(?:ts|tsx)):(\d+):(\d+).*Cannot find name '([A-Za-z0-9_]+)'.*?_\4'?/)
    if (m) {
      const [, file, lineNum, colNum, prop] = m
      results.push({ file, line: Number(lineNum), col: Number(colNum), prop })
      continue
    }
  }
  return results
}

function applyFix({ file, line, prop }) {
  const abs = path.resolve(process.cwd(), file)
  if (!fs.existsSync(abs)) return false
  const src = fs.readFileSync(abs, 'utf8')
  const lines = src.split(/\r?\n/)
  if (line < 1 || line > lines.length) return false
  const idx = line - 1
  const original = lines[idx]

  // Replace shorthand "prop" with "prop: _prop" when it looks like part of an object literal prop list
  const re = new RegExp(`(^|[,{\n\r\t\s])(${prop})(\s*)([,}\n\r])`)
  const replaced = original.replace(re, (match, p1, p2, p3, p4) => `${p1}${p2}: _${prop}${p3}${p4}`)

  if (replaced !== original) {
    lines[idx] = replaced
    fs.writeFileSync(abs, lines.join('\n'), 'utf8')
    return true
  }
  return false
}

function main() {
  let iterations = 0
  let totalFixes = 0
  while (iterations < 10) {
    iterations++
    const { ok, out } = runTsc()
    const errs = parseErrors(out)
    if (errs.length === 0) {
      console.log('[fix-shorthand-from-tsc] No matching shorthand errors found')
      break
    }

    let fixedThisRound = 0
    for (const e of errs) {
      const done = applyFix(e)
      if (done) {
        fixedThisRound++
        totalFixes++
        console.log(`[fix-shorthand-from-tsc] Fixed ${e.prop} at ${e.file}:${e.line}`)
      }
    }

    if (fixedThisRound === 0) {
      console.log('[fix-shorthand-from-tsc] No fixes applied this round; stopping')
      break
    }
  }

  console.log(`[fix-shorthand-from-tsc] Total fixes applied: ${totalFixes}`)
}

main()