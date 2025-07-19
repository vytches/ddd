# Documentation Integration Strategy

## 🎯 Overview - Updated Architecture

This document outlines the updated strategy for integrating documentation generation across the @vytches-ddd library, based on the implemented **Handlebars + Markdown Hybrid Architecture** with **individual examples system**.

## 🏗️ Architecture Components

### 1. **Types & Interfaces in Contracts**
- **Location**: `packages/contracts/src/examples/`
- **Purpose**: Centralized type definitions to avoid circular dependencies
- **Components**:
  - `types.ts` - Core configuration types (PackageExampleConfig, ExampleDefinition, etc.)
  - `base-types.ts` - Shared fundamental types (BaseEntity, Money, EntityId, etc.)
  - `index.ts` - Unified exports

### 2. **Individual Examples System**
- **Structure**: `example-1.md`, `example-2.md`, `example-3.md`
- **Benefits**:
  - Individual tagging for precise discovery
  - Randomization support for varied documentation
  - Priority-based selection
  - Standalone, copy-paste ready examples

### 3. **Package-Specific Types**
- **Location**: `packages/[package]/src/examples/types/`
- **Purpose**: Application-specific types for standalone examples
- **Strategy**: Each package maintains its own types to avoid cross-package dependencies

## 📋 Configuration Structure

Each package contains a comprehensive configuration defining all examples:

```typescript
// packages/[package]/src/examples/config.ts
export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'domain-services',
  displayName: 'Domain Services',
  version: '1.0.0',
  
  // Individual examples with metadata
  examples: [
    {
      id: 'basic-pricing-simple',
      name: 'Simple Pricing Service',
      file: 'basic/example-1.md',
      tags: ['domain-services:basic', 'business-logic:pricing'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic pricing calculation with business rules',
      validation: { fileExists: true }
    },
    // ... more examples
  ]
};
```

## 🎲 Smart Selection Features

### **Priority-Based Selection**
- High priority examples shown first
- Medium/low priority for variety
- Configurable priority filtering

### **Randomization**
- Seeded random selection for reproducible results
- Configurable max examples per complexity level
- Prevents static, predictable documentation

### **Tag-Based Discovery**
- Cross-package integration examples
- Framework-specific filtering
- Pattern-based grouping

## 🔧 Framework Integration Patterns

### **Complexity Levels for Frameworks**
- **Basic**: Manual setup, framework-specific patterns
- **Intermediate**: Hybrid approaches, optional DI integration
- **Advanced**: Full auto-discovery, enterprise patterns

### **Library-First Philosophy**
- Focus on library usage, not framework ceremony
- Thin wrapper services that delegate to library
- No unnecessary controllers, DTOs, or framework boilerplate

## 🎨 Template System

### **Handlebars Templates**
- **Location**: `packages/cli/src/templates/layouts/`
- **Types**:
  - `feature-doc.hbs` - Standard documentation output
  - `llm-optimized.hbs` - LLM code generation optimized

### **Markdown Content**
- **Location**: `packages/[package]/src/examples/`
- **Structure**:
  ```
  packages/[package]/src/examples/
  ├── config.ts                    # Main configuration
  ├── types/                       # Package-specific types
  ├── shared/                      # Shared content
  ├── basic/
  │   ├── example-1.md
  │   ├── example-2.md
  │   └── example-3.md
  ├── intermediate/
  │   ├── example-1.md
  │   ├── example-2.md
  │   └── example-3.md
  ├── advanced/
  │   ├── example-1.md
  │   ├── example-2.md
  │   └── example-3.md
  └── frameworks/
      └── nestjs/
          ├── basic/
          │   ├── example-1.md
          │   └── example-2.md
          ├── intermediate/
          │   ├── example-1.md
          │   └── example-2.md
          └── advanced/
              ├── example-1.md
              └── example-2.md
  ```

## 🔄 Bundle Generation Strategy

### **Multi-Package Documentation**
The system supports generating documentation that spans multiple packages:

```bash
# Single package
pnpm cli examples generate domain-services --complexity intermediate

# Multi-package bundle
pnpm cli examples bundle --packages domain-services,di,events --framework nestjs

# Complete DDD guide
pnpm cli examples bundle --packages core,domain-services,events,cqrs,policies
```

### **Cross-Package Integration**
- Automatic discovery of related examples
- Integration examples between packages
- Shared type definitions from contracts
- Unified import strategies

## 📊 Validation System

### **File Existence Validation**
- Verifies all referenced example files exist
- Reports missing files with suggestions
- Supports auto-fixing for common issues

### **Future Validation Features**
- Syntax validation for code examples
- Compilation testing
- Link validation
- Tag consistency checks

## 🎯 CLI Commands

**IMPORTANT**: All commands use `pnpm cli examples` prefix in the current implementation.

### **Generation Commands**
```bash
# Generate single package documentation
pnpm cli examples generate domain-services --complexity basic,intermediate

# Generate with framework integration
pnpm cli examples generate domain-services --framework nestjs --complexity advanced

# Generate LLM-optimized documentation
pnpm cli examples generate domain-services --llm-optimized --max-examples 5

# Generate bundle with randomization
pnpm cli examples bundle --packages domain-services,di --randomize --seed my-seed
```

### **Discovery Commands**
```bash
# Find examples by tags
pnpm cli examples find-by-tag "domain-services:basic" --max-examples 3

# Find framework examples
pnpm cli examples find-by-tag "nestjs:intermediate" --framework nestjs

# Find integration examples
pnpm cli examples find-by-tag "di:domain-services" --complexity advanced
```

### **Validation Commands**
```bash
# Validate all examples
pnpm cli examples validate

# Validate specific package
pnpm cli examples validate --package domain-services

# Validate and fix issues
pnpm cli examples validate --package domain-services --fix
```

## 🚀 Benefits of This Architecture

### **For Library Maintainers**
- **Modular**: Easy to add new examples without touching existing ones
- **Maintainable**: Clear separation of concerns
- **Scalable**: Individual examples can be updated independently
- **Testable**: Each example can be validated individually

### **For Library Users**
- **Discoverable**: Smart tagging helps find relevant examples
- **Varied**: Randomization prevents seeing the same examples repeatedly
- **Practical**: Library-first approach focuses on actual usage
- **Flexible**: Can generate documentation for specific needs

### **For Documentation**
- **Consistent**: Standardized structure across all packages
- **Rich**: Multiple examples per complexity level
- **Contextual**: Framework-specific integration patterns
- **Comprehensive**: Single and multi-package documentation support

## 🔮 Future Enhancements

### **Planned Features**
1. **Versioning Support**: Example compatibility with library versions
2. **Prerequisites**: Example dependencies and learning paths
3. **Multiple Formats**: HTML, PDF, Jupyter notebook output
4. **Advanced Validation**: Syntax checking, compilation testing
5. **Performance Optimization**: Caching and incremental generation

### **Potential Integrations**
- **IDE Integration**: VSCode extension for example discovery
- **API Documentation**: OpenAPI spec generation from examples
- **Testing Integration**: Example-based integration tests
- **Community Examples**: External example submissions

## 📝 Implementation Status

### **Completed** ✅
- Types moved to contracts package
- Individual examples system implemented
- Configuration structure established
- Basic validation (file existence)
- CLI commands implemented
- Template system created
- Domain-services and DI example systems created

### **In Progress** 🔄
- Framework example updates (removing controllers)
- Additional examples for intermediate/advanced levels
- Cross-package integration examples

### **Planned** 📋
- Additional package example systems
- Enhanced validation features
- Performance optimizations
- Community contribution guidelines

---

This strategy provides a solid foundation for scalable, maintainable documentation generation while focusing on practical library usage and user needs.