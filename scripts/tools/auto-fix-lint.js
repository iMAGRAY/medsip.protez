#!/usr/bin/env node
/*
  Auto-fix lint warnings safely:
  - Prefix unused function params/local variables with underscore (only when truly unused)
  - Convert <img .../> to <SafeImage .../> only when width/height can be derived from Tailwind classes (w-N, h-N)
*/

const { Project, SyntaxKind } = require('ts-morph')
const path = require('path')

const ROOT = process.cwd()

function tailwindNumberToPx(token) {
  const n = parseInt(token, 10)
  if (!isFinite(n)) return null
  return n * 4
}

function derivePxFromClassName(cls) {
  if (!cls) return { w: null, h: null }
  let w = null, h = null
  const wMatch = cls.match(/(?:^|\s)w-(\d+)(?:\s|$)/)
  const hMatch = cls.match(/(?:^|\s)h-(\d+)(?:\s|$)/)
  if (wMatch) w = tailwindNumberToPx(wMatch[1])
  if (hMatch) h = tailwindNumberToPx(hMatch[1])
  return { w, h }
}

function ensureSafeImageImport(sf) {
  const imports = sf.getImportDeclarations()
  const has = imports.some(id => id.getModuleSpecifierValue() === '@/components/safe-image')
  if (!has) {
    sf.insertStatements(0, `import { SafeImage } from "@/components/safe-image"\n`)
    return true
  }
  return false
}

function convertImgToSafeImage(sf) {
  let changed = false
  const jsxSelfClosing = sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
  for (const el of jsxSelfClosing) {
    const tagName = el.getTagNameNode().getText()
    if (tagName !== 'img') continue

    const attrs = {}
    for (const a of el.getAttributes()) {
      if (a.getKind() === SyntaxKind.JsxAttribute) {
        const name = a.getNameNode().getText()
        const init = a.getInitializer()
        if (!init) { attrs[name] = true; continue }
        if (init.getKind() === SyntaxKind.StringLiteral) {
          attrs[name] = { text: init.getLiteralText(), isString: true }
        } else {
          attrs[name] = { text: init.getText(), isString: false }
        }
      }
    }

    const srcAttr = attrs.src
    if (!srcAttr) continue
    const altAttr = attrs.alt
    const classAttr = attrs.className
    const widthAttr = attrs.width
    const heightAttr = attrs.height

    const alt = altAttr === true ? '' : (altAttr ? altAttr.text : '')
    const className = classAttr === true ? '' : (classAttr ? classAttr.text : '')

    // Prefer explicit width/height props, else derive from classes
    let w = null, h = null
    if (widthAttr && heightAttr) {
      const parseNum = (t) => {
        if (!t) return null
        if (typeof t === 'string' && /^\d+$/.test(t)) return parseInt(t, 10)
        const m = String(t).match(/\{\s*(\d+)\s*\}/)
        return m ? parseInt(m[1], 10) : null
      }
      w = parseNum(widthAttr.text)
      h = parseNum(heightAttr.text)
    }
    if (!w || !h) {
      const d = derivePxFromClassName(className)
      w = w || d.w
      h = h || d.h
    }
    if (!w || !h) continue

    const srcProp = srcAttr.isString ? `src="${srcAttr.text}"` : `src={${srcAttr.text}}`
    const altProp = `alt=${JSON.stringify(alt)}`
    const sizeProps = `width={${w}} height={${h}}`
    const classProp = className ? (classAttr.isString ? ` className="${className}"` : ` className={${className}}`) : ''

    const newText = `<SafeImage ${srcProp} ${altProp} ${sizeProps}${classProp} />`
    el.replaceWithText(newText)
    ensureSafeImageImport(sf)
    changed = true
  }
  return changed
}

function countNonDefinitionRefs(nameNode) {
  const refSymbols = nameNode.findReferences()
  let count = 0
  for (const rs of refSymbols) {
    for (const ref of rs.getReferences()) {
      if (!ref.isDefinition()) count++
    }
  }
  return count
}

function prefixUnusedLocalsAndParams(sf) {
  let changed = false

  const functions = sf.getDescendants().filter(n => [
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction,
    SyntaxKind.MethodDeclaration
  ].includes(n.getKind()))

  for (const fn of functions) {
    for (const p of fn.getParameters()) {
      const nameNode = p.getNameNode()
      if (!nameNode || nameNode.getKind() !== SyntaxKind.Identifier) continue
      const name = nameNode.getText()
      if (name.startsWith('_')) continue
      const nonDefRefs = countNonDefinitionRefs(nameNode)
      if (nonDefRefs === 0) {
        nameNode.replaceWithText(`_${name}`)
        changed = true
      }
    }

    const body = fn.getBody && fn.getBody()
    if (!body) continue
    const varDecls = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    for (const vd of varDecls) {
      const nameNode = vd.getNameNode()
      if (!nameNode || nameNode.getKind() !== SyntaxKind.Identifier) continue
      const name = nameNode.getText()
      if (name.startsWith('_')) continue
      const nonDefRefs = countNonDefinitionRefs(nameNode)
      if (nonDefRefs === 0) {
        nameNode.replaceWithText(`_${name}`)
        changed = true
      }
    }
  }

  return changed
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  })

  project.addSourceFilesAtPaths(['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'])
  const files = project.getSourceFiles()

  let filesChanged = 0
  let imgConverted = 0
  let namesPrefixed = 0

  for (const sf of files) {
    let changed = false

    if (prefixUnusedLocalsAndParams(sf)) { changed = true; namesPrefixed++ }
    if (convertImgToSafeImage(sf)) { changed = true; imgConverted++ }

    if (changed) { sf.saveSync(); filesChanged++ }
  }

  await project.save()
  console.log(`✅ Auto-fix done: files changed=${filesChanged}, img->SafeImage=${imgConverted}, prefixed=${namesPrefixed}`)
}

main().catch((e) => {
  console.error('Auto-fix failed:', e)
  process.exit(1)
})