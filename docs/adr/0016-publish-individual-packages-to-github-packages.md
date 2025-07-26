# ADR-0016: Publish Individual Packages with Organization Scope to GitHub Packages

## Status

**ACCEPTED** - July 24, 2025

## Context

VytchesDDD library is built as a monorepo with 20+ individual packages (core,
logging, policies, messaging, etc.) designed for enterprise Domain-Driven Design
implementations. We needed to decide on the publication strategy that would best
serve enterprise users while maintaining clean import paths and modularity
benefits.

### Current Architecture

- **Foundation Layer**: domain-primitives, contracts, utils (0 dependencies)
- **Core Layer**: core, logging, aggregates (depends on foundation)
- **Advanced Layer**: policies, messaging, cqrs (depends on core)
- **Meta-packages**: Some packages re-export from others for API stability

### Options Considered

1. **Monolithic Package**: Bundle everything into single `vytches-ddd` package
2. **GitHub Direct Install**: Use `github:org/vytches-ddd` with exports
3. **Single Package with Sub-Exports**: One package with paths like `ddd/core`
4. **Organization-Scoped Packages**: Individual packages as `@vytches/ddd-*`

## Decision

We will **publish individual packages under @vytches/ddd-core organization
scope** to GitHub Packages with independent versioning.

### Package Structure

```
Organization: @vytches/ddd-core
Packages:
  @vytches/ddd-core@1.0.0
  @vytches/ddd-logging@1.2.0
  @vytches/ddd-policies@2.1.0
  ... (each with independent version)
Registry: GitHub Packages
```

### Publication Configuration

- **Registry**: GitHub Packages (`https://npm.pkg.github.com`)
- **Organization**: `@vytches/ddd-core`
- **Package Names**: `@vytches/ddd-core`, `@vytches/ddd-logging`, etc.
- **Access**: Restricted (requires GitHub token)
- **Versioning**: Independent versioning with Lerna

## Rationale

### ✅ **Benefits of Organization-Scoped Packages**

1. **Professional Import Paths**

   - Clean imports: `import { Logger } from '@vytches/ddd-logging'`
   - Industry standard pattern: matches NestJS, Angular, Vue
   - No personal names, transferable with repository

2. **Independent Versioning**

   - Each package versions independently
   - Teams can work on different packages without coordination
   - Only changed packages get new versions
   - Lerna tracks changes automatically

3. **Optimized Installation**

   - Install only what you need: `pnpm add @vytches/ddd-core`
   - Smaller bundle sizes for minimal applications
   - Clear dependency tree

4. **GitHub Organization Benefits**

   - Organization name transfers with repository sale
   - Professional appearance for enterprise library
   - Easy migration to npm registry later

5. **Developer Experience**
   - Clear import intentions: `import { Logger } from '@vytches/ddd-logging'`
   - Better IDE support with explicit package boundaries
   - Follows established patterns from major frameworks
   - Semantic versioning per package

### 🚫 **Drawbacks Considered**

1. **More Complex Publishing**

   - Need to manage multiple package versions
   - **Mitigation**: Lerna automates version management

2. **GitHub Packages Authentication**

   - Users still need GitHub token
   - **Mitigation**: Clear setup documentation and .npmrc examples

3. **Multiple Package Installation**
   - Users need to install multiple packages
   - **Mitigation**: Better than downloading unused code

## Implementation

### 1. Lerna Configuration

```json
{
  "version": "independent",
  "npmClient": "pnpm",
  "command": {
    "publish": {
      "registry": "https://npm.pkg.github.com",
      "conventionalCommits": true
    }
  }
}
```

### 2. Publishing Workflow

```bash
# Check what changed
pnpm release:changed

# Publish changed packages
pnpm release
```

### 3. User Installation

```bash
# .npmrc configuration
echo "@vytches/ddd-core:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc

# Install only what you need
pnpm add @vytches/ddd-core @vytches/ddd-logging
```

### 4. Usage Patterns

```typescript
// Lightweight apps - install only what's needed
import { AggregateRoot } from '@vytches/ddd-core';

// Full enterprise apps - selective installation
import { AggregateRoot } from '@vytches/ddd-core';
import { Logger } from '@vytches/ddd-logging';
import { PolicyBuilder } from '@vytches/ddd-policies';
import { OutboxPattern } from '@vytches/ddd-messaging';
```

## Consequences

### **Positive**

- ✅ **Professional Branding**: `@vytches/ddd-*` looks enterprise-ready
- ✅ **Independent Development**: Teams work on packages separately
- ✅ **Optimized Bundles**: Users only install what they need
- ✅ **Version Clarity**: Each package has clear semantic versioning
- ✅ **Easy npm Migration**: Same package names work on npm registry
- ✅ **Industry Standard**: Follows patterns from NestJS, Angular, Vue

### **Negative**

- ❌ **Setup Complexity**: Users need GitHub Packages configuration
- ❌ **Multiple Installations**: More packages to install
- ❌ **Publishing Complexity**: Lerna adds some overhead

## Migration to npm

When ready for public release:

```json
// Simply change registry in lerna.json
"command": {
  "publish": {
    "registry": "https://registry.npmjs.org",
    "access": "public"
  }
}
```

Package names remain identical: `@vytches/ddd-*`

## Monitoring

We will track the success of this decision through:

- **Version Adoption**: Which package versions are most used
- **Installation Patterns**: Common package combinations
- **Developer Feedback**: Survey on import experience
- **Change Frequency**: How often each package updates

## Related Decisions

- **ADR-0002**: Meta-package pattern for enterprise API stability
- **ADR-0005**: Modular package architecture with clear boundaries
- **ADR-0015**: TypeScript configuration standardization

---

**Decision made by**: Development Team  
**Date**: July 24, 2025  
**Review date**: January 24, 2026
