# Intermediate NestJS Implementation Patterns

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: intermediate  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: di-integration, policy-registry, behavior-composition

## Overview

Intermediate implementation patterns for integrating @vytches-ddd/policies with NestJS applications using advanced dependency injection, policy registries, and behavior composition for enterprise-grade policy management.

## Core Implementation Concepts

This section covers two intermediate patterns demonstrated in separate examples:

### 1. Advanced NestJS DI Integration (Example 1)
Enterprise-grade integration using @vytches-ddd/di service locator pattern with policy behaviors, cross-cutting concerns, and sophisticated dependency management for complex business scenarios.

**Key Features:**
- **@vytches-ddd/di Integration**: Service locator pattern with auto-discovery and context isolation
- **Policy Behaviors**: Retry, caching, and temporal policy enhancement patterns
- **Bridge Pattern**: Clean separation between NestJS and VytchesDDD dependency injection
- **Enterprise Architecture**: Scalable patterns for complex distributed applications

### 2. Policy Registry and Versioning (Example 2)
Centralized policy management with versioning capabilities, A/B testing, deployment strategies, and analytics integration for dynamic policy resolution and optimization.

**Key Features:**
- **Policy Registry**: Centralized management with versioning and dynamic resolution
- **A/B Testing**: Policy variant testing with analytics and optimization insights
- **Deployment Strategies**: Canary, blue-green, and immediate deployment patterns
- **Performance Analytics**: Real-time monitoring and optimization recommendations

## Integration Benefits

### **Enterprise Dependency Injection**
- **Service Locator Pattern**: Global service resolution with context-aware dependency injection
- **Auto-Discovery**: Automatic service registration through enhanced decorators
- **Lifecycle Management**: Configurable service lifetimes with proper disposal patterns
- **Framework Integration**: Clean bridge pattern avoiding double instance risks

### **Advanced Policy Management**
- **Behavior Composition**: Layer retry, caching, temporal, and custom behaviors
- **Registry Pattern**: Centralized policy management with versioning and deployment control
- **A/B Testing**: Data-driven policy optimization through controlled variant testing
- **Dynamic Resolution**: Context-aware policy selection based on environment and user criteria

### **Operational Excellence**
- **Performance Optimization**: Intelligent caching, retry strategies, and latency optimization
- **Deployment Control**: Safe rollouts with canary, blue-green, and immediate strategies
- **Monitoring Integration**: Comprehensive analytics and performance tracking
- **Scalability**: Patterns designed for high-throughput enterprise applications

## Architecture Patterns

### **Service Locator with Bridge Pattern**
The recommended approach for integrating VytchesDDD with NestJS:

```typescript
// Domain service with @vytches-ddd/di
@DomainService('policyService', { 
  lifetime: ServiceLifetime.Singleton,
  context: 'PolicyManagement' 
})
class PolicyService {
  // Business logic with advanced behaviors
}

// NestJS controller with bridge pattern
@Controller()
class PolicyController {
  private readonly policyService: PolicyService;
  
  constructor() {
    // Bridge: Get existing instance from VytchesDDD
    this.policyService = VytchesDDD.resolve<PolicyService>('policyService');
  }
}
```

### **Policy Behavior Composition**
Layering cross-cutting concerns for enterprise requirements:

```typescript
// Base policy with business rules
const basePolicy = PolicyBuilder.create<Entity>()...;

// Layer behaviors for enterprise requirements  
const cachedPolicy = PolicyCachingBehavior.create(basePolicy, cacheConfig);
const resilientPolicy = PolicyRetryBehavior.create(cachedPolicy, retryConfig);
```

### **Registry-Based Policy Management**
Centralized policy management with versioning and deployment control:

```typescript
// Register versioned policies
registry.register({
  id: 'user-validation',
  domain: 'user-management', 
  policy: enhancedPolicy,
  version: '2.0.0',
  tags: ['production', 'active']
});

// Dynamic resolution with A/B testing
const policy = await registry.resolveWithABTesting(domain, policyId, context);
```

## Integration Principles

### **1. VytchesDDD First**
Always initialize VytchesDDD container before NestJS DI to ensure proper service resolution and avoid conflicts.

### **2. Single Instance Principle**
Use factory patterns and bridge services to ensure single instances across both DI systems.

### **3. Business Logic in Domain Services**
Keep policy logic in `@DomainService` classes, using NestJS controllers as thin integration layers.

### **4. Context Isolation**
Use bounded contexts for service isolation and proper dependency resolution in complex applications.

### **5. Behavior Composition**
Apply the decorator pattern for cross-cutting concerns rather than embedding them in business logic.

## Common Pitfalls

- **❌ Double Instance Risk**: Always use bridge pattern to avoid creating duplicate service instances
- **❌ Initialization Order**: Ensure VytchesDDD is configured before NestJS attempts service resolution  
- **❌ Context Pollution**: Keep policy contexts focused on business concerns, avoid technical implementation details
- **❌ Behavior Overuse**: Only add behaviors that provide clear business value or operational requirements
- **❌ Registry Bloat**: Regularly clean up unused policy versions and maintain registry performance