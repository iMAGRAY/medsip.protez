#!/usr/bin/env node

/*
  Auto-add missing key prop in simple JSX maps:
  - Detect arr.map((item, idx) => <Comp .../>) or => (<div>...)</div>)
  - If returned root JSX element has no key prop, add key={item.id ?? idx}
  - Conservative: only single-root returns, simple parameter names
*/

const { Project, SyntaxKind } = require('ts-morph')
const path = require('path')

const ROOT = process.cwd()

function getFirstJsxRoot(node) {
  if (!node) return null
  if (node.getKind() === SyntaxKind.ParenthesizedExpression) return getFirstJsxRoot(node.getExpression())
  if (node.getKind() === SyntaxKind.JsxElement || node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxFragment) return node
  if (node.getKind() === SyntaxKind.Block) {
    const stmts = node.getStatements()
    if (stmts.length === 1 && stmts[0].getKind() === SyntaxKind.ReturnStatement) {
      const rs = stmts[0]
      return getFirstJsxRoot(rs.getExpression())
    }
  }
  return null
}

function hasKeyProp(jsxNode) {
  const attrs = jsxNode.getKind() === SyntaxKind.JsxElement
    ? jsxNode.getOpeningElement().getAttributes()
    : jsxNode.getAttributes && jsxNode.getAttributes()
  if (!attrs) return false
  return attrs.some(a => a.getKind() === SyntaxKind.JsxAttribute && a.getName() === 'key')
}

function addKeyProp(jsxNode, keyExpr) {
  if (jsxNode.getKind() === SyntaxKind.JsxElement) {
    const opening = jsxNode.getOpeningElement()
    opening.insertAttribute(0, { kind: SyntaxKind.JsxAttribute, name: 'key', initializer: `{${keyExpr}}` })
  } else if (jsxNode.getKind() === SyntaxKind.JsxSelfClosingElement) {
    const txt = jsxNode.getText()
    // naive insert before closing '/>'
    const replaced = txt.replace(/\/>\s*$/, ` key={${keyExpr}} />`)
    jsxNode.replaceWithText(replaced)
  }
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  })

  project.addSourceFilesAtPaths(['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'])

  let filesChanged = 0
  let keysAdded = 0

  for (const sf of project.getSourceFiles()) {
    let changed = false
    const maps = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(ce => ce.getExpression().getText().endsWith('.map'))
    for (const m of maps) {
      const args = m.getArguments()
      if (args.length === 0) continue
      const cb = args[0]
      if (cb.getKind() !== SyntaxKind.ArrowFunction && cb.getKind() !== SyntaxKind.FunctionExpression) continue
      const params = cb.getParameters()
      if (params.length === 0) continue
      const itemParam = params[0].getName()
      const idxParam = params[1] ? params[1].getName() : null
      const root = getFirstJsxRoot(cb.getBody())
      if (!root) continue
      if (hasKeyProp(root)) continue

      const keyExpr = `${itemParam}?.id ?? ${idxParam ?? '0'}`
      addKeyProp(root, keyExpr)
      changed = true
      keysAdded++
    }
    if (changed) { sf.saveSync(); filesChanged++ }
  }

  await project.save()
  console.log(`✅ JSX keys auto-fix: files changed=${filesChanged}, keys added=${keysAdded}`)
}

main().catch(e => { console.error(e); process.exit(1) })