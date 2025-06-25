#!/bin/bash

# Create new playground for specific testing
PLAYGROUND_NAME=${1:-"playground"}
PLAYGROUND_PATH="examples/$PLAYGROUND_NAME"

echo "🎮 Creating playground: $PLAYGROUND_NAME"

if [ -d "$PLAYGROUND_PATH" ]; then
  echo "❌ Playground $PLAYGROUND_NAME already exists"
  exit 1
fi

# Create playground structure
mkdir -p "$PLAYGROUND_PATH/src"

# Create package.json
cat > "$PLAYGROUND_PATH/package.json" << EOF
{
  "name": "@vytches-ddd/playground-$PLAYGROUND_NAME",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@vytches-ddd/core": "workspace:*",
    "@vytches-ddd/events": "workspace:*",
    "@vytches-ddd/utils": "workspace:*",
    "@vytches-ddd/validation": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.4",
    "typescript": "^5.2.2"
  }
}
EOF

# Create tsconfig.json
cat > "$PLAYGROUND_PATH/tsconfig.json" << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Copy vite config
cp examples/playground/vite.config.ts "$PLAYGROUND_PATH/"

# Create basic index.ts
cat > "$PLAYGROUND_PATH/src/index.ts" << EOF
/**
 * $PLAYGROUND_NAME Playground
 *
 * Test your VytchesDDD features here!
 */

import { ValueObject } from '@vytches-ddd/core';
import { Guid } from '@vytches-ddd/utils';

console.log('🎮 $PLAYGROUND_NAME Playground Active!');

// Add your test code here
class TestValue extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }
}

const test = new TestValue('Hello from $PLAYGROUND_NAME!');
console.log('✅ Test value:', test.value);

export { TestValue };
EOF

# Create basic test
cat > "$PLAYGROUND_PATH/src/playground.test.ts" << EOF
import { describe, it, expect } from 'vitest';
import { TestValue } from './index';

describe('$PLAYGROUND_NAME Tests', () => {
  it('should work', () => {
    const test = new TestValue('test');
    expect(test.value).toBe('test');
  });
});
EOF

echo "✅ Playground $PLAYGROUND_NAME created!"
echo ""
echo "🚀 To start:"
echo "  cd $PLAYGROUND_PATH"
echo "  pnpm dev"
echo ""
echo "🧪 To test:"
echo "  pnpm test:watch"
