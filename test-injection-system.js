#!/usr/bin/env node

/**
 * Quick test to verify the Enhanced Metadata System V2 injection process
 */

const { JSDocAdapter } = require('./packages/utils/src/examples-engine/adapters/jsdoc-adapter');

async function testInjectionSystem() {
  console.log('🧪 Testing Enhanced Metadata System V2 Injection...\n');
  
  // Sample code with injection directives (similar to aggregate-root.ts)
  const testCode = `/**
 * @description-inject
 * @business-context-inject
 * @example-inject
 */
export class TestAggregate {
  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  getId(): string {
    return this.id;
  }
}`;

  console.log('📋 Original code:');
  console.log(testCode);
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // Test the adapter
    const adapter = new JSDocAdapter();
    
    // Simulate processing the aggregates package
    const testFilePath = '/home/node/projects/vytches-ddd/packages/aggregates/src/core/test-aggregate.ts';
    
    console.log('🔄 Processing with JSDocAdapter...');
    console.log(`File path: ${testFilePath}`);
    console.log(`Environment USE_HIERARCHICAL_METADATA: ${process.env.USE_HIERARCHICAL_METADATA || 'undefined (defaults to true)'}`);
    
    const processedCode = await adapter.processInjectionDirectives(testCode, testFilePath);
    
    console.log('\n📄 Processed code:');
    console.log(processedCode);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Check if directives were replaced
    const originalDirectives = (testCode.match(/@[\w-]+-inject/g) || []).length;
    const remainingDirectives = (processedCode.match(/@[\w-]+-inject/g) || []).length;
    
    console.log(`📊 Results:`);
    console.log(`- Original directives: ${originalDirectives}`);
    console.log(`- Remaining directives: ${remainingDirectives}`);
    console.log(`- Processed directives: ${originalDirectives - remainingDirectives}`);
    
    if (remainingDirectives === 0) {
      console.log('✅ SUCCESS: All injection directives were processed!');
    } else {
      console.log('❌ ISSUE: Some directives were not processed');
      
      // Show which directives remain
      const remaining = processedCode.match(/@[\w-]+-inject/g) || [];
      console.log(`- Remaining: ${remaining.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testInjectionSystem().catch(console.error);