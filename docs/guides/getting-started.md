# Getting Started with VytchesDDD

This guide will help you get started with VytchesDDD library.

## Installation

### Core Package

```bash
npm install @vytches-ddd/core
```

### Enterprise Bundle

```bash
npm install @vytches-ddd/enterprise
```

## Basic Usage

```typescript
import { ValueObject, Entity } from '@vytches-ddd/core';

// Your first Value Object
class Email extends ValueObject<string> {
  // Implementation here
}
```

## Package Structure

### Foundation

- **@vytches-ddd/core** - Core DDD building blocks (Value Objects, Entities,
  Aggregates)
- **@vytches-ddd/utils** - Common utilities and helpers

### Patterns

- **@vytches-ddd/validation** - Business rules, specifications, and validation
  patterns
- **@vytches-ddd/policies** - Business policies and domain policies

### Architecture

- **@vytches-ddd/events** - Event-driven architecture components
- **@vytches-ddd/cqrs** - Command Query Responsibility Segregation
- **@vytches-ddd/projections** - Event projections and read models

### Integration

- **@vytches-ddd/acl** - Anti-Corruption Layer for external systems
- **@vytches-ddd/messaging** - Outbox pattern, sagas, and messaging patterns

### Infrastructure

- **@vytches-ddd/resilience** - Circuit breakers, retry patterns, timeouts

### Tooling

- **@vytches-ddd/testing** - Test utilities for DDD patterns
- **@vytches-ddd/cli** - Code generation and development tools

### Bundle

- **@vytches-ddd/enterprise** - All-in-one enterprise bundle

## Bundle Strategies

The project supports different bundle strategies:

- **core-bundle**: `core`, `utils`, `validation`
- **advanced-bundle**: `core-bundle` + `events`, `cqrs`, `projections`
- **enterprise-bundle**: `advanced-bundle` + `acl`, `policies`, `messaging`,
  `resilience`
