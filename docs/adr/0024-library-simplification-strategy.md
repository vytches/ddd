# ADR-0024: VytchesDDD Library Simplification Strategy

**Status**: Proposed  
**Date**: 2025-01-15  
**Supersedes**: None  
**Context**: Library complexity reduction for enterprise adoption

## Problem Statement

VytchesDDD currently has 21 packages creating a 15+ minute onboarding experience
that hinders enterprise adoption. Market feedback indicates developers want
"MediatR + Aggregates for TypeScript" with minimal complexity.

**Current Pain Points**:

- 21 packages overwhelm new developers
- Complex dependency chains
- Unclear "getting started" path
- Analysis paralysis in package selection
- Competitive disadvantage vs simpler alternatives

## Decision

**Simplify from 22 to 15 packages** while preserving core DDD value and
enterprise features.

### Packages to Eliminate (7 packages)

#### 1. **@vytches/ddd-event-scheduling** → Merge into @vytches/ddd-events

**Rationale**: Event scheduling is a specialized feature, not core DDD

- Current: 29 lines of implementation (minimal value)
- Better alternatives: pg-boss, agenda, bull/bullmq
- Decision: Remove package, document external alternatives

#### 2. **@vytches/ddd-sagas** → Document external orchestration

**Rationale**: No mature TypeScript alternatives, but ours is over-engineered

- Current: 794 lines of complex orchestration
- Market research: No established TypeScript saga libraries
- Decision: Remove over-engineered implementation, recommend Temporal.io

#### 3. **@vytches/ddd-process-managers** → Remove complexity

**Rationale**: 2,243-line README indicates extreme over-engineering

- Current: Enterprise-scale orchestration for basic DDD library
- Reality: Most DDD projects use simpler workflow patterns
- Decision: Keep minimal interfaces, remove complex implementation

#### 4. **@vytches/ddd-cli** Bloat Reduction → Core CLI only

**Rationale**: Over-engineered for actual usage patterns (26,135 lines)

- **Keep**: Basic code generation and scaffolding
- **Remove**: AI discovery, complex analysis, intent classifiers
- **Result**: 98% code reduction while maintaining core value

#### 5. **Remove VP-012 Performance Theater**

**Rationale**: Artificial metrics undermining credibility

- Current: Fake busy-wait loops, predetermined results
- Impact: Destroys enterprise trust
- Decision: Immediate elimination following ADR-0023

### Packages to Preserve (15 packages)

#### **Foundation Layer** (5 packages)

- `@vytches/ddd-core` - Meta-package (1.4KB)
- `@vytches/ddd-domain-primitives` - Base classes
- `@vytches/ddd-value-objects` - EntityId, value objects
- `@vytches/ddd-aggregates` - Aggregate root + capabilities
- `@vytches/ddd-contracts` - Shared interfaces

#### **Pattern Layer** (4 packages)

- `@vytches/ddd-repositories` - Repository patterns
- `@vytches/ddd-events` - Unified event system
- `@vytches/ddd-cqrs` - Command/Query separation
- `@vytches/ddd-validation` - Specifications, policies

#### **Integration Layer** (3 packages)

- `@vytches/ddd-messaging` - Outbox pattern
- `@vytches/ddd-acl` - Anti-corruption layer
- `@vytches/ddd-projections` - Read model projections

#### **Infrastructure Layer** (3 packages)

- `@vytches/ddd-di` - Dependency injection
- `@vytches/ddd-logging` - Structured logging
- `@vytches/ddd-resilience` - Resilience patterns

## Implementation Strategy

### Phase 1: Immediate Eliminations (Week 1)

- Remove VP-012 Performance Theater
- Remove event-scheduling package (document pg-boss alternatives)
- Reduce CLI to basic templates only

### Phase 2: Complex Eliminations (Week 2-3)

- Remove sagas package (create external orchestration guide)
- Simplify process-managers (keep interfaces only)
- Update documentation and examples

### Phase 3: Documentation & Migration (Week 4)

- Create comprehensive migration guide
- Update all documentation
- Test migration path

### Phase 4: Release (Week 5)

- v2.0.0 major release with clear upgrade path
- Community communication
- External alternatives documentation

## Benefits

### **Developer Experience**

- ✅ **<5 minute onboarding** vs current 15+ minutes
- ✅ **Clear mental model**: Foundation → Patterns → Integration →
  Infrastructure
- ✅ **Reduced analysis paralysis**: 32% fewer packages
- ✅ **Better documentation**: Focused on essential packages

### **Market Position**

- ✅ **Clear value proposition**: "MediatR + Aggregates for TypeScript"
- ✅ **Competitive advantage**: Focus on core DDD patterns
- ✅ **Enterprise adoption**: Simplified procurement and evaluation
- ✅ **TypeScript excellence**: Best-in-class TypeScript DDD library

### **Technical Benefits**

- ✅ **Preserved bundle optimization**: Maintain 99.2% reduction
- ✅ **Reduced maintenance**: 32% fewer packages to maintain
- ✅ **External integrations**: Clear guidance for specialized needs
- ✅ **Architectural clarity**: Clean separation of concerns

## Risks & Mitigations

### **Risk**: Users missing eliminated functionality

**Mitigation**:

- Document superior external alternatives
- Provide migration guides to proven solutions
- Maintain backward compatibility where feasible

### **Risk**: Competitive disadvantage from fewer features

**Mitigation**:

- Focus on core DDD excellence vs feature breadth
- Partner with specialized tool providers
- Clear "better together" messaging

### **Risk**: Community backlash from breaking changes

**Mitigation**:

- Comprehensive communication about benefits
- Clear migration paths to external solutions
- Gradual deprecation with warning periods

## Success Metrics

### **Onboarding Experience**

- **Target**: <5 minutes from npm install to working example
- **Current**: 15+ minutes with package selection paralysis
- **Measurement**: New developer onboarding tests

### **Package Adoption Patterns**

- **Target**: 80% of users need only 5-7 packages
- **Current**: Users struggle with 22 package ecosystem
- **Measurement**: Package download analytics

### **Community Feedback**

- **Target**: "Much easier to get started with VytchesDDD"
- **Current**: "Too complex for simple DDD use cases"
- **Measurement**: GitHub surveys, community feedback

### **Market Position**

- **Target**: "The TypeScript equivalent of MediatR"
- **Current**: "Complex enterprise DDD framework"
- **Measurement**: Developer surveys, competitive analysis

## Alternatives Considered

### **Alternative 1**: Keep all packages, improve documentation only

**Rejected**: Documentation won't solve fundamental complexity burden

### **Alternative 2**: Radical reduction to 8 packages

**Rejected**: Would lose valuable architectural separation and modularity

### **Alternative 3**: Create "lite" vs "enterprise" bundles

**Rejected**: Adds meta-complexity without solving root problem

## Decision Rationale

This simplification strategy balances **accessibility** (enterprise adoption)
with **completeness** (DDD patterns). Key principles:

1. **Focus over Features**: Do fewer things exceptionally well
2. **External Integration**: Partner with specialized tools vs building
   everything
3. **Developer Experience**: Prioritize onboarding speed over feature count
4. **Market Clarity**: Clear positioning as "MediatR + Aggregates for
   TypeScript"

The elimination of over-engineered packages (event-scheduling, sagas,
process-managers) removes complexity that competes poorly with specialized
alternatives while preserving all essential DDD patterns.

## Implementation Checklist

- [ ] Create implementation task (VF-024)
- [ ] Remove VP-012 Performance Theater
- [ ] Eliminate over-engineered packages
- [ ] Create external alternatives documentation
- [ ] Update all examples and documentation
- [ ] Test migration scenarios
- [ ] Community communication plan
- [ ] Release v2.0.0

---

**Author**: VytchesDDD Team  
**Reviewers**: architecture-guardian, strategic-vision, developer-experience  
**Approval**: Pending  
**Implementation**: VF-024
