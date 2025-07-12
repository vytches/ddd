# VytchesDDD - Quick Start Setup Guide

This guide will help you set up the complete VytchesDDD monorepo from scratch.

## 🚀 Prerequisites

Before starting, ensure you have:

- **Node.js** >= 18.0.0 ([Download here](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm`)
- **Git** installed and configured

## 📋 Step-by-Step Setup

### Step 1: Create New Directory

```bash
mkdir vytches-ddd
cd vytches-ddd
```

### Step 2: Copy Configuration Files

Copy all the provided configuration files to your project root:

```
vytches-ddd/
├── package.json                 # Root package configuration
├── nx.json                      # Nx workspace configuration
├── lerna.json                   # Lerna release configuration
├── tsconfig.base.json           # TypeScript base configuration
├── .eslintrc.json              # ESLint configuration
├── prettier.config.js          # Prettier configuration
├── vitest.config.ts            # Vitest test configuration
├── commitlint.config.js        # Commit message linting
├── .gitignore                  # Git ignore rules
├── README.md                   # Project documentation
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI pipeline
│       └── release.yml         # Release pipeline
├── .husky/
│   ├── pre-commit             # Pre-commit hooks
│   └── commit-msg             # Commit message hooks
└── .vscode/
    ├── settings.json          # VS Code settings
    └── extensions.json        # Recommended extensions
```

### Step 3: Run Setup Automation

Make the setup script executable and run it:

```bash
chmod +x setup-automation.sh
./setup-automation.sh
```

This will create the complete directory structure and all package
configurations.

### Step 4: Install Dependencies

```bash
pnpm install
```

### Step 5: Setup Git Hooks

```bash
pnpm prepare
```

### Step 6: Verify Setup

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Check linting
pnpm lint

# View dependency graph
pnpm graph
```

## 📦 Package Structure

After setup, you'll have this structure:

```
vytches-ddd/
├── packages/
│   ├── core/                   # @vytches-ddd/core
│   ├── events/                 # @vytches-ddd/events
│   ├── cqrs/                   # @vytches-ddd/cqrs
│   ├── acl/                    # @vytches-ddd/acl
│   ├── projections/            # @vytches-ddd/projections
│   ├── resilience/             # @vytches-ddd/resilience
│   ├── enterprise/             # @vytches-ddd/enterprise
│   └── cli/                    # @vytches-ddd/cli
├── examples/
│   ├── simple/                 # Basic usage examples
│   ├── ecommerce/              # E-commerce domain
│   └── banking/                # Banking domain
├── tools/                      # Build and development tools
└── docs/                       # Documentation
```

## 🔧 Migration from Existing Code

### Step 7: Copy Your Existing Library Code

1. **Core package** (`packages/core/src/`):

   - Copy your Value Objects, Entities, Aggregates
   - Copy Repository interfaces and base classes
   - Copy Domain Services and Business Rules

2. **Events package** (`packages/events/src/`):

   - Copy Domain Events and Integration Events
   - Copy Event Bus implementations
   - Copy Event Handlers

3. **CQRS package** (`packages/cqrs/src/`):

   - Copy Command and Query classes
   - Copy Handlers and Buses
   - Copy CQRS Module

4. **ACL package** (`packages/acl/src/`):
   - Copy ACL Adapters and Translators
   - Copy External API interfaces
   - Copy Middleware and Registry

### Step 8: Update Imports

Update your import statements to use the new package structure:

```typescript
// Old imports
import { ValueObject } from './core/value-object';
import { DomainEvent } from './events/domain-event';

// New imports
import { ValueObject } from '@vytches-ddd/core';
import { DomainEvent } from '@vytches-ddd/events';
```

### Step 9: Update Package Dependencies

Each package's `package.json` should specify its dependencies:

```json
{
  "dependencies": {
    "@vytches-ddd/core": "workspace:*",
    "@vytches-ddd/events": "workspace:*"
  }
}
```

## 🎯 Development Workflow

### Daily Development

```bash
# Start development mode (watches for changes)
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Build only changed packages
pnpm build:affected

# Test only changed packages
pnpm test:affected
```

### Before Committing

```bash
# Format code
pnpm format

# Lint and fix issues
pnpm lint:fix

# Run affected tests
pnpm test:affected

# Commit (will trigger hooks)
git add .
git commit -m "feat(core): add new feature"
```

### Release Process

```bash
# Create a release (will bump versions and create tags)
pnpm release

# Or manually
pnpm build
pnpm test
pnpm release:version
pnpm release:publish
```

## 🔧 Customization

### Update Package Information

1. **Root package.json**: Update author, repository URL, homepage
2. **Individual packages**: Update descriptions, keywords
3. **README.md**: Update badges and links
4. **GitHub workflows**: Update repository references

### Configure NPM Publishing

1. Create NPM account and get access token
2. Add `NPM_TOKEN` secret to GitHub repository
3. Update registry URLs in package.json files

### Setup Nx Cloud (Optional)

For faster builds with distributed caching:

1. Sign up at [nx.app](https://nx.app)
2. Get access token
3. Add to `nx.json` configuration

## 🚨 Troubleshooting

### Common Issues

1. **pnpm install fails**:

   - Check Node.js version: `node --version`
   - Clear cache: `pnpm store prune`

2. **Build fails**:

   - Check TypeScript errors: `pnpm type-check`
   - Clean and rebuild: `pnpm clean && pnpm build`

3. **Tests fail**:

   - Run specific package: `pnpm nx test core`
   - Check coverage: `pnpm test:coverage`

4. **Linting errors**:
   - Auto-fix: `pnpm lint:fix`
   - Check ESLint config: `.eslintrc.json`

### Getting Help

- Check [Nx documentation](https://nx.dev)
- Check [Lerna documentation](https://lerna.js.org)
- Open issue in GitHub repository

## ✅ Verification Checklist

Before proceeding with development, verify:

- [ ] All packages build successfully (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Git hooks work (make a test commit)
- [ ] Dependency graph is correct (`pnpm graph`)
- [ ] VS Code extensions are installed
- [ ] Documentation is accessible

## 🎉 Next Steps

1. **Copy your existing code** into the appropriate packages
2. **Update examples** with real usage scenarios
3. **Write comprehensive tests** for all components
4. **Update documentation** with your specific patterns
5. **Setup CI/CD** with your GitHub repository
6. **Configure NPM publishing** for releases

**You're ready to build enterprise-grade Domain-Driven Design applications with
VytchesDDD!** 🚀
