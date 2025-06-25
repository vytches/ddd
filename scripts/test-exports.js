#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Export Testing');
console.log('');

// Run export validation and check if it passes
try {
  console.log('🔍 Running export validation...');
  execSync('node scripts/validate-exports.js', { stdio: 'inherit' });

  console.log('');
  console.log('✅ Export tests passed!');
  process.exit(0);
} catch (error) {
  console.log('');
  console.log('❌ Export tests failed!');
  process.exit(1);
}
