// Simple test runner to debug issues
import { DefaultLogger } from './src/logger.js';

console.log('=== SIMPLE LOGGER TEST ===');

try {
  // Test basic creation
  console.log('1. Creating logger...');
  const logger = DefaultLogger.create('TestContext');
  console.log('✓ Logger created successfully');

  // Test basic logging
  console.log('2. Testing basic logging...');
  logger.info('test message', { key: 'value' });
  console.log('✓ Basic logging works');

  // Test error logging
  console.log('3. Testing error logging...');
  const error = new Error('test error');
  logger.error('error occurred', error, { operation: 'test' });
  console.log('✓ Error logging works');

  console.log('=== ALL TESTS PASSED ===');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  console.error('Stack:', err.stack);
}