#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Patterns to match console.log statements
const consoleLogPatterns = [
  // Simple console.log on single line
  /^\s*console\.log\([^)]*\);?\s*$/gm,
  // Multi-line console.log
  /^\s*console\.log\([^)]*\n([^)]*\n)*[^)]*\);?\s*$/gm,
  // Console.log with template literals
  /^\s*console\.log\(`[^`]*`\);?\s*$/gm,
  // Console.log in conditional statements or blocks
  /^\s*{\s*console\.log\([^)]*\);?\s*}\s*$/gm,
  // Console.log with multiple arguments
  /^\s*console\.log\([^,)]*(?:,[^,)]*)*\);?\s*$/gm
];

// Extensions to process
const extensions = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to skip
const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build'];

let totalRemoved = 0;
let filesProcessed = 0;

async function processFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    const originalContent = content;
    let removedCount = 0;

    // Remove console.log statements
    consoleLogPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        removedCount += matches.length;
        content = content.replace(pattern, '');
      }
    });

    // Clean up empty lines that might be left
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Remove trailing whitespace
    content = content.replace(/[ \t]+$/gm, '');

    if (content !== originalContent) {
      await writeFile(filePath, content, 'utf8');
      totalRemoved += removedCount;
      filesProcessed++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function processDirectory(dirPath) {
  try {
    const items = await readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStat = await stat(itemPath);

      if (itemStat.isDirectory()) {
        if (!skipDirs.includes(item)) {
          await processDirectory(itemPath);
        }
      } else if (itemStat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          await processFile(itemPath);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${dirPath}:`, error.message);
  }
}

async function main() {
  const workspacePath = process.cwd();
  await processDirectory(workspacePath);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});