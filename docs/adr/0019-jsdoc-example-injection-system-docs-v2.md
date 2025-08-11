# ADR-0019: JSDoc Example Injection System - Docs V2

**Status**: Accepted  
**Date**: 2025-07-29  
**Author**: Development Team

## Context

As our DDD library grows, providing comprehensive and accurate code examples in
JSDoc documentation becomes increasingly challenging. Developers need:

1. **Method-specific examples** directly in their IDE tooltips and IntelliSense
2. **Layer-appropriate examples** showing domain, service, and integration
   patterns
3. **Consistent quality** across all documentation
4. **Maintainable examples** that stay in sync with the codebase
5. **TypeScript syntax highlighting** in documentation

Currently, examples are scattered across various documentation files and are not
automatically injected into JSDoc comments, leading to:

- Outdated examples in JSDoc comments
- Inconsistent example quality
- Manual maintenance burden
- Lack of architectural layer examples

## Decision

We will implement a **JSDoc Example Injection System** that:

1. **Extracts tagged examples** from centralized markdown files
2. **Injects examples automatically** during build time
3. **Validates example quality** with defined rules
4. **Supports multiple architectural layers** (domain/service/integration)
5. **Provides zero-configuration** developer experience

### Architecture Overview

```
docs/examples/domain/
├── domain-primitives/    # 5 methods × 3 layers = 15 examples
├── value-objects/        # 5 methods × 3 layers = 15 examples
└── aggregates/          # 5 methods × 3 layers = 15 examples

Total: 45 examples for Phase 1
```

### Technical Implementation

1. **Example Tagging System**

   ```markdown
   @extract: methodName:layer:complexity const example = Code.here();
   @extract-end
   ```

2. **Build-Time Injection**

   ```typescript
   /**
    * Creates a new user
    * @example-inject  // Automatically replaced during build
    */
   ```

3. **Vite Plugin Integration**
   ```typescript
   export default defineConfig({
     plugins: [createJSDocExamplesPlugin()],
   });
   ```

## Consequences

### Positive

1. **Developer Experience**

   - ✅ IDE shows relevant examples with TypeScript highlighting
   - ✅ Zero configuration needed (`@example-inject`)
   - ✅ Examples always up-to-date

2. **Code Quality**

   - ✅ Centralized example management
   - ✅ Automated validation (line limits, required elements)
   - ✅ Consistent example structure

3. **Architecture Alignment**

   - ✅ Layer-specific examples (domain/service/integration)
   - ✅ DDD patterns properly demonstrated
   - ✅ Progressive complexity (basic/intermediate/advanced)

4. **Maintainability**
   - ✅ Single source of truth for examples
   - ✅ Build-time validation catches issues early
   - ✅ Easy to update examples in one place

### Negative

1. **Build Complexity**

   - ❌ Additional build step required
   - ❌ Slightly increased build time
   - ❌ Vite plugin dependency

2. **Initial Investment**

   - ❌ 45 examples needed for Phase 1
   - ❌ Learning curve for tagging system
   - ❌ Migration effort for existing examples

3. **Constraints**
   - ❌ Examples limited by line count (5/8/10 lines)
   - ❌ Must follow strict validation rules
   - ❌ TypeScript/JavaScript only (no other languages)

## Implementation Details

### Core Components

1. **ExampleEngine**: Centralized extraction and validation
2. **TagExtractor**: Parses `@extract` tags from markdown
3. **FileScanner**: Discovers and processes example files
4. **ExampleValidator**: Enforces quality rules
5. **JSDocAdapter**: Handles `@example-inject` processing
6. **Vite Plugin**: Build-time integration

### Validation Rules

```typescript
interface ExampleValidationRules {
  domain: {
    maxLines: 5;
    required: ['setup', 'execution', 'return'];
    forbidden: ['async', 'await', 'repository'];
  };
  service: {
    maxLines: 8;
    required: ['command/query', 'service_call', 'result_handling'];
  };
  integration: {
    maxLines: 10;
    required: ['persistence', 'event_publishing'];
  };
}
```

### Example Format

````typescript
/**
 * Creates a new user with validation
 * @example
 * ```typescript
 * const userData = { name: 'John Doe', email: 'john@example.com' };
 * const user = User.create(userData);
 * return user; // Result<User, ValidationError>
 * ```
 */
````

## Migration Strategy

1. **Phase 1** (Week 1-4): Foundation packages

   - domain-primitives (5 methods)
   - value-objects (5 methods)
   - aggregates (5 methods)

2. **Phase 2** (Future): Pattern layer packages

   - validation, policies, domain-services

3. **Phase 3** (Future): Architecture layer packages
   - events, cqrs, projections

## Monitoring and Success Metrics

1. **Coverage**: % of public methods with examples
2. **Build Performance**: < 2s impact on build time
3. **Developer Satisfaction**: Survey feedback
4. **Example Quality**: Validation pass rate
5. **Usage Analytics**: IDE tooltip engagement

## References

- [JSDOC_EXAMPLES_ROADMAP.md](../JSDOC_EXAMPLES_ROADMAP.md) - Implementation
  roadmap
- [ADR-0013](./0013-enterprise-documentation-standards-and-llm-optimization.md) -
  Documentation standards
- [TypeDoc Documentation](https://typedoc.org/) - JSDoc rendering
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html) - Build
  integration

## Appendix: Example Output

### Before (Manual JSDoc)

```typescript
/**
 * Creates a new user
 * @example
 * // Create user
 * const user = User.create(data);
 */
```

### After (Automatic Injection)

````typescript
/**
 * Creates a new user
 * @example
 * ```typescript
 * const userData = { name: 'John Doe', email: 'john@example.com' };
 * const user = User.create(userData);
 * return user; // Result<User, ValidationError>
 * ```
 */
````

With full TypeScript syntax highlighting and IntelliSense support!
