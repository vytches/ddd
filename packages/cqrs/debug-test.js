// Debug test to identify import issues
try {
  console.log('Testing imports...');
  const { CommandBus } = require('./dist/implementations/command-bus.js');
  console.log('CommandBus imported successfully');
  
  const { EnhancedCommandBus } = require('./dist/implementations/enhanced-command-bus.js');
  console.log('EnhancedCommandBus imported successfully');
  
  const { LoggingMiddleware } = require('./dist/middleware/logging.middleware.js');
  console.log('LoggingMiddleware imported successfully');
  
  console.log('All imports successful');
} catch (error) {
  console.error('Import error:', error);
}