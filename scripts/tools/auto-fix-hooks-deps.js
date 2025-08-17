#!/usr/bin/env node

/*
  Auto-fix react-hooks/exhaustive-deps for common pattern safely:
  - Case A: useEffect(() => { loadData() }, [deps]) where loadData is defined at component top-level.
    → Wrap top-level const loadData = (...) => {...} into useCallback((...) => {...}, [deps]) and set effect deps to [loadData].
  - Case B: useEffect(() => { const loadData = (...) => {...}; loadData(); }, [deps])
    → Hoist 'loadData' to component top-level as useCallback((...) => {...}, [deps]) and set effect deps to [loadData], leaving effect body to just loadData().

  Constraints:
  - Do NOT place useCallback inside another callback (rules-of-hooks).
  - Only transform functions whose nearest function ancestor is the same component function as the useEffect call.
*/

const { Project, SyntaxKind } = require('ts-morph')
const path = require('path')

const ROOT = process.cwd()

function ensureUseCallbackImport(sf) {
  const importDecls = sf.getImportDeclarations().filter(d => d.getModuleSpecifierValue() === 'react')
  if (importDecls.length === 0) {
    sf.insertStatements(0, `import React, { useCallback } from 'react'\n`)
    return
  }
  const decl = importDecls[0]
  const named = decl.getNamedImports().map(n => n.getName())
  const hasDefaultReact = !!decl.getDefaultImport()
  if (!named.includes('useCallback')) {
    if (hasDefaultReact || named.length > 0) {
      decl.addNamedImport('useCallback')
    } else {
      decl.setText(`import { useCallback } from 'react'`)
    }
  }
}

function textWithoutBrackets(arrLiteral) {
  const t = arrLiteral.getText().trim()
  if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1)
  return t
}

function isIdentifierCall(expr) {
  if (!expr || expr.getKind() !== SyntaxKind.CallExpression) return null
  const ce = expr
  const exp = ce.getExpression()
  if (exp && exp.getKind() === SyntaxKind.Identifier) {
    return exp.getText()
  }
  return null
}

function nearestFuncAncestor(node) {
  return node.getFirstAncestor(a => [
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction
  ].includes(a.getKind()))
}

function findTopLevelVarInComponent(componentFn, name) {
  const body = componentFn.getBody && componentFn.getBody()
  if (!body) return null
  const decls = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
  for (const vd of decls) {
    const id = vd.getNameNode()
    if (!id || id.getText() !== name) continue
    const init = vd.getInitializer()
    if (!init) continue
    const k = init.getKind()
    if (!(k === SyntaxKind.ArrowFunction || k === SyntaxKind.FunctionExpression)) continue
    // Ensure same nearest function ancestor is the component itself
    const anc = nearestFuncAncestor(vd)
    if (anc && anc === componentFn) return vd
  }
  return null
}

function wrapInitializerWithUseCallback(vd, depsInnerText) {
  const init = vd.getInitializer()
  const initText = init.getText()
  if (/\buseCallback\s*\(/.test(initText)) return false
  const newInitText = `useCallback(${initText}, [${depsInnerText}])`
  init.replaceWithText(newInitText)
  return true
}

function replaceEffectDepsWithFn(callExpr, fnName) {
  const args = callExpr.getArguments()
  if (args.length < 2) return false
  const deps = args[1]
  if (!deps || deps.getKind() !== SyntaxKind.ArrayLiteralExpression) return false
  deps.replaceWithText(`[${fnName}]`)
  return true
}

function findInnerDefinedFunctionInEffect(effectCb) {
  if (!effectCb) return null
  const body = effectCb.getBody()
  if (!body || body.getKind() !== SyntaxKind.Block) return null
  // Look for 'const name = (...) => {...}' directly in effect body
  const varStmts = body.getChildrenOfKind(SyntaxKind.VariableStatement)
  for (const vs of varStmts) {
    const decls = vs.getDeclarationList().getDeclarations()
    for (const vd of decls) {
      const id = vd.getNameNode()
      const init = vd.getInitializer()
      if (!id || !init) continue
      const k = init.getKind()
      if (k === SyntaxKind.ArrowFunction || k === SyntaxKind.FunctionExpression) {
        // Check that this function is invoked in the effect body
        const name = id.getText()
        const calls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
        const called = calls.some(c => c.getExpression().getText() === name)
        if (called) return { varDecl: vd, varStmt: vs, name, init, kind: 'plain' }
      }
      if (k === SyntaxKind.CallExpression) {
        const callee = init.getExpression().getText()
        if (callee === 'useCallback') {
          const name = id.getText()
          // Ensure it's invoked within body
          const calls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
          const called = calls.some(c => c.getExpression().getText() === name)
          if (called) return { varDecl: vd, varStmt: vs, name, init, kind: 'useCallback' }
        }
      }
    }
  }
  return null
}

function hoistInnerFunctionToComponent(componentFn, effectStmt, inner, depsInnerText) {
  const { varDecl, varStmt, name, init, kind } = inner
  let hoistedText
  if (kind === 'plain') {
    // Wrap plain function in useCallback with deps
    const initText = init.getText()
    hoistedText = `const ${name} = useCallback(${initText}, [${depsInnerText}])\n`
  } else {
    // Already useCallback inside effect; reuse as-is (ignore depsInnerText to avoid double deps)
    const initText = init.getText()
    hoistedText = `const ${name} = ${initText}\n`
  }
  const container = effectStmt.getParent()
  const index = effectStmt.getChildIndex()
  container.insertStatements(index, hoistedText)
  varStmt.remove()
  return true
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  })

  project.addSourceFilesAtPaths(['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'])

  const files = project.getSourceFiles()
  let filesChanged = 0
  let effectsFixed = 0
  let hoistedCount = 0

  for (const sf of files) {
    let changed = false

    const effectCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(c => c.getExpression().getText() === 'useEffect')

    for (const call of effectCalls) {
      const args = call.getArguments()
      if (args.length < 2) continue
      const cb = args[0]
      const deps = args[1]
      if (!deps || deps.getKind() !== SyntaxKind.ArrayLiteralExpression) continue

      const componentFn = nearestFuncAncestor(call)
      if (!componentFn) continue

      // Direct call case: useEffect(() => { foo() }, [deps])
      if (cb && (cb.getKind() === SyntaxKind.ArrowFunction || cb.getKind() === SyntaxKind.FunctionExpression)) {
        const body = cb.getBody()
        const stmts = body && body.getKind() === SyntaxKind.Block ? body.getStatements() : []
        let fnName = null
        for (const st of stmts) {
          if (st.getKind() !== SyntaxKind.ExpressionStatement) continue
          const name = isIdentifierCall(st.getExpression())
          if (name) { fnName = name; break }
        }

        const depsInnerText = textWithoutBrackets(deps)

        if (fnName) {
          // Try top-level wrap first
          const vdTop = findTopLevelVarInComponent(componentFn, fnName)
          if (vdTop) {
            const wrapped = wrapInitializerWithUseCallback(vdTop, depsInnerText)
            if (wrapped) {
              ensureUseCallbackImport(sf)
              replaceEffectDepsWithFn(call, fnName)
              changed = true
              effectsFixed++
              continue
            }
          }

          // Else check for inner defined function to hoist
          const inner = findInnerDefinedFunctionInEffect(cb)
          if (inner && inner.name === fnName) {
            const effectStmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement)
            if (effectStmt) {
              const hoisted = hoistInnerFunctionToComponent(componentFn, effectStmt, inner, depsInnerText)
              if (hoisted) {
                ensureUseCallbackImport(sf)
                replaceEffectDepsWithFn(call, fnName)
                changed = true
                effectsFixed++
                hoistedCount++
              }
            }
          }
        }
      }
    }

    if (changed) { sf.saveSync(); filesChanged++ }
  }

  await project.save()
  console.log(`✅ Hooks deps auto-fix: files changed=${filesChanged}, effects fixed=${effectsFixed}, hoisted=${hoistedCount}`)
}

main().catch(e => { console.error(e); process.exit(1) })