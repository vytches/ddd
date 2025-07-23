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

- ✅ **Comprehensive README** with usage examples and API reference
- ✅ **JSDoc documentation** with LLM-optimized tags (@llm-summary, @llm-domain, @llm-complexity)
- ✅ **Multiple examples** per public API (basic, intermediate, advanced)
- ✅ **Framework integration** examples (NestJS, Express, etc.)
- ✅ **Parameter documentation** with types and constraints
- ✅ **Return value documentation** with error handling
- ✅ **Real-world usage patterns** and best practices

### Quality Standards

- **Package READMEs**: 100% coverage (23/23 packages)
- **Documentation Validation**: Automated JSDoc compliance checking
- **Example Requirements**: Multiple complexity levels per API
- **LLM Optimization**: Structured tags for AI assistance
- **Quality Gates**: Automated validation in CI/CD pipeline

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

1. **CLI-Based Generation**: Use `pnpm cli examples generate <package>` for automated documentation
2. **Complexity Levels**: Generate basic, intermediate, and advanced examples automatically  
3. **Framework Integration**: Generate framework-specific examples (NestJS, Express, etc.)
4. **Validation**: Automated compliance checking with `pnpm cli examples validate`
5. **Publication**: Generate HTML documentation with `pnpm jsdoc:publish`

### Available Tools and Scripts

- **CLI Documentation**: `pnpm cli examples` - Modern documentation generation system
- **JSDoc Tools**: `jsdoc-generator.js`, `jsdoc-validator.js`, `jsdoc-publisher.js`
- **Quality Gates**: Automated validation in CI/CD pipeline
- **Bundle Generation**: `pnpm cli examples bundle` for multi-package documentation

### Quality Assurance

- **Automated Validation**: Quality gates check documentation completeness
- **CLI Integration**: `pnpm cli examples validate --fix` for automatic fixes
- **Real-time Feedback**: Development workflow includes documentation validation
- **Enterprise Standards**: LLM-optimized documentation following ADR-0013

## Architecture Decision Records (ADRs)

See `docs/adr/` for architectural decisions affecting the library design.

## Contributing to Documentation

1. **Use CLI tools**: `pnpm cli examples generate <package>` for automated documentation generation
2. **Follow complexity levels**: Create basic, intermediate, and advanced examples  
3. **Add framework examples**: Include NestJS, Express, or other framework integrations
4. **Include LLM tags**: Use @llm-summary, @llm-domain, @llm-complexity tags
5. **Validate before commit**: Run `pnpm cli examples validate --fix` to ensure compliance
6. **Update package READMEs**: Keep package documentation current with API changes

## Documentation Status

- **Total Packages**: 23 packages  
- **TypeScript Files**: 905 files
- **Package READMEs**: 23/23 (100% coverage)
- **API Documentation**: JSDoc with LLM-optimized tags
- **Quality Gates**: Automated validation and compliance
- **Examples**: Multiple examples per API with real-world usage patterns

## Future Enhancements

- [ ] Interactive API explorer with live code examples
- [ ] Code playground integration for testing examples
- [ ] Advanced CLI features for documentation automation
- [ ] Performance benchmarks and optimization guides  
- [ ] Enterprise deployment and scaling guides
- [ ] Migration guides for major version updates

---

For more information about the library architecture and usage, see the main
[README.md](../README.md) file.
