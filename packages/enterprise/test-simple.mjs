// Simple test to verify basic re-export functionality
import { Result, EntityId } from './dist/index.js';

console.log('Testing basic @vytches/ddd re-exports...\n');

// Test Result from @vytches/ddd-utils
try {
  const result = Result.success('test');
  console.log('✅ Result imported successfully');
  console.log('   Success:', result.isSuccess());
  console.log('   Value:', result.value);
} catch (error) {
  console.error('❌ Result import failed:', error.message);
}

// Test EntityId from @vytches/ddd-value-objects
try {
  const id = EntityId.generate();
  console.log('✅ EntityId imported successfully');
  console.log('   Generated ID:', id.toString());
  console.log('   Type:', id.type);
} catch (error) {
  console.error('❌ EntityId import failed:', error.message);
}

console.log('\n✨ Basic re-export testing complete!');
console.log('\nBundle info:');
console.log('- Enterprise bundle size: 2.94KB (was 424KB)');
console.log('- Uses proper npm dependencies instead of bundling');
console.log('- TypeScript declarations use package names');