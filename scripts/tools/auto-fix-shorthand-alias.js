#!/usr/bin/env node

const { Project, SyntaxKind, Node } = require('ts-morph')
const path = require('path')

function log(...args) {
  console.log('[auto-fix-shorthand-alias]', ...args)
}

function collectTargetFiles(project) {
  const patterns = [
    'app/**/*.ts',
    'app/**/*.tsx',
    'components/**/*.ts',
    'components/**/*.tsx',
    'hooks/**/*.ts',
    'hooks/**/*.tsx',
    'lib/**/*.ts',
    'lib/**/*.tsx',
  ]
  for (const p of patterns) project.addSourceFilesAtPaths(p)
}

function isFunctionLike(node) {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isConstructorDeclaration(node)
  )
}

function findNearestScope(node) {
  let cur = node
  while (cur) {
    if (isFunctionLike(cur) || Node.isSourceFile(cur) || Node.isModuleBlock(cur) || Node.isBlock(cur)) {
      return cur
    }
    cur = cur.getParent()
  }
  return node.getSourceFile()
}

function hasDeclarationInScope(scopeNode, varName) {
  // Check parameters in function-like
  if (isFunctionLike(scopeNode)) {
    const params = scopeNode.getParameters()
    if (params.some(p => p.getName() === varName)) return true
  }
  // Check variable declarations inside scope
  const decls = scopeNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
  if (decls.some(d => d.getName() === varName)) return true
  // Also check function declarations
  const fns = scopeNode.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
  if (fns.some(fn => fn.getName && fn.getName() === varName)) return true
  return false
}

function processSourceFile(sf) {
  let fileChanges = 0
  const objects = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
  for (const obj of objects) {
    const props = obj.getProperties()
    for (const prop of props) {
      if (Node.isShorthandPropertyAssignment(prop)) {
        const name = prop.getName()
        const underscored = `_${name}`

        // If a proper symbol exists for name, likely ok; skip
        const symbol = prop.getNameNode().getSymbol()
        if (symbol) continue

        // Otherwise, try to map to _name if declared in scope
        const scope = findNearestScope(prop)
        const hasUnderscore = hasDeclarationInScope(scope, underscored)
        const hasName = hasDeclarationInScope(scope, name)

        if (hasUnderscore && !hasName) {
          prop.replaceWithText(`${name}: ${underscored}`)
          fileChanges++
        }
      }
    }
  }
  return fileChanges
}

async function main() {
  const project = new Project({ tsConfigFilePath: path.resolve(process.cwd(), 'tsconfig.json') })
  collectTargetFiles(project)

  const files = project.getSourceFiles()
  log(`Loaded ${files.length} files`)

  let totalChanges = 0
  for (const sf of files) {
    const cnt = processSourceFile(sf)
    if (cnt > 0) {
      totalChanges += cnt
      await sf.save()
      log(`Fixed ${cnt} shorthand(s) in ${sf.getFilePath()}`)
    }
  }

  if (totalChanges === 0) {
    log('No shorthand alias issues found')
  } else {
    log(`Total fixed shorthands: ${totalChanges}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})