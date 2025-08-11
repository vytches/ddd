# Lessons Learned Repository

## Purpose

This directory captures knowledge gained from completed tasks, successful
patterns, failures, and improvements. It serves as our institutional memory and
continuous improvement system.

## Categories

### 🏗️ Architecture Patterns

- [Unified Event Bus](./2024-01-unified-event-bus.md) - Consolidation pattern
  success
- [Meta-Package Pattern](./2024-01-meta-package.md) - 99.2% bundle reduction
  technique
- [Circular Dependency Resolution](./2024-01-circular-deps.md) - Contracts
  package solution

### 🛠️ Implementation Techniques

- [safeRun Pattern](./saferun-pattern.md) - Error handling in tests
- [Repository Event Publishing](./repository-events.md) - Automatic event
  publishing
- [Context Isolation](./context-isolation.md) - DI without framework coupling

### 📦 Package Management

- [Monorepo Structure](./monorepo-lessons.md) - What works with 22 packages
- [Import Strategy](./import-strategy.md) - Internal vs external imports
- [Tree Shaking](./tree-shaking.md) - Optimization techniques

### 🧪 Testing Strategies

- [Test Organization](./test-organization.md) - tests/ vs src/ directory
- [Coverage Strategies](./coverage-strategies.md) - Achieving >80%
- [Performance Testing](./performance-testing.md) - Benchmarking approaches

### 🚨 Failures & Recovery

- [Failed Approaches](./failures/README.md) - What didn't work and why
- [Migration Mistakes](./failures/migration-mistakes.md) - Breaking changes
  avoided
- [Performance Regressions](./failures/performance-issues.md) - Caught and fixed

## Key Insights

### Top 10 Lessons (2024)

1. **Start Simple, Iterate**: Complex abstractions early lead to refactoring
2. **Performance First**: Measure before optimizing, but design for performance
3. **Context Matters**: Domain context drives technical decisions
4. **Test Organization**: Keep tests outside src/ to prevent circular deps
5. **Bundle Size**: Every KB matters in enterprise libraries
6. **Event Patterns**: Unified approaches beat specialized implementations
7. **Documentation**: LLM-optimized docs improve adoption
8. **Type Safety**: No `any` without strong justification
9. **Incremental Migration**: Big bang refactors always fail
10. **Agent Collaboration**: Multi-agent approaches solve complex problems
    faster

## Pattern Library

### Successful Patterns

```typescript
// ✅ Repository with automatic event publishing
class Repository {
  async save(aggregate: Aggregate): Promise<void> {
    await this.persist(aggregate);
    await this.eventBus.publish(aggregate.getUncommittedEvents());
    aggregate.markEventsAsCommitted();
  }
}

// ✅ Context-aware routing
class UnifiedEventBus {
  publish(event: Event, context?: string): void {
    this.subscribers
      .filter(s => !context || s.context === context)
      .forEach(s => s.handle(event));
  }
}

// ✅ safeRun for test error handling
const [error, result] = safeRun(() => riskyOperation());
expect(error).toBeNull();
```

### Anti-Patterns to Avoid

```typescript
// ❌ Multiple specialized implementations
class DomainEventBus {}
class IntegrationEventBus {}
class AuditEventBus {}

// ❌ Tests in src directory
src / component.ts;
component.test.ts; // Causes circular deps

// ❌ Anemic domain models
class OrderService {
  validateOrder(order: Order): boolean {
    // Logic should be in Order aggregate
  }
}
```

## Metrics & Improvements

### Success Metrics

- **Task Completion Rate**: 95%
- **Estimate Accuracy**: ±20%
- **Regression Rate**: <5%
- **Pattern Reuse**: 70%

### Process Improvements

1. **Task Templates**: Standardized format improves clarity
2. **Agent Specialization**: Clear roles prevent overlap
3. **Parallel Execution**: 40% faster with concurrent agents
4. **Automated Validation**: Catch issues before manual review

## How to Contribute

### Adding Lessons Learned

1. Complete a task
2. Document what worked/didn't work
3. Create entry in appropriate category
4. Link from completed task
5. Update this README with key insights

### Template for New Lessons

```markdown
# Lesson: [Title]

## Context

- **Task**: [Link to task]
- **Date**: YYYY-MM-DD
- **Category**: [Architecture|Implementation|Testing|Process]

## What We Learned

### The Problem

[Description of challenge faced]

### The Solution

[What worked and why]

### Key Insights

- [Insight 1]
- [Insight 2]

## Recommendations

- [Future application of this lesson]
- [When to use this pattern]
- [When NOT to use this pattern]

## Related Lessons

- [Links to related insights]
```

## Annual Review Process

Every year, we review lessons learned to:

1. Identify recurring patterns
2. Update best practices
3. Retire outdated approaches
4. Plan architectural improvements

---

_Managed by Project Orchestrator | Living document - continuously updated_
