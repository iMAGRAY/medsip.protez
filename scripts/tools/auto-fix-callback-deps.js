#!/usr/bin/env node

/*
  Auto-fix dependencies for useCallback/useMemo:
  - For each useCallback/useMemo(fn, [deps]) find referenced identifiers from outer scope
  - Merge them into deps array (as simple identifiers), keep existing deps
  - Skip identifiers declared inside the callback and imported symbols
  - Supports both 'useCallback' and 'React.useCallback' forms
*/

const { Project, SyntaxKind } = require('ts-morph')
const path = require('path')

const ROOT = process.cwd()

function isUseCallbackOrMemo(call) {
  const exp = call.getExpression()
  const t = exp.getText()
  return t === 'useCallback' || t === 'React.useCallback' || t === 'useMemo' || t === 'React.useMemo'
}

function getOuterReferencedIdentifiers(fnNode) {
  const ids = new Set()
  const locals = new Set()

  // Collect local parameter names
  for (const p of fnNode.getParameters()) {
    try { locals.add(p.getName()) } catch {}
  }

  // Collect local declarations (var/const/function) within the function body
  const body = fnNode.getBody()
  if (body) {
    const varDecls = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    for (const vd of varDecls) {
      const nameNode = vd.getNameNode()
      if (nameNode && nameNode.getKind() === SyntaxKind.Identifier) {
        locals.add(nameNode.getText())
      }
    }
    const funcDecls = body.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    for (const fd of funcDecls) {
      const n = fd.getName()
      if (n) locals.add(n)
    }
  }

  const idNodes = fnNode.getDescendantsOfKind(SyntaxKind.Identifier)
  for (const idNode of idNodes) {
    const name = idNode.getText()
    if (!name) continue
    if (locals.has(name)) continue

    const defs = idNode.getDefinitions()
    if (defs && defs.length) {
      const def = defs[0]
      const dn = def.getDeclarationNode()
      if (!dn) continue
      const k = dn.getKind()
      // Exclude imports
      if ([SyntaxKind.ImportSpecifier, SyntaxKind.ImportClause, SyntaxKind.ImportDeclaration, SyntaxKind.NamespaceImport, SyntaxKind.Identifier].includes(k)) {
        const imp = dn.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        if (imp) continue
      }
      // Exclude callback's own name in recursive patterns
      const ownerFunc = idNode.getFirstAncestor(a => [SyntaxKind.FunctionDeclaration, SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression].includes(a.getKind()))
      if (ownerFunc === fnNode) {
        // identifier used inside, but defined outside; keep
        ids.add(name)
      } else {
        // Used in nested functions within fnNode; still an outer ref for fnNode
        ids.add(name)
      }
    } else {
      // No definition found; assume global (React, window) — skip
      if (name === 'React' || name === 'window' || name === 'document') continue
      ids.add(name)
    }
  }

  return Array.from(ids)
}

function getExistingDeps(arrLiteral) {
  return arrLiteral.getElements().map(e => e.getText().trim())
}

function setDeps(arrLiteral, deps) {
  const unique = Array.from(new Set(deps.filter(Boolean)))
  arrLiteral.replaceWithText(`[${unique.join(', ')}]`)
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  })

  project.addSourceFilesAtPaths(['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'])

  let filesChanged = 0
  let hooksFixed = 0

  for (const sf of project.getSourceFiles()) {
    let changed = false
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isUseCallbackOrMemo)

    for (const call of calls) {
      const args = call.getArguments()
      if (args.length < 2) continue
      const fnArg = args[0]
      const depsArg = args[1]
      if (!(fnArg && (fnArg.getKind() === SyntaxKind.ArrowFunction || fnArg.getKind() === SyntaxKind.FunctionExpression))) continue
      if (!depsArg || depsArg.getKind() !== SyntaxKind.ArrayLiteralExpression) continue

      const existing = getExistingDeps(depsArg)
      const refs = getOuterReferencedIdentifiers(fnArg)

      // Extract identifiers from existing deps to avoid duplicates, normalize dotted to base identifier
      const existingNames = new Set(existing.map(d => d.split(/[.?\[]/)[0]))

      const toAdd = refs.filter(n => !existingNames.has(n))
      if (toAdd.length === 0) continue

      const next = existing.concat(toAdd)
      setDeps(depsArg, next)
      changed = true
      hooksFixed++
    }

    if (changed) { sf.saveSync(); filesChanged++ }
  }

  await project.save()
  console.log(`✅ Callback deps auto-fix: files changed=${filesChanged}, hooks fixed=${hooksFixed}`)
}

main().catch(e => { console.error(e); process.exit(1) })