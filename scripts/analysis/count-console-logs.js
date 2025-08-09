#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Extensions to process
const extensions = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to skip
const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.cursor', '.kiro'];

let totalConsoleLogs = 0;
let filesWithConsoleLogs = 0;
let filesProcessed = 0;

async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const consoleLogMatches = content.match(/console\.log/g);
    
    if (consoleLogMatches) {
      const count = consoleLogMatches.length;
      totalConsoleLogs += count;
      filesWithConsoleLogs++;
      console.log(`📝 ${filePath} - ${count} console.log statements`);
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
  console.log('🔍 Counting console.log statements in the codebase...\n');
  
  const workspacePath = process.cwd();
  await processDirectory(workspacePath);
  
  console.log('\n📊 Summary:');
  console.log(`   Total files scanned: ${filesProcessed}`);
  console.log(`   Files with console.log: ${filesWithConsoleLogs}`);
  console.log(`   Total console.log statements: ${totalConsoleLogs}`);
  
  if (totalConsoleLogs === 0) {
    console.log('\n✨ All console.log statements have been removed!');
  } else {
    console.log('\n⚠️  Some console.log statements remain.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 