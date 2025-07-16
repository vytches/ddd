# VytchesDDD Documentation

This directory contains the comprehensive documentation for the VytchesDDD
library.

## Documentation Structure

```
docs/
├── api/                 # Generated API documentation (JSDoc)
├── adr/                # Architecture Decision Records
├── jsdoc-config.json   # JSDoc configuration
└── README.md           # This file
```

## Generating Documentation

### API Documentation (JSDoc)

Generate HTML documentation from JSDoc comments:

```bash
# Generate documentation
pnpm jsdoc:publish

# Generate and serve locally
pnpm jsdoc:serve

# Watch for changes and regenerate
pnpm jsdoc:watch
```

### Access Documentation

After generation, documentation is available at:

- **Local**: `docs/api/index.html`
- **Server**: `http://localhost:8000` (when using `--serve`)

## Documentation Features

### LLM-Optimized Tags

Our JSDoc includes special tags optimized for AI/LLM consumption:

- `@llm-summary`: Brief one-line description
- `@llm-domain`: Domain classification (Core, Pattern, Architecture, etc.)
- `@llm-complexity`: Complexity level (Simple, Medium, Complex, Expert)
- `@llm-contract`: Contract type (Required, Optional, Deprecated)
- `@llm-pure`: Function purity indicator

### Package Documentation

Each package includes:

- ✅ **Comprehensive JSDoc** with 50%+ coverage
- ✅ **LLM-optimized tags** for AI assistance
- ✅ **Multiple examples** per public API
- ✅ **Parameter documentation** with types
- ✅ **Return value documentation**
- ✅ **Error handling documentation**

### Quality Standards

- **Target Coverage**: 95% JSDoc coverage on public APIs
- **Example Requirements**: Minimum 2 examples per public API
- **LLM Compliance**: 100% LLM-tag compliance
- **Manual Review**: 20% manual enhancement of generated docs

## Package Organization

### Core Foundation

- `contracts` - Core interfaces and contracts
- `domain-primitives` - Base classes and errors
- `value-objects` - Value object implementations
- `repositories` - Repository patterns

### Domain Patterns

- `aggregates` - Aggregate root with capabilities
- `policies` - Business policies and validation
- `validation` - Domain validation and specifications
- `domain-services` - Domain service implementations

### Architecture Layer

- `events` - Domain event handling
- `cqrs` - Command Query Responsibility Segregation
- `projections` - Event sourcing projections
- `event-store` - Event storage and replay

### Integration Layer

- `acl` - Anti-corruption layer
- `messaging` - Message handling and sagas
- `di` - Dependency injection

### Infrastructure Layer

- `resilience` - Resilience patterns
- `logging` - Structured logging
- `testing` - Testing utilities
- `utils` - Common utilities

## Development Workflow

### Documentation Generation Process

1. **Automated Generation**: Use TypeScript AST to generate JSDoc
2. **Manual Enhancement**: Review and improve complex cases
3. **Validation**: Ensure compliance with quality standards
4. **Publication**: Generate HTML documentation

### Tools and Scripts

- `jsdoc-generator.js` - TypeScript AST-based JSDoc generator
- `jsdoc-validator.js` - JSDoc compliance validator
- `jsdoc-publisher.js` - HTML documentation generator
- `jsdoc-fixer.js` - Automatic JSDoc tag fixing

### Quality Assurance

- **CI/CD Integration**: JSDoc validation in GitHub Actions
- **Coverage Tracking**: Monitor documentation coverage
- **Quality Scoring**: Automated quality assessment
- **Developer Feedback**: Real-time validation

## Architecture Decision Records (ADRs)

See `docs/adr/` for architectural decisions affecting the library design.

## Contributing to Documentation

1. **Use the JSDoc generator** for initial documentation
2. **Enhance manually** for complex business logic
3. **Include multiple examples** for each public API
4. **Add LLM-optimized tags** for AI assistance
5. **Validate compliance** before committing

## Documentation Status

- **Total Packages**: 24 packages
- **File Coverage**: 77% (267/346 files)
- **API Coverage**: 50% (822/1644 exports)
- **LLM Tags**: Comprehensive coverage
- **Examples**: Multiple examples per API

## Future Enhancements

- [ ] Interactive API explorer
- [ ] Code playground integration
- [ ] Video tutorials
- [ ] Migration guides
- [ ] Performance benchmarks
- [ ] Enterprise deployment guides

---

For more information about the library architecture and usage, see the main
[README.md](../README.md) file.
