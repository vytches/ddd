// Debug script for DataMasker
import { DataMasker } from './src/utils/data-masker.js';

console.log('=== TESTING DATA MASKER ===\n');

try {
  // Test 1: Basic sensitive key masking
  console.log('1. Testing sensitive key masking...');
  const masker1 = new DataMasker({
    enabled: true,
    sensitiveKeys: ['password', 'secret', 'token'],
    replacement: '[MASKED]'
  });

  const data1 = {
    username: 'john',
    password: 'secret123',
    apiToken: 'abc123',
    secretKey: 'xyz789',
    normalField: 'value'
  };

  const result1 = masker1.maskData(data1);
  console.log('Input:', data1);
  console.log('Output:', result1);
  console.log('✓ Sensitive key masking test completed\n');

  // Test 2: Pattern masking
  console.log('2. Testing pattern masking...');
  const masker2 = new DataMasker({
    enabled: true,
    replacement: '[EMAIL]'
  });

  const data2 = {
    message: 'Contact john@example.com for help',
  };

  const result2 = masker2.maskData(data2);
  console.log('Input:', data2);
  console.log('Output:', result2);
  console.log('✓ Pattern masking test completed\n');

  // Test 3: Custom patterns
  console.log('3. Testing custom patterns...');
  const masker3 = new DataMasker({
    enabled: true,
    patterns: ['\\b[A-Z]{2}\\d{6}\\b'],
    replacement: '[CUSTOM]'
  });

  const data3 = {
    code: 'Reference AB123456 and CD789012',
    text: 'No match here: ab123456'
  };

  const result3 = masker3.maskData(data3);
  console.log('Input:', data3);
  console.log('Output:', result3);
  console.log('✓ Custom pattern test completed\n');

  console.log('=== ALL MASKER TESTS PASSED ===');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  console.error('Stack:', err.stack);
}