const { spawn } = require('child_process');
const path = require('path');

console.log('Starting test runner...');

const testProcess = spawn('npx', ['vitest', 'run', 'packages/logging/src/logger.test.ts'], {
  cwd: '/home/node/projects/vytches-ddd',
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' }
});

testProcess.on('close', (code) => {
  console.log(`Test process exited with code ${code}`);
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});