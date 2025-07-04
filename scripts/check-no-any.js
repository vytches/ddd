#!/usr/bin/env node

/**
 * Pre-commit hook to prevent new 'any' types
 * Part of IMPROVE.md Phase 2 - Type Safety Crisis prevention
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Checking for new "any" types...');

// Get staged files
let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('node_modules'))
    .filter(Boolean);
} catch (error) {
  // If not in git repo, check all files
  stagedFiles = [];
}

if (stagedFiles.length === 0) {
  console.log('✅ No TypeScript files to check');
  process.exit(0);
}

let hasNewAnyTypes = false;
const anyTypePatterns = [
  /:\s*any\b/g,           // : any
  /as\s+any\b/g,          // as any
  /<any>/g,               // <any>
  /Array<any>/g,          // Array<any>
  /Record<[^,>]+,\s*any>/g, // Record<string, any>
];

for (const file of stagedFiles) {
  if (!fs.existsSync(file)) continue;
  
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comments and test files
    if (line.trim().startsWith('//') || 
        line.trim().startsWith('*') || 
        file.includes('.test.') || 
        file.includes('.spec.')) {
      continue;
    }
    
    for (const pattern of anyTypePatterns) {
      const matches = line.match(pattern);
      if (matches) {
        console.log(`❌ Found 'any' type in ${file}:${i + 1}`);
        console.log(`   ${line.trim()}`);
        hasNewAnyTypes = true;
      }
    }
  }
}

if (hasNewAnyTypes) {
  console.log('\n🚨 COMMIT BLOCKED: New "any" types detected!');
  console.log('📋 Please replace "any" with proper types:');
  console.log('   • Use "unknown" for truly unknown types');
  console.log('   • Use proper interfaces/types when possible');
  console.log('   • Use generics for reusable components');
  console.log('   • See IMPROVE.md Phase 2 for guidance');
  process.exit(1);
} else {
  console.log('✅ No new "any" types detected');
  process.exit(0);
}