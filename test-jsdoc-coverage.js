#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function checkJSDocCoverage(dir) {
  const results = {
    total: 0,
    withJSDoc: 0,
    missing: []
  };

  function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for exports
      if (line.match(/^export (class|interface|type|enum|function|const declare|declare class|declare function)/)) {
        results.total++;
        
        // Extract the name
        const nameMatch = line.match(/(?:class|interface|type|enum|function|const|declare class|declare function)\s+([a-zA-Z0-9_]+)/);
        const name = nameMatch ? nameMatch[1] : 'unknown';
        
        // Check if previous lines contain JSDoc
        let hasJSDoc = false;
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (lines[j].includes('/**')) {
            hasJSDoc = true;
            break;
          }
        }
        
        if (hasJSDoc) {
          results.withJSDoc++;
        } else {
          results.missing.push(`${path.basename(filePath)}:${i+1} - ${name}`);
        }
      }
    }
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.d.ts')) {
        processFile(filePath);
      }
    }
  }

  walkDir(dir);
  return results;
}

// Check resilience package
const distDir = '/home/node/projects/vytches-ddd/packages/resilience/dist';
const results = checkJSDocCoverage(distDir);

console.log('=== JSDoc Coverage Report for Resilience Package ===');
console.log(`Total exports: ${results.total}`);
console.log(`With JSDoc: ${results.withJSDoc}`);
console.log(`Coverage: ${((results.withJSDoc / results.total) * 100).toFixed(1)}%`);

if (results.missing.length > 0) {
  console.log('\nMissing JSDoc:');
  results.missing.forEach(item => console.log(`  ❌ ${item}`));
} else {
  console.log('\n✅ All exports have JSDoc!');
}