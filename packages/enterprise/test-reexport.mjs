// Test that meta-package correctly re-exports from dependencies
import { UniversalEventDispatcher, Result, EntityId, Logger } from './dist/index.js';

console.log('Testing @vytches/ddd re-exports...\n');

// Test 1: UniversalEventDispatcher from @vytches/ddd-events
try {
  const dispatcher = new UniversalEventDispatcher();
  console.log('✅ UniversalEventDispatcher imported successfully');
  console.log('   Type:', typeof UniversalEventDispatcher);
} catch (error) {
  console.error('❌ UniversalEventDispatcher import failed:', error.message);
}

// Test 2: Result from @vytches/ddd-utils
try {
  const result = Result.success('test');
  console.log('✅ Result imported successfully');
  console.log('   Success:', result.isSuccess());
} catch (error) {
  console.error('❌ Result import failed:', error.message);
}

// Test 3: EntityId from @vytches/ddd-value-objects
try {
  const id = EntityId.generate();
  console.log('✅ EntityId imported successfully');
  console.log('   Generated ID:', id.toString());
} catch (error) {
  console.error('❌ EntityId import failed:', error.message);
}

// Test 4: Logger from @vytches/ddd-logging
try {
  const logger = Logger.forContext('TestContext');
  console.log('✅ Logger imported successfully');
  console.log('   Type:', typeof logger);
} catch (error) {
  console.error('❌ Logger import failed:', error.message);
}

console.log('\n✨ Re-export testing complete!');