#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const API_DIR = path.join(process.cwd(), 'app', 'api')

function isRouteFile(filePath) {
  return filePath.endsWith(path.join('route.ts')) || filePath.endsWith(path.join('route.js'))
}

function toApiPath(absFilePath) {
  const rel = path.relative(path.join(process.cwd(), 'app'), absFilePath)
  // rel like: api/products/route.ts → /api/products
  const noFile = rel.replace(/\/route\.(ts|js)$/i, '')
  let segments = noFile.split(path.sep)
  // Ensure starts with api
  if (segments[0] !== 'api') return null
  // Replace dynamic segments
  segments = segments.map(seg => {
    if (/^\[.+\]$/.test(seg)) {
      if (seg === '[table]') return 'products'
      return '1'
    }
    return seg
  })
  return '/' + segments.join('/')
}

function discoverRoutes(dir) {
  const results = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const ent of entries) {
      const full = path.join(current, ent.name)
      if (ent.isDirectory()) {
        stack.push(full)
      } else if (isRouteFile(full)) {
        const apiPath = toApiPath(full)
        if (apiPath) results.push(apiPath)
      }
    }
  }
  // Deduplicate and sort
  return Array.from(new Set(results)).sort()
}

if (require.main === module) {
  if (!fs.existsSync(API_DIR)) {
    console.error('❌ app/api directory not found')
    process.exit(1)
  }
  const routes = discoverRoutes(API_DIR)
  console.log(JSON.stringify(routes, null, 2))
}

module.exports = { discoverRoutes }