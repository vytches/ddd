import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing import of logger...');

try {
  const loggerPath = resolve(__dirname, 'packages/logging/src/logger.js');
  console.log('Trying to import:', loggerPath);
  
  // Try to import the DefaultLogger
  const { DefaultLogger } = await import('./packages/logging/src/logger.js');
  console.log('Successfully imported DefaultLogger');
  
  // Test basic instantiation
  const logger = DefaultLogger.create('TestContext');
  console.log('Successfully created logger:', logger.context);
  
} catch (error) {
  console.error('Import failed:', error.message);
  console.error('Stack:', error.stack);
}