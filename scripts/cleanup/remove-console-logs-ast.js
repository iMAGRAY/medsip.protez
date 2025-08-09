#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// We'll use a simple regex approach that handles most common cases
// For a production solution, you'd want to use @babel/parser and @babel/traverse

// Comprehensive patterns to match console.log statements
const consoleLogPatterns = [
  // Standard console.log calls - single line
  /console\.log\s*\([^)]*\)\s*;?/g,
  // Multi-line console.log calls
  /console\.log\s*\([^)]*\n(?:[^)]*\n)*[^)]*\)\s*;?/g,
  // Console.log with template literals spanning multiple lines
  /console\.log\s*\(`[\s\S]*?`\)\s*;?/g,
  // Console.log with complex arguments
  /console\.log\s*\([\s\S]*?\)\s*;?/g
];

// Extensions to process
const extensions = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to skip
const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.cursor', '.kiro'];

let totalRemoved = 0;
let filesProcessed = 0;
let filesModified = 0;

function removeConsoleLogs(content) {
  let modifiedContent = content;
  let removedCount = 0;

  // First pass: Remove standalone console.log statements (on their own line)
  const standalonePattern = /^\s*console\.log\s*\([^)]*\)\s*;?\s*$/gm;
  const standaloneMatches = modifiedContent.match(standalonePattern);
  if (standaloneMatches) {
    removedCount += standaloneMatches.length;
    modifiedContent = modifiedContent.replace(standalonePattern, '');
  }

  // Second pass: Remove multi-line console.log statements
  const multilinePattern = /^\s*console\.log\s*\([\s\S]*?\)\s*;?\s*$/gm;
  let newContent = modifiedContent;
  let startIndex = 0;

  while (true) {
    const match = newContent.substring(startIndex).match(/console\.log\s*\(/);
    if (!match) break;

    const absoluteIndex = startIndex + match.index;
    let parenCount = 1;
    let i = absoluteIndex + match[0].length;
    let inString = false;
    let stringChar = null;
    let escaped = false;

    // Find the matching closing parenthesis
    while (i < newContent.length && parenCount > 0) {
      const char = newContent[i];

      if (!escaped) {
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = null;
        } else if (!inString) {
          if (char === '(') parenCount++;
          else if (char === ')') parenCount--;
        }

        escaped = char === '\\';
      } else {
        escaped = false;
      }

      i++;
    }

    if (parenCount === 0) {
      // Check if there's a semicolon after
      while (i < newContent.length && /\s/.test(newContent[i])) i++;
      if (newContent[i] === ';') i++;

      // Check if this console.log is on its own line(s)
      let lineStart = absoluteIndex;
      while (lineStart > 0 && newContent[lineStart - 1] !== '\n') {
        if (!/\s/.test(newContent[lineStart - 1])) {
          // Not on its own line, skip this one
          startIndex = absoluteIndex + 1;
          continue;
        }
        lineStart--;
      }

      let lineEnd = i;
      while (lineEnd < newContent.length && /\s/.test(newContent[lineEnd])) {
        if (newContent[lineEnd] === '\n') {
          lineEnd++;
          break;
        }
        lineEnd++;
      }

      // Remove the console.log
      newContent = newContent.substring(0, lineStart) + newContent.substring(lineEnd);
      removedCount++;
      startIndex = lineStart;
    } else {
      startIndex = absoluteIndex + 1;
    }
  }

  modifiedContent = newContent;

  // Clean up multiple empty lines
  modifiedContent = modifiedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove trailing whitespace
  modifiedContent = modifiedContent.replace(/[ \t]+$/gm, '');

  return { content: modifiedContent, count: removedCount };
}

async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const result = removeConsoleLogs(content);

    if (result.content !== content) {
      await writeFile(filePath, result.content, 'utf8');
      totalRemoved += result.count;
      filesModified++;
    }

    filesProcessed++;
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
  console.log('   - Included extensions:', extensions.join(', '));
  console.log('   - Excluded directories:', skipDirs.join(', '));
  const workspacePath = process.cwd();
  await processDirectory(workspacePath);
}

// Check if we should do a dry run first
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});