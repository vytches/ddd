# Package Documentation Template

This template provides a consistent structure for documenting VytchesDDD packages. It's designed to be both human-readable and LLM-friendly for optimal AI assistance.

> **Note:** This template implements the standards defined in [ADR-0013: Enterprise Documentation Standards and LLM Optimization](../adr/0013-enterprise-documentation-standards-and-llm-optimization.md).

## File Structure

```
packages/[package-name]/
├── README.md                 # Main package documentation
├── API.md                    # Detailed API reference
├── CHANGELOG.md              # Version history
├── EXAMPLES.md               # Usage examples
├── MIGRATION.md              # Migration guide (if applicable)
└── src/
    ├── index.ts              # Main exports with JSDoc
    ├── types/                # Type definitions
    └── **/*.ts               # All source files with JSDoc
```

## README.md Template

```markdown
# @vytches-ddd/[package-name]

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2F[package-name].svg)](https://badge.fury.io/js/%40vytches-ddd%2F[package-name])
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **[One-line description of the package purpose]**

[2-3 sentence description explaining what the package does, its role in DDD, and key benefits]

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Integration Patterns](#integration-patterns)
- [Performance](#performance)
- [Testing](#testing)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/[package-name]

# yarn
yarn add @vytches-ddd/[package-name]

# pnpm
pnpm add @vytches-ddd/[package-name]
```

### Peer Dependencies

```bash
# Required for full functionality
npm install [peer-dependencies]
```

## ✨ Key Features

### [Feature Category 1]
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits

### [Feature Category 2]
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits

### [Feature Category 3]
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits
- **[Feature Name]**: Description of the feature and its benefits

## 🎯 Core Concepts

### [Concept 1]

[Explanation of the concept with code example]

```typescript
// Interface or type definition
interface IConcept {
  // Properties and methods
}

// Implementation example
class ConceptImplementation implements IConcept {
  // Implementation details
}
```

### [Concept 2]

[Explanation of the concept with code example]

```typescript
// Code example showing the concept
```

### [Concept 3]

[Explanation of the concept with code example]

```typescript
// Code example showing the concept
```

## 🚀 Quick Start

### 1. Basic Usage

```typescript
// Import statements
import { MainClass, ImportantType } from '@vytches-ddd/[package-name]';

// Basic usage example
const example = new MainClass();
const result = example.someMethod();

// Show the result
console.log(result);
```

### 2. [Common Use Case]

```typescript
// More complex example showing common use case
// Include full working code that can be copy-pasted
```

### 3. [Integration Example]

```typescript
// Show how it integrates with other VytchesDDD packages
```

## 📚 API Reference

### [MainClass]

**Constructor:**

```typescript
constructor(config?: ConfigType)
```

**Properties:**

```typescript
readonly property: PropertyType;
```

**Methods:**

```typescript
methodName(param: ParamType): ReturnType;
```

**Example Usage:**

```typescript
const instance = new MainClass();
const result = instance.methodName(parameter);
```

### [SecondaryClass]

[Similar structure for each public class]

### [TypeDefinitions]

```typescript
interface ConfigType {
  option1: string;
  option2?: number;
  option3: boolean;
}

type ReturnType = {
  success: boolean;
  data?: any;
  error?: Error;
};
```

## 🔧 Advanced Usage

### [Advanced Feature 1]

```typescript
// Advanced usage example with explanation
```

### [Advanced Feature 2]

```typescript
// Advanced usage example with explanation
```

### [Advanced Feature 3]

```typescript
// Advanced usage example with explanation
```

## 🔗 Integration Patterns

### [Framework Integration]

```typescript
// Show how to integrate with popular frameworks
```

### [Other VytchesDDD Packages]

```typescript
// Show integration with other packages in the ecosystem
```

## ⚡ Performance

### Optimization Tips

```typescript
// Performance optimization examples
```

### Benchmarks

```typescript
// Performance characteristics
const benchmarks = {
  throughput: 'X operations/second',
  latency: '< Xms',
  memoryUsage: '< XMB'
};
```

## 🧪 Testing

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { MainClass } from '@vytches-ddd/[package-name]';

describe('MainClass', () => {
  it('should work correctly', () => {
    // Test example
  });
});
```

### Integration Testing

```typescript
// Integration test examples
```

## 📈 Migration Guide

### From v1.x to v2.x

[Migration instructions if applicable]

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/PawelGozdz/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches-ddd/[package-name]

# Run tests
pnpm test --filter=@vytches-ddd/[package-name]

# Run in development mode
pnpm dev --filter=@vytches-ddd/[package-name]
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches-ddd](https://github.com/PawelGozdz/vytches-ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).
```

## JSDoc/TSDoc Standards

All public APIs should be documented with JSDoc comments:

```typescript
/**
 * [Brief description of the class/function]
 *
 * [Detailed description with examples if needed]
 *
 * @example
 * ```typescript
 * const instance = new ExampleClass();
 * const result = instance.method();
 * ```
 *
 * @public
 * @since 1.0.0
 */
export class ExampleClass {
  /**
   * [Method description]
   *
   * @param param1 - Description of first parameter
   * @param param2 - Description of second parameter
   * @returns Description of what is returned
   *
   * @example
   * ```typescript
   * const result = instance.method('value', 42);
   * ```
   *
   * @throws {Error} When invalid parameters are provided
   * @since 1.0.0
   */
  public method(param1: string, param2: number): ResultType {
    // Implementation
  }
}
```

## LLM-Friendly Documentation Guidelines

### 1. Structure for AI Consumption

- **Consistent Headers**: Use the same hierarchy across all packages
- **Code Examples**: Always include complete, runnable examples
- **Type Information**: Include full type definitions with descriptions
- **Context Clues**: Add context about when and why to use features

### 2. Metadata for AI Assistance

Add structured metadata at the beginning of README files:

```markdown
<!-- LLM-METADATA
Package: @vytches-ddd/[package-name]
Category: [Foundation|Patterns|Architecture|Integration|Infrastructure|Utility]
Purpose: [Brief description]
Dependencies: [List of peer dependencies]
Complexity: [Low|Medium|High]
-->
```

### 3. Pattern Recognition

Use consistent patterns that LLMs can recognize:

```typescript
// Always use this pattern for examples
import { MainClass } from '@vytches-ddd/package-name';

// Setup
const instance = new MainClass(config);

// Usage
const result = instance.method(parameters);

// Result handling
if (result.isSuccess()) {
  // Success path
} else {
  // Error handling
}
```

### 4. Integration Examples

Always show integration with other VytchesDDD packages:

```typescript
// Show how packages work together
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { EventBus } from '@vytches-ddd/events';
import { CommandHandler } from '@vytches-ddd/cqrs';

// Integration example
@CommandHandler(SomeCommand)
class SomeHandler {
  async execute(command: SomeCommand): Promise<void> {
    // Show the integration
  }
}
```

## Quality Checklist

Before publishing package documentation:

- [ ] All sections are filled with relevant content
- [ ] Code examples are tested and working
- [ ] JSDoc comments are complete for all public APIs
- [ ] Migration guide is provided if there are breaking changes
- [ ] Performance characteristics are documented
- [ ] Testing examples are provided
- [ ] Integration patterns are shown
- [ ] LLM metadata is included
- [ ] Links to related packages are provided
- [ ] Contributing guidelines are referenced

## Automation

Consider using these tools to maintain documentation quality:

```bash
# Generate API documentation
pnpm exec typedoc --out docs/api src/index.ts

# Validate documentation
pnpm exec markdownlint README.md

# Check for broken links
pnpm exec markdown-link-check README.md

# Spell check
pnpm exec cspell "**/*.md"
```

This template ensures consistency across all packages while being optimized for both human developers and AI assistance.