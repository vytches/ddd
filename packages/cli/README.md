# VytchesDDD CLI

> 🚀 Enterprise-grade Domain-Driven Design CLI with AI-powered domain modeling

[![npm version](https://img.shields.io/npm/v/@vytches/ddd-cli.svg)](https://www.npmjs.com/package/@vytches/ddd-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

VytchesDDD CLI is a revolutionary command-line tool that generates complete
domain implementations using Domain-Driven Design patterns. It features
AI-powered analysis, intelligent pattern recommendations, and comprehensive code
generation for enterprise-grade applications.

### ✨ Key Features

- **🧠 AI-Powered Domain Analysis** - Natural language processing to extract
  entities, processes, and relationships
- **🎯 Complete Pattern Support** - All VytchesDDD patterns including
  Aggregates, Entities, Value Objects, CQRS, Event Sourcing, Sagas, and more
- **🏗️ Multiple Architectures** - Clean Architecture, Hexagonal, Onion, Modular
  Monolith, and Microservices
- **⚡ Framework Integration** - Built-in support for NestJS, Express, Fastify,
  or standalone TypeScript
- **🗺️ Bounded Context Mapping** - Intelligent context identification with
  relationship mapping
- **🚀 Enterprise Features** - Security, compliance, monitoring, and resilience
  patterns out of the box
- **🤖 Claude Code Integration** - Optimized for AI-assisted development with
  CLAUDE.md generation

## Installation

### Global Installation (Recommended)

```bash
# Using npm
npm install -g @vytches/ddd-cli

# Using pnpm
pnpm add -g @vytches/ddd-cli

# Using yarn
yarn global add @vytches/ddd-cli
```

### Local Installation

```bash
# Add to your project
npm install --save-dev @vytches/ddd-cli

# Or with pnpm
pnpm add -D @vytches/ddd-cli

# Or with yarn
yarn add -D @vytches/ddd-cli
```

## Usage

### Binary Usage (Global Installation)

After global installation, the `vytches-ddd` command is available:

```bash
# Show help and available commands
vytches-ddd --help

# Show version
vytches-ddd --version

# Generate a component interactively
vytches-ddd generate

# Generate specific component
vytches-ddd generate --type aggregate --name Order

# Build complete domain interactively
vytches-ddd domain

# Build domain with options
vytches-ddd domain --name "E-commerce" --structure clean-architecture --framework nestjs
```

### NPM Scripts Usage (Local Installation)

Add to your `package.json`:

```json
{
  "scripts": {
    "ddd": "vytches-ddd",
    "ddd:generate": "vytches-ddd generate",
    "ddd:domain": "vytches-ddd domain",
    "ddd:analyze": "vytches-ddd analyze",
    "ddd:suggest": "vytches-ddd suggest"
  }
}
```

Then run:

```bash
npm run ddd -- --help
npm run ddd:generate -- --type entity --name Customer
npm run ddd:domain
```

### NPX Usage (No Installation)

Run directly without installation:

```bash
# Latest version
npx @vytches/ddd-cli --help
npx @vytches/ddd-cli generate
npx @vytches/ddd-cli domain

# Specific version
npx @vytches/ddd-cli@1.0.0 generate
```

## Commands

### 🔍 discover

AI-powered pattern discovery and implementation guidance with live codebase
validation.

```bash
# Interactive discovery with natural language
vytches-ddd discover "how to create aggregates"
vytches-ddd discover "nestjs integration with events"
vytches-ddd discover "business rules validation"

# With options for tailored guidance
vytches-ddd discover "domain events" --complexity=beginner --format=quick
vytches-ddd discover "cqrs patterns" --complexity=intermediate --format=guided --validate
vytches-ddd discover "microservices architecture" --complexity=advanced --format=detailed

# Short alias
vytches-ddd d "event sourcing patterns"
```

**Options:**

- `--complexity <level>` - Learning complexity level (beginner, intermediate,
  advanced)
- `--format <type>` - Response format:
  - `quick` - Fast imports and package recommendations
  - `guided` - Step-by-step implementation guide
  - `detailed` - Complete learning path with concepts
- `--validate` - Validate recommendations against current codebase
- `--framework <framework>` - Target framework (nestjs, express, fastify)

**AI-Powered Features:**

1. **Intent Classification** - Understands query context (how-to, integration,
   troubleshooting)
2. **Pattern Recognition** - Identifies DDD patterns from natural language
3. **Package Recommendations** - Suggests specific VytchesDDD packages
4. **Live Validation** - Verifies recommendations against actual codebase
5. **Smart Confidence Scoring** - Adjusts confidence based on validation results
6. **Framework Awareness** - Tailors advice for specific frameworks

**Examples:**

```bash
# Learning-focused queries
vytches-ddd discover "how do I start with domain modeling?" --complexity=beginner --format=guided

# Integration queries
vytches-ddd discover "integrate aggregates with nestjs" --format=quick --framework=nestjs

# Troubleshooting queries
vytches-ddd discover "event publishing not working" --format=guided --validate

# Pattern discovery
vytches-ddd discover "what patterns for complex business rules?" --complexity=advanced --format=detailed
```

### 🔧 generate (g)

Generate individual DDD components with intelligent templates.

```bash
# Interactive mode (recommended for beginners)
vytches-ddd generate

# Direct mode with options
vytches-ddd generate --type aggregate --name Order --output ./src/domain

# Short alias
vytches-ddd g -t entity -n Customer
```

**Options:**

- `-t, --type <type>` - Component type (aggregate, entity, value-object,
  specification, policy, command, query, event, repository, domain-service)
- `-n, --name <name>` - Component name
- `-o, --output <path>` - Output directory (default: ./src)
- `-f, --framework <framework>` - Target framework (nestjs, express, fastify,
  standalone)
- `--domain <domain>` - Domain name for the component
- `--with-tests` - Generate tests (default: true)
- `--dry-run` - Preview without creating files
- `--interactive` - Use interactive mode

**Examples:**

```bash
# Generate an aggregate with tests
vytches-ddd generate --type aggregate --name Order --with-tests

# Generate a value object for NestJS
vytches-ddd g -t value-object -n Money -f nestjs

# Generate specification with custom output
vytches-ddd generate --type specification --name OrderCanBeShipped --output ./src/domain/specifications

# Interactive generation with all options
vytches-ddd generate --interactive
```

### 🏗️ domain

Build a complete domain implementation with AI assistance.

```bash
# Interactive guided mode (recommended)
vytches-ddd domain

# Quick start with options
vytches-ddd domain --name "E-commerce Platform" --structure clean-architecture

# Advanced with all options
vytches-ddd domain \
  --name "Healthcare System" \
  --structure microservices \
  --framework nestjs \
  --patterns cqrs,event-sourcing,saga \
  --contexts "Patient Management,Appointment Scheduling,Billing" \
  --security auth,rbac \
  --compliance hipaa \
  --monitoring
```

**Options:**

- `-n, --name <name>` - Domain name
- `-s, --structure <type>` - Architecture structure (clean-architecture,
  hexagonal, onion, modular-monolith, microservices)
- `-f, --framework <framework>` - Target framework (nestjs, express, fastify,
  standalone)
- `--guided` - Use guided workflow with AI assistance
- `--patterns <patterns>` - Comma-separated patterns (cqrs, event-sourcing,
  saga, outbox, etc.)
- `--contexts <contexts>` - Comma-separated bounded contexts
- `--compliance <standards>` - Compliance standards (gdpr, hipaa, sox, pci)
- `--security <features>` - Security features (auth, rbac, encryption, audit)
- `--monitoring` - Include monitoring and observability
- `--dry-run` - Preview the generation plan

**AI-Powered Features:**

The domain builder includes sophisticated AI analysis:

1. **Natural Language Processing** - Describe your domain in plain English
2. **Entity Extraction** - Automatically identifies domain entities
3. **Process Analysis** - Detects business processes and workflows
4. **Relationship Mapping** - Understands entity relationships
5. **Complexity Assessment** - Evaluates domain complexity
6. **Pattern Recommendations** - Suggests appropriate DDD patterns
7. **Architecture Selection** - Recommends optimal architecture

**Example Workflow:**

```bash
# Start interactive domain builder
vytches-ddd domain

# You'll be prompted:
# 1. Describe your business domain in detail
# 2. AI analyzes and extracts domain concepts
# 3. Bounded contexts are identified
# 4. Architecture is recommended based on complexity
# 5. Patterns are orchestrated intelligently
# 6. Complete domain is generated

# Example domain description:
"An e-commerce platform where customers can browse products, add items to cart,
place orders with multiple payment methods. Orders go through fulfillment process
with inventory management. Customers can track shipments and request returns within
30 days. Platform includes seller management with commission calculations."
```

### 📊 analyze

Analyze existing codebase for DDD compliance and improvements.

```bash
# Analyze current directory
vytches-ddd analyze

# Analyze specific path
vytches-ddd analyze --path ./src/domain

# Generate detailed report
vytches-ddd analyze --output report.md --verbose
```

**Options:**

- `-p, --path <path>` - Path to analyze (default: current directory)
- `-o, --output <file>` - Output report file
- `--patterns <patterns>` - Specific patterns to check
- `--verbose` - Detailed analysis output

### 💡 suggest

Get intelligent suggestions for your next development steps.

```bash
# Get contextual suggestions
vytches-ddd suggest

# Specific context suggestions
vytches-ddd suggest --context "I need to add payment processing"

# After generating components
vytches-ddd suggest --after-generate aggregate
```

### ⚡ performance

Analyze and optimize VytchesDDD library performance in your application.

```bash
# Analyze startup performance
vytches-ddd performance analyze

# Profile DI container initialization
vytches-ddd performance profile --focus=di

# Generate performance optimization report
vytches-ddd performance report --output=perf-report.md

# Benchmark specific operations
vytches-ddd performance benchmark --operation=handler-registration
```

**Options:**

- `--focus <area>` - Focus area (di, handlers, events, startup, all)
- `--output <file>` - Output report file
- `--operation <op>` - Specific operation to benchmark
- `--iterations <count>` - Number of benchmark iterations (default: 100)

**Performance Areas:**

1. **DI Container** - Handler discovery and registration optimization
2. **Event Publishing** - Event bus and dispatcher performance
3. **Handler Resolution** - Command/query handler lookup speed
4. **Startup Time** - Application initialization bottlenecks
5. **Memory Usage** - Container and handler memory consumption

### 🔄 workflow

Create custom domain workflows for your team.

```bash
# Start workflow creation
vytches-ddd workflow create

# Run existing workflow
vytches-ddd workflow run my-workflow

# List available workflows
vytches-ddd workflow list
```

## Advanced Usage

### Configuration File

Create `.vytches-ddd.json` in your project root:

```json
{
  "outputDir": "./src",
  "framework": "nestjs",
  "structure": "clean-architecture",
  "templates": {
    "customPath": "./my-templates"
  },
  "defaults": {
    "withTests": true,
    "testFramework": "vitest"
  },
  "naming": {
    "aggregate": "{name}Aggregate",
    "entity": "{name}Entity",
    "valueObject": "{name}ValueObject"
  }
}
```

### Custom Templates

Create custom templates in your project:

```typescript
// my-templates/aggregate.ts.template
import { AggregateRoot, EntityId, DomainEvent } from '@vytches/ddd-core';

export class {{className}} extends AggregateRoot {
  private constructor(
    id: EntityId,
    private readonly props: {{className}}Props
  ) {
    super(id);
  }

  // Custom template logic
}
```

### Integration with CI/CD

```yaml
# .github/workflows/ddd-check.yml
name: DDD Compliance Check

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @vytches/ddd-cli
      - run: vytches-ddd analyze --path ./src
```

## Claude Code Integration

The CLI generates optimized files for AI-assisted development:

### CLAUDE.md

Automatically generated documentation for Claude Code:

- Project structure overview
- Architecture decisions
- Domain model explanation
- Development workflow tips
- Key components listing

### .cursorrules

Rules for Cursor IDE integration:

- DDD principles enforcement
- Code style guidelines
- Testing patterns
- File organization rules

## Examples

### Complete E-commerce Domain

```bash
vytches-ddd domain \
  --name "E-commerce Platform" \
  --structure clean-architecture \
  --framework nestjs \
  --patterns cqrs,event-sourcing,saga \
  --contexts "Catalog,Orders,Payments,Fulfillment,Customers" \
  --security auth,rbac \
  --monitoring
```

### Microservices Architecture

```bash
vytches-ddd domain \
  --name "Banking System" \
  --structure microservices \
  --contexts "Accounts,Transactions,Loans,Customers" \
  --compliance "sox,pci" \
  --patterns outbox,saga,event-sourcing
```

### Simple CRUD with DDD

```bash
vytches-ddd domain \
  --name "Task Manager" \
  --structure hexagonal \
  --framework express \
  --contexts "Tasks,Users"
```

## Best Practices

1. **Start with Interactive Mode** - Let AI guide you through the process
2. **Describe Domains Clearly** - More detail leads to better AI analysis
3. **Review Generated Code** - Customize templates for your needs
4. **Use Dry Run** - Preview changes before generation
5. **Leverage Claude Code** - Use the generated CLAUDE.md for AI assistance

## Troubleshooting

### Performance Issues

1. **Slow DI Container Startup (CRITICAL at 200+ handlers)**

   ```bash
   # Analyze DI performance
   vytches-ddd performance profile --focus=di

   # 🚨 ENTERPRISE WARNING: Performance degrades exponentially
   # • 47 handlers: ~230ms (noticeable)
   # • 100 handlers: ~490ms (poor)
   # • 200 handlers: ~980ms (unacceptable)
   # • 300 handlers: ~1.47s (critical failure)

   # Solutions by handler count:
   vytches-ddd performance analyze --handlers=current
   ```

   **Optimization Strategies by Scale:**

   ```typescript
   // ❌ CRITICAL ISSUE: Reflection scanning (unviable at 200+ handlers)
   await VytchesDDD.discoverAndRegisterHandlers(); // ~1.47s at 300 handlers

   // ✅ 50-100 handlers: Selective registration (~490ms → ~150ms)
   VytchesDDD.registerHandlers([
     { id: 'createUser', handler: CreateUserHandler },
     { id: 'getUser', handler: GetUserHandler },
   ]);

   // ✅ 100-200 handlers: Module-based registration (~980ms → ~200ms)
   VytchesDDD.registerModule('UserManagement', USER_HANDLERS);
   VytchesDDD.registerModule('OrderProcessing', ORDER_HANDLERS);

   // ✅ 200+ handlers: Compile-time registry (1.47s → 83ms - 94% improvement)
   VytchesDDD.configure({
     handlers: GENERATED_HANDLER_REGISTRY, // Build-time generated
     skipDiscovery: true, // Zero reflection overhead
   });

   // ✅ Enterprise: Context partitioning (scales infinitely)
   VytchesDDD.configureContext('UserService', {
     handlers: USER_CONTEXT_HANDLERS, // Only 45 handlers
   });
   ```

2. **Event Publishing Bottlenecks**

   ```bash
   # Analyze event performance
   vytches-ddd performance profile --focus=events

   # Use batch publishing for multiple events
   await eventBus.publishMany([event1, event2, event3]);

   # Enable async processing for non-critical events
   await eventBus.publish(event, { async: true });
   ```

3. **Handler Resolution Delays**

   ```typescript
   // ❌ Slow: Runtime resolution
   const handler = VytchesDDD.resolve<CommandHandler>('CreateUserCommand');

   // ✅ Fast: Pre-resolved handlers with caching
   class MyService {
     private readonly createUserHandler =
       VytchesDDD.resolve<CreateUserHandler>('createUser');

     async createUser(command: CreateUserCommand) {
       return this.createUserHandler.handle(command);
     }
   }
   ```

### Common Issues

1. **TTY Detection Error**

   ```bash
   # Use non-interactive mode
   vytches-ddd generate --type aggregate --name Order
   ```

2. **Permission Errors**

   ```bash
   # Use sudo for global installation
   sudo npm install -g @vytches/ddd-cli
   ```

3. **Template Not Found**
   ```bash
   # Ensure templates directory exists
   vytches-ddd generate --template-dir ./templates
   ```

## Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © VytchesDDD Team

## Support

- 📚 [Documentation](https://github.com/ddd/vytches-ddd)
- 🐛 [Issue Tracker](https://github.com/ddd/ddd/issues)
- 💬 [Discussions](https://github.com/ddd/ddd/discussions)
- 📧 [Email Support](mailto:support@vytches/ddd-core.com)

---

Built with ❤️ by the VytchesDDD team for the Domain-Driven Design community.
