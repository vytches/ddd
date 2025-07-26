# ADR-0015: Individual Example System for Documentation Generation

**Status**: Accepted  
**Date**: 2025-01-17  
**Author**: Claude AI Assistant

## Context

Our documentation generation system needs to support:

- Granular example selection with individual tagging
- Random selection with limits (e.g., "show 5 random examples")
- Complexity levels for progressive learning
- Multi-package documentation bundling
- Standalone examples without cross-dependencies
- Library-first philosophy (no framework ceremony)

The previous approach used single files per complexity level, which limited
flexibility in tagging and selection.

## Decision

We will implement an **Individual Example System** with the following
characteristics:

### 1. File Structure

```
packages/[package]/examples/
├── basic/
│   ├── example-1.md    # Each example in its own file
│   ├── example-2.md
│   └── example-3.md
├── frameworks/
│   └── nestjs/
│       ├── example-1.md    # Simple naming convention
│       ├── example-2.md
│       └── example-3.md
└── types/              # Type definitions as .md files
    ├── user.md
    ├── product.md
    └── order.md
```

### 2. Configuration Structure

```typescript
export const packageExampleConfig: PackageExampleConfig = {
  examples: [
    {
      id: 'basic-pricing-simple',
      name: 'Simple Pricing Service',
      file: 'basic/example-1.md',
      tags: ['domain-services:basic', 'business-logic:pricing'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic pricing calculation with business rules',
    },
  ],
};
```

### 3. Type System Architecture

#### Shared Types in Contracts

```typescript
// @vytches/ddd-contracts/src/examples/types.ts
export interface PackageExampleConfig {
  // Configuration types to prevent circular dependencies
}
```

#### Package-Specific Types as Markdown

````markdown
<!-- packages/domain-services/examples/types/user.md -->

# User Types

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CreateUserData {
  email: string;
  name: string;
}
```
````

````

### 4. CLI Integration Strategy

```bash
# Generate documentation for single package
vytches-ddd generate domain-services --complexity intermediate
vytches-ddd generate policies --framework nestjs --llm-optimized
vytches-ddd generate di --max-examples 5 --show-related

# Manage examples with dedicated command
vytches-ddd examples generate policies --complexity intermediate
vytches-ddd examples bundle --packages policies,domain-services
vytches-ddd examples find-by-tag "policies:core"
vytches-ddd examples validate --package policies --fix
````

### 5. Smart Selection Features

- **Priority-based selection**: High priority examples shown first
- **Tag-based filtering**: Select examples by specific tags
- **Seeded randomization**: Reproducible "random" selection
- **Complexity progression**: Basic → Intermediate → Advanced
- **Cross-package discovery**: Find integration examples

## Consequences

### Positive

1. **Granular Control**: Each example can be individually tagged and selected
2. **Flexible Documentation**: Easy to generate custom documentation bundles
3. **No Circular Dependencies**: Types in contracts, examples are standalone
4. **Progressive Learning**: Clear complexity levels for different audiences
5. **Library Focus**: Examples show library usage, not framework ceremony
6. **Markdown Types**: Types as documentation, not real imports
7. **Unified CLI**: Documentation generation integrated into main generate
   command

### Negative

1. **More Files**: Individual files increase file count
2. **Configuration Overhead**: Each example needs metadata
3. **Type Duplication**: Package-specific types might overlap
4. **CLI Complexity**: Multiple ways to generate documentation

### Neutral

1. **Simple Naming**: `example-1.md` relies on config for context
2. **Manual Type Management**: Types as .md files require manual sync

## Implementation Details

### Type Files as Markdown

Types are now markdown files that can be included in documentation:

````markdown
<!-- types/user.md -->

# User Types

```typescript
// Import from your application
import { User, CreateUserData } from './types';

// Or define inline if needed
export interface User {
  id: string;
  email: string;
  name: string;
}
```
````

````

Examples then reference these types:

```typescript
// In example-1.md
import { User, CreateUserData } from './types/user';
````

### CLI Command Structure

1. **Primary Command**: `vytches-ddd generate <package>` for single package
   documentation
2. **Secondary Command**: `vytches-ddd examples <subcommand>` for advanced
   example management
3. **Unified Interface**: Both commands use the same underlying generation
   system

### Framework Complexity Levels

- **Beginner**: Manual instantiation, no DI complexity
- **Intermediate**: Optional DI usage, standard patterns
- **Advanced**: Full DI integration, enterprise patterns

## Alternatives Considered

1. **Single File Per Category**: All examples in one file

   - Rejected: Limited tagging and selection flexibility

2. **Real TypeScript Types**: Import actual .ts files

   - Rejected: Creates circular dependencies

3. **Complex Naming**: `di-manual-nestjs-1.md`

   - Rejected: Folder structure provides context

4. **Separate Documentation CLI**: Keep `docs` command separate
   - Rejected: Users expect unified `generate` command

## Migration Path

1. Move shared types to `@vytches/ddd-contracts`
2. Convert existing examples to individual files
3. Update configurations with metadata
4. Convert type files from .ts to .md
5. Update CLI to support both generate and examples commands
6. Remove unnecessary framework files (controllers)

## References

- Storybook's Component Story Format (CSF)
- TypeDoc's example management
- Docusaurus documentation patterns
- JSDoc @example tags
- Angular CLI's generate command patterns
