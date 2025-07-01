// Simple test using compiled JS
console.log('Testing DataMasker patterns...');

// Mock DataMasker functionality
class SimpleDataMasker {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      patterns: options.patterns ?? [],
      replacement: options.replacement ?? '[MASKED]',
      sensitiveKeys: options.sensitiveKeys ?? [],
    };

    // Default patterns
    const defaultPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b\d{3}-?\d{3}-?\d{4}\b/g, // Phone number
    ];

    this.compiledPatterns = [
      ...defaultPatterns,
      ...this.options.patterns.map(pattern => new RegExp(pattern, 'g')),
    ];
  }

  maskString(str) {
    let masked = str;
    for (const pattern of this.compiledPatterns) {
      masked = masked.replace(pattern, this.options.replacement);
    }
    return masked;
  }

  isSensitiveKey(key) {
    const lowerKey = key.toLowerCase();
    return this.options.sensitiveKeys.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey.toLowerCase())
    );
  }

  maskData(data) {
    if (!this.options.enabled) return data;
    
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const result = {};
      for (const [key, val] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          result[key] = this.options.replacement;
        } else if (typeof val === 'string') {
          result[key] = this.maskString(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    }
    
    return data;
  }
}

// Test 1: Email pattern
console.log('\n1. Testing email pattern:');
const emailMasker = new SimpleDataMasker({ 
  enabled: true, 
  replacement: '[EMAIL]' 
});

const emailData = {
  message: 'Contact john@example.com or admin@test.org for help',
  description: 'User email is jane.doe@company.co.uk'
};

const emailResult = emailMasker.maskData(emailData);
console.log('Input:', emailData);
console.log('Output:', emailResult);

// Test 2: Custom pattern
console.log('\n2. Testing custom pattern:');
const customMasker = new SimpleDataMasker({
  enabled: true,
  patterns: ['\\b[A-Z]{2}\\d{6}\\b'],
  replacement: '[CUSTOM]'
});

const customData = {
  code: 'Reference AB123456 and CD789012',
  text: 'No match here: ab123456'
};

const customResult = customMasker.maskData(customData);
console.log('Input:', customData);
console.log('Output:', customResult);

// Test 3: Sensitive keys
console.log('\n3. Testing sensitive keys:');
const keyMasker = new SimpleDataMasker({
  enabled: true,
  sensitiveKeys: ['password', 'secret', 'token'],
  replacement: '[MASKED]'
});

const keyData = {
  username: 'john',
  password: 'secret123',
  apiToken: 'abc123',
  secretKey: 'xyz789',
  normalField: 'value'
};

const keyResult = keyMasker.maskData(keyData);
console.log('Input:', keyData);
console.log('Output:', keyResult);

console.log('\n=== Tests completed ===');