# Policy Registry and Versioning in NestJS

**Version**: 2.0.0  
**Package**: @vytches/ddd-policies  
**Complexity**: intermediate  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: policy-registry, versioning, a-b-testing  
**Dependencies**: @nestjs/common, @vytches/ddd-policies, @vytches/ddd-di

## Description

Advanced policy management using the Policy Registry pattern in NestJS
applications, demonstrating policy versioning, A/B testing, and centralized
policy management for enterprise scenarios.

## Business Context

Large applications need centralized policy management with versioning
capabilities, A/B testing for business rules, and dynamic policy resolution
based on context. This example shows how to implement enterprise-grade policy
registry integration.

## Code Example

```typescript
// policy-registry.service.ts - Centralized Policy Management
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainService, VytchesDDD, ServiceLifetime } from '@vytches/ddd-di';
import {
  PolicyRegistry,
  PolicyBuilder,
  PolicyCachingBehavior,
  PolicyResult,
  IPolicy,
} from '@vytches/ddd-policies';
import { User, Order, PolicyContext } from './types'; // From your application

/**
 * Centralized policy registry service for enterprise policy management
 * Demonstrates policy versioning, A/B testing, and dynamic resolution
 */
@DomainService({
  serviceId: 'policyRegistryService',
  lifetime: ServiceLifetime.Singleton,
  context: 'PolicyManagement',
  autoRegister: true,
})
export class PolicyRegistryService implements OnModuleInit {
  private readonly registry: PolicyRegistry;

  constructor() {
    this.registry = new PolicyRegistry();
  }

  async onModuleInit() {
    await this.initializePolicies();
  }

  /**
   * ✅ FOCUS: Dynamic policy resolution based on context
   */
  async resolvePolicy<T>(
    domain: string,
    policyId: string,
    context: PolicyContext
  ): Promise<IPolicy<T>> {
    try {
      // Resolve based on A/B testing or feature flags
      const resolvedPolicyId = await this.resolvePolicyWithABTesting(
        policyId,
        context
      );

      const policy = this.registry.resolve<T>({
        domain,
        id: resolvedPolicyId,
        version: await this.determineVersion(context),
      });

      if (!policy) {
        throw new Error(`Policy not found: ${domain}/${resolvedPolicyId}`);
      }

      return policy;
    } catch (error) {
      throw new Error(`Policy resolution failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: A/B testing for policy variants
   */
  async validateWithABTesting<T>(
    domain: string,
    policyId: string,
    entity: T,
    context: PolicyContext
  ): Promise<PolicyResult<T> & { variant: string }> {
    try {
      const variant = await this.getABTestVariant(policyId, context.userId);
      const variantPolicyId = `${policyId}-${variant}`;

      const policy = await this.resolvePolicy<T>(
        domain,
        variantPolicyId,
        context
      );
      const result = await policy.check({ entity, context });

      // Log A/B testing metrics
      await this.logABTestingResult(
        policyId,
        variant,
        result.isSuccess(),
        context
      );

      return {
        ...result,
        variant,
      };
    } catch (error) {
      throw new Error(`A/B testing validation failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Policy versioning and rollback capabilities
   */
  async deployPolicyVersion<T>(
    domain: string,
    policyId: string,
    version: string,
    policyFactory: () => IPolicy<T>,
    deploymentStrategy: 'immediate' | 'canary' | 'blue-green' = 'canary'
  ): Promise<void> {
    try {
      const policy = policyFactory();

      // Register new version
      this.registry.register({
        id: policyId,
        domain,
        name: `${policyId} v${version}`,
        policy,
        version,
        tags: ['active', deploymentStrategy],
        metadata: {
          deployedAt: new Date(),
          deploymentStrategy,
          deployedBy: 'system',
        },
      });

      // Handle deployment strategy
      switch (deploymentStrategy) {
        case 'canary':
          await this.deployCanary(domain, policyId, version);
          break;
        case 'blue-green':
          await this.deployBlueGreen(domain, policyId, version);
          break;
        case 'immediate':
          await this.deployImmediate(domain, policyId, version);
          break;
      }
    } catch (error) {
      throw new Error(`Policy deployment failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Policy analytics and performance monitoring
   */
  async getPolicyAnalytics(
    domain: string,
    policyId: string,
    timeRange: { start: Date; end: Date }
  ) {
    try {
      const policies = this.registry
        .findByDomain(domain)
        .filter(p => p.id.includes(policyId));

      const analytics = await Promise.all(
        policies.map(async policy => ({
          id: policy.id,
          version: policy.version,
          executionCount: await this.getExecutionCount(policy.id, timeRange),
          successRate: await this.getSuccessRate(policy.id, timeRange),
          averageLatency: await this.getAverageLatency(policy.id, timeRange),
          errorRate: await this.getErrorRate(policy.id, timeRange),
        }))
      );

      return {
        domain,
        policyId,
        timeRange,
        versions: analytics,
        recommendations:
          await this.generateOptimizationRecommendations(analytics),
      };
    } catch (error) {
      throw new Error(`Policy analytics failed: ${error.message}`);
    }
  }

  // Private initialization and helper methods

  private async initializePolicies(): Promise<void> {
    // Register user validation policies
    await this.registerUserPolicies();

    // Register order processing policies
    await this.registerOrderPolicies();

    // Register A/B testing variants
    await this.registerABTestingVariants();
  }

  private async registerUserPolicies(): Promise<void> {
    // Standard user validation policy
    const userPolicyV1 = PolicyBuilder.create<User>()
      .withId('user-validation')
      .withName('User Validation Policy v1.0')
      .withDomain('user-management')
      .must(user => user.age >= 18)
      .withCode('AGE_INSUFFICIENT')
      .withMessage('User must be at least 18 years old')
      .build();

    // Enhanced user validation policy
    const userPolicyV2 = PolicyBuilder.create<User>()
      .withId('user-validation')
      .withName('User Validation Policy v2.0')
      .withDomain('user-management')
      .must(user => user.age >= 16) // Relaxed age requirement
      .withCode('AGE_INSUFFICIENT')
      .withMessage('User must be at least 16 years old')
      .and()
      .must(user => user.email.includes('@'))
      .withCode('EMAIL_INVALID')
      .withMessage('Valid email required')
      .build();

    // Register versions
    this.registry.register({
      id: 'user-validation',
      domain: 'user-management',
      name: 'User Validation Policy v1.0',
      policy: PolicyCachingBehavior.create(userPolicyV1, { ttl: 300000 }),
      version: '1.0.0',
      tags: ['stable', 'production'],
    });

    this.registry.register({
      id: 'user-validation',
      domain: 'user-management',
      name: 'User Validation Policy v2.0',
      policy: PolicyCachingBehavior.create(userPolicyV2, { ttl: 300000 }),
      version: '2.0.0',
      tags: ['beta', 'testing'],
    });
  }

  private async registerOrderPolicies(): Promise<void> {
    const orderPolicy = PolicyBuilder.create<Order>()
      .withId('order-validation')
      .withName('Order Validation Policy')
      .withDomain('order-management')
      .must(order => order.totalValue >= 10.0)
      .withCode('MINIMUM_ORDER_VALUE')
      .withMessage('Order must be at least $10.00')
      .and()
      .must(order => order.items.length > 0)
      .withCode('EMPTY_ORDER')
      .withMessage('Order must contain at least one item')
      .build();

    this.registry.register({
      id: 'order-validation',
      domain: 'order-management',
      name: 'Order Validation Policy',
      policy: orderPolicy,
      version: '1.0.0',
      tags: ['production', 'active'],
    });
  }

  private async registerABTestingVariants(): Promise<void> {
    // Variant A: Strict user validation
    const userValidationA = PolicyBuilder.create<User>()
      .withId('user-validation-a')
      .withName('User Validation Variant A')
      .withDomain('user-management')
      .must(user => user.age >= 21)
      .withCode('AGE_INSUFFICIENT_STRICT')
      .withMessage('User must be at least 21 years old')
      .build();

    // Variant B: Relaxed user validation
    const userValidationB = PolicyBuilder.create<User>()
      .withId('user-validation-b')
      .withName('User Validation Variant B')
      .withDomain('user-management')
      .must(user => user.age >= 16)
      .withCode('AGE_INSUFFICIENT_RELAXED')
      .withMessage('User must be at least 16 years old')
      .build();

    this.registry.register({
      id: 'user-validation-a',
      domain: 'user-management',
      name: 'User Validation Variant A',
      policy: userValidationA,
      version: '1.0.0',
      tags: ['ab-test', 'variant-a', 'strict'],
    });

    this.registry.register({
      id: 'user-validation-b',
      domain: 'user-management',
      name: 'User Validation Variant B',
      policy: userValidationB,
      version: '1.0.0',
      tags: ['ab-test', 'variant-b', 'relaxed'],
    });
  }

  private async resolvePolicyWithABTesting(
    policyId: string,
    context: PolicyContext
  ): Promise<string> {
    // Check if this policy has A/B testing enabled
    if (await this.hasABTesting(policyId)) {
      const variant = await this.getABTestVariant(policyId, context.userId);
      return `${policyId}-${variant}`;
    }
    return policyId;
  }

  private async determineVersion(context: PolicyContext): Promise<string> {
    // Feature flag or environment-based version selection
    if (context.environment === 'beta') {
      return '2.0.0';
    }
    return '1.0.0';
  }

  private async hasABTesting(policyId: string): Promise<boolean> {
    return ['user-validation'].includes(policyId);
  }

  private async getABTestVariant(
    policyId: string,
    userId: string
  ): Promise<string> {
    // Simple hash-based A/B testing
    const hash = this.hashUserId(userId);
    return hash % 2 === 0 ? 'a' : 'b';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async logABTestingResult(
    policyId: string,
    variant: string,
    success: boolean,
    context: PolicyContext
  ): Promise<void> {
    // Log for analytics (would integrate with actual analytics service)
    console.log(
      `A/B Test: ${policyId}-${variant}, Success: ${success}, User: ${context.userId}`
    );
  }

  private async deployCanary(
    domain: string,
    policyId: string,
    version: string
  ): Promise<void> {
    // Implement canary deployment logic
    console.log(`Deploying canary: ${domain}/${policyId} v${version}`);
  }

  private async deployBlueGreen(
    domain: string,
    policyId: string,
    version: string
  ): Promise<void> {
    // Implement blue-green deployment logic
    console.log(`Deploying blue-green: ${domain}/${policyId} v${version}`);
  }

  private async deployImmediate(
    domain: string,
    policyId: string,
    version: string
  ): Promise<void> {
    // Implement immediate deployment logic
    console.log(`Deploying immediate: ${domain}/${policyId} v${version}`);
  }

  private async getExecutionCount(
    policyId: string,
    timeRange: any
  ): Promise<number> {
    return Math.floor(Math.random() * 10000) + 1000;
  }

  private async getSuccessRate(
    policyId: string,
    timeRange: any
  ): Promise<number> {
    return 0.95 + Math.random() * 0.04;
  }

  private async getAverageLatency(
    policyId: string,
    timeRange: any
  ): Promise<number> {
    return Math.random() * 50 + 10;
  }

  private async getErrorRate(
    policyId: string,
    timeRange: any
  ): Promise<number> {
    return Math.random() * 0.05;
  }

  private async generateOptimizationRecommendations(
    analytics: any[]
  ): Promise<string[]> {
    const recommendations = [];

    analytics.forEach(analytic => {
      if (analytic.successRate < 0.95) {
        recommendations.push(
          `Consider reviewing policy rules for ${analytic.id}`
        );
      }
      if (analytic.averageLatency > 100) {
        recommendations.push(
          `Optimize performance for ${analytic.id} - consider caching`
        );
      }
    });

    return recommendations;
  }
}

// policy-management.controller.ts - Controller for Policy Registry Operations
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

@Controller('policies')
export class PolicyManagementController {
  private readonly policyRegistryService: PolicyRegistryService;

  constructor() {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.policyRegistryService = VytchesDDD.resolve<PolicyRegistryService>(
      'policyRegistryService'
    );
  }

  @Post('validate-ab/:domain/:policyId')
  async validateWithABTesting(
    @Param('domain') domain: string,
    @Param('policyId') policyId: string,
    @Body() request: { entity: any; context: PolicyContext }
  ) {
    try {
      const result = await this.policyRegistryService.validateWithABTesting(
        domain,
        policyId,
        request.entity,
        request.context
      );

      return {
        success: result.isSuccess(),
        variant: result.variant,
        violations: result.isFailure() ? result.error.violations : [],
        entity: result.isSuccess() ? result.value : null,
      };
    } catch (error) {
      throw new Error(`A/B testing validation failed: ${error.message}`);
    }
  }

  @Get('analytics/:domain/:policyId')
  async getPolicyAnalytics(
    @Param('domain') domain: string,
    @Param('policyId') policyId: string,
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    try {
      const timeRange = {
        start: new Date(start),
        end: new Date(end),
      };

      return await this.policyRegistryService.getPolicyAnalytics(
        domain,
        policyId,
        timeRange
      );
    } catch (error) {
      throw new Error(`Policy analytics failed: ${error.message}`);
    }
  }
}
```

## Key Features

- **📚 Policy Registry**: Centralized policy management with versioning
- **🧪 A/B Testing**: Dynamic policy variant testing and analytics
- **🚀 Deployment Strategies**: Canary, blue-green, and immediate deployment
- **📊 Analytics Integration**: Performance monitoring and optimization
  recommendations
- **🔄 Version Management**: Policy versioning with rollback capabilities

## Advanced Registry Benefits

### **Centralized Management**

- **Single Source of Truth**: All policies managed through central registry
- **Version Control**: Complete policy versioning with deployment history
- **Dynamic Resolution**: Context-aware policy selection and A/B testing

### **Enterprise Operations**

- **Deployment Strategies**: Controlled rollouts with risk mitigation
- **Performance Monitoring**: Real-time analytics and optimization insights
- **Feature Flags**: Environment and context-based policy selection

### **Business Intelligence**

- **A/B Testing**: Data-driven policy optimization through variant testing
- **Usage Analytics**: Comprehensive policy performance and success metrics
- **Optimization Recommendations**: AI-powered suggestions for policy
  improvements

## Common Pitfalls

- **❌ Registry Bloat**: Remove unused policy versions to maintain performance
- **❌ Version Conflicts**: Implement proper version compatibility checking
- **❌ A/B Test Bias**: Ensure proper randomization and statistical significance
- **❌ Cache Invalidation**: Handle policy updates across distributed cache
  layers

## Related Examples

- [Example 1: DI Integration](./example-1.md) - Advanced dependency injection
  patterns
- [Basic: Policy Builder](../basic/example-1.md) - Foundation policy creation
  patterns
- [Advanced: Policy Mesh](../advanced/example-2.md) - Distributed policy
  coordination
