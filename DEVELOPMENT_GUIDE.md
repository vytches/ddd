# 🚀 VytchesDDD Development Workflow Guide

## 🎯 Quick Start (Most Common)

```bash
# Smart development mode - watches files you've been working on
pnpm dev

# Playground mode - perfect for testing new features
pnpm playground
```

## 📦 Package-Specific Development

### Work on specific packages

```bash
# Develop core package (+ its dependencies automatically)
pnpm dev:core

# Develop events package (+ core, utils automatically)
pnpm dev:events

# Develop multiple specific packages
pnpm dev --packages=core,events,validation
```

### Smart dependency handling

```bash
# If you run "events", it automatically includes:
# - core (dependency of events)
# - utils (dependency of events)
# - events (what you requested)

# You don't need to think about dependencies! 🎉
```

## 🎮 Playground Development

### Default playground

```bash
# Start playground with hot reload
pnpm playground

# This automatically:
# 1. Watches core packages (core, utils, validation, events)
# 2. Starts playground app with hot reload
# 3. Runs tests in watch mode
# 4. Shows output from all processes
```

### Custom playgrounds

```bash
# Create new playground for specific testing
pnpm playground:new my-feature-test

# Start specific playground
cd examples/my-feature-test
pnpm dev
```

## 🧪 Testing Workflows

### Watch mode testing

```bash
# Test everything with UI
pnpm test:watch

# Test only playground
pnpm test:playground

# Test specific package
pnpm test:package core

# Test only affected packages
pnpm test:affected
```

### TDD Workflow

```bash
# Perfect TDD setup
pnpm playground

# This gives you:
# 1. Library code in watch mode
# 2. Test files in watch mode
# 3. Instant feedback on changes
# 4. Hot reload in playground app
```

## 🔄 Advanced Development Modes

### Smart mode (recommended)

```bash
pnpm dev
# Automatically detects what you've been working on
# Based on git changes in last 10 commits
```

### All packages mode

```bash
pnpm dev:all
# Develops all library packages
# Use when working on cross-package features
```

### Affected mode

```bash
pnpm dev:affected
# Only packages affected by your changes
# Perfect for large refactoring
```

### Clean development

```bash
pnpm dev --clean --playground
# Cleans build cache first, then starts playground
```

## 🎯 Real Development Scenarios

### Scenario 1: Adding new Value Object

```bash
# 1. Start playground
pnpm playground

# 2. Edit packages/core/src/value-objects/new-value.ts
# 3. Test in examples/playground/src/index.ts
# 4. Write test in examples/playground/src/playground.test.ts
# 5. Watch everything update in real-time! ✨
```

### Scenario 2: Working on Events

```bash
# 1. Focus on events package
pnpm dev:events

# 2. Includes core + utils automatically
# 3. Edit packages/events/src/domain-events.ts
# 4. Tests run automatically on save
```

### Scenario 3: Cross-package feature

```bash
# 1. Work on multiple packages
pnpm dev --packages=core,events,cqrs

# 2. All dependencies included automatically
# 3. Watch mode for all specified packages
# 4. Tests for all packages in watch mode
```

### Scenario 4: Testing integration

```bash
# 1. Start playground
pnpm playground

# 2. Import multiple packages in playground:
import { ValueObject } from '@vytches-ddd/core';
import { DomainEvent } from '@vytches-ddd/events';
import { CommandBus } from '@vytches-ddd/cqrs';

# 3. Test integration between packages
# 4. Hot reload shows immediate results
```

## 🔧 Troubleshooting

### Port conflicts

```bash
# Playground runs on port 3001 by default
# Change in examples/playground/vite.config.ts if needed
```

### Build issues

```bash
# Clean everything and restart
pnpm clean
pnpm playground
```

### Dependency issues

```bash
# Reinstall dependencies
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm playground
```

### TypeScript issues

```bash
# Check types while developing
pnpm type-check

# Or focus on specific package
pnpm nx type-check core
```

## 💡 Pro Tips

### 1. Use playground for quick experiments

```typescript
// examples/playground/src/index.ts
// Perfect for testing new APIs, patterns, edge cases
```

### 2. Leverage smart mode

```bash
# Just run "pnpm dev" - it knows what you're working on
pnpm dev
```

### 3. Terminal setup

```bash
# Terminal 1: Development
pnpm playground

# Terminal 2: Additional testing
pnpm test:coverage

# Terminal 3: Git operations
git add . && git commit -m "feat(core): add new feature"
```

### 4. VS Code integration

```json
// .vscode/tasks.json (auto-generated)
{
  "tasks": [
    {
      "label": "Dev: Playground",
      "type": "shell",
      "command": "pnpm playground",
      "group": "build"
    }
  ]
}
```

## 🎉 What You Get

✅ **Instant feedback** - changes appear immediately  
✅ **Smart dependencies** - automatically includes what you need  
✅ **Integrated testing** - TDD workflow with watch mode  
✅ **Hot reload** - playground updates without restart  
✅ **Multi-package development** - work across packages seamlessly  
✅ **Git-aware** - smart mode based on your recent changes  
✅ **TypeScript native** - full type checking and intellisense  
✅ **Error handling** - clear error messages and recovery

**This setup is designed for maximum developer productivity! 🚀**
