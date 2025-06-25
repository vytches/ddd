#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Bundle Size Testing');
console.log('');

// Run bundle analysis and check if it passes
try {
  console.log('📊 Running bundle analysis...');
  execSync('node scripts/analyze-bundles.js', { stdio: 'inherit' });

  console.log('');
  console.log('✅ Bundle size tests passed!');
  process.exit(0);
} catch (error) {
  console.log('');
  console.log('❌ Bundle size tests failed!');
  process.exit(1);
}
