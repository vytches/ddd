# Advanced Enterprise Policy System Implementation

**Focus**: Enterprise policy system with behaviors, registry, and event-driven architecture  
**Domain**: Enterprise Security  
**Complexity**: Advanced  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/di, @vytches-ddd/utils, @vytches-ddd/events

## Business Context

This example demonstrates an enterprise-grade policy system for security compliance:
- Policy behaviors for retry, caching, and temporal validation
- Policy registry for centralized management
- Event-driven architecture for policy evaluation tracking
- Complex security policies with multiple validation layers

## Implementation

```typescript
// enterprise-security-policy.ts
import { 
  PolicyBuilder, 
  PolicyGroup, 
  PolicyContext,
  PolicyRegistry,
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior,
  ISpecification,
  IAsyncSpecification
} from '@vytches-ddd/policies';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
import { 
  SecurityContext, 
  AccessRequest, 
  User, 
  Resource, 
  SecurityPolicy,
  ComplianceReport
} from '../types'; // ALWAYS import from app

// Advanced async specifications for security validation
class ExternalComplianceCheckSpec implements IAsyncSpecification<AccessRequest> {
  constructor(private complianceService: any) {}
  
  async isSatisfiedByAsync(request: AccessRequest): Promise<boolean> {
    try {
      const complianceResult = await this.complianceService.validateCompliance(
        request.user.id,
        request.resource.id
      );
      return complianceResult.isCompliant;
    } catch (error) {
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }
}

class ThreatIntelligenceSpec implements IAsyncSpecification<AccessRequest> {
  constructor(private threatService: any) {}
  
  async isSatisfiedByAsync(request: AccessRequest): Promise<boolean> {
    try {
      const threatLevel = await this.threatService.assessThreatLevel(
        request.user.id,
        request.sourceIP,
        request.userAgent
      );
      return threatLevel < 0.7; // Low threat threshold
    } catch (error) {
      throw new Error(`Threat assessment failed: ${error.message}`);
    }
  }
}

class MultiFactorAuthSpec implements ISpecification<AccessRequest> {
  isSatisfiedBy(request: AccessRequest): boolean {
    return request.user.mfaEnabled && request.user.mfaVerified;
  }
}

class BusinessHoursSpec implements ISpecification<AccessRequest> {
  isSatisfiedBy(request: AccessRequest): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Business hours: Monday-Friday, 9AM-5PM
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }
}

// ⭐ Enterprise Security Policy System
@DomainService('enterpriseSecurityPolicy', {
  lifetime: ServiceLifetime.Singleton,
  context: 'Security',
  dependencies: ['complianceService', 'threatService', 'auditService']
})
export class EnterpriseSecurityPolicy {
  private logger = Logger.forContext('EnterpriseSecurityPolicy');
  private registry: PolicyRegistry;
  private eventBus: UnifiedEventBus;

  constructor(
    private complianceService: any,
    private threatService: any,
    private auditService: any
  ) {
    this.registry = new PolicyRegistry();
    this.eventBus = new UnifiedEventBus();
    this.initializePolicies();
  }

  private initializePolicies(): void {
    // Base security policy
    const baseSecurityPolicy = PolicyBuilder.create<AccessRequest>()
      .withId('base-security')
      .withDomain('security')
      .withName('Base Security Policy')
      .must(new MultiFactorAuthSpec())
      .withCode('MFA_REQUIRED')
      .withMessage('Multi-factor authentication required')
      .withSeverity('ERROR')
      .and()
      .mustAsync(new ThreatIntelligenceSpec(this.threatService))
      .withCode('THREAT_LEVEL_HIGH')
      .withMessage('Access denied due to high threat level')
      .withSeverity('ERROR')
      .build();

    // Compliance policy
    const compliancePolicy = PolicyBuilder.create<AccessRequest>()
      .withId('compliance-security')
      .withDomain('security')
      .withName('Compliance Security Policy')
      .mustAsync(new ExternalComplianceCheckSpec(this.complianceService))
      .withCode('COMPLIANCE_VIOLATION')
      .withMessage('Access violates compliance requirements')
      .withSeverity('ERROR')
      .build();

    // Temporal policy for sensitive resources
    const sensitiveResourcePolicy = PolicyBuilder.create<AccessRequest>()
      .withId('sensitive-resource-security')
      .withDomain('security')
      .withName('Sensitive Resource Security Policy')
      .must(new BusinessHoursSpec())
      .withCode('OUTSIDE_BUSINESS_HOURS')
      .withMessage('Sensitive resources only accessible during business hours')
      .withSeverity('ERROR')
      .build();

    // Register policies with behaviors
    this.registerPolicyWithBehaviors('base-security', baseSecurityPolicy);
    this.registerPolicyWithBehaviors('compliance-security', compliancePolicy);
    this.registerPolicyWithBehaviors('sensitive-resource-security', sensitiveResourcePolicy);
  }

  private registerPolicyWithBehaviors(id: string, basePolicy: any): void {
    // Apply retry behavior for external service calls
    const retryPolicy = PolicyRetryBehavior.create(basePolicy, {
      maxAttempts: 3,
      baseDelay: 1000,
      backoff: 'exponential',
      shouldRetry: violation => violation.code.includes('TIMEOUT') || violation.code.includes('SERVICE_UNAVAILABLE')
    });

    // Apply caching behavior for performance
    const cachedPolicy = PolicyCachingBehavior.create(retryPolicy, {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      keyGenerator: request => `${request.user.id}_${request.resource.id}_${request.action}`,
      namespace: 'security-policies'
    });

    // Apply temporal behavior for business hours
    const temporalPolicy = PolicyTemporalBehavior.create(cachedPolicy, {
      businessHours: { start: '09:00', end: '17:00' },
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      timezone: 'UTC'
    });

    // Register in policy registry
    this.registry.register({
      id,
      domain: 'security',
      name: `${id} Policy`,
      policy: temporalPolicy,
      version: '1.0.0',
      tags: ['security', 'enterprise', 'compliance']
    });
  }

  async evaluateAccessRequest(
    request: AccessRequest,
    userId: string
  ): Promise<Result<SecurityContext, Error>> {
    try {
      this.logger.info('Evaluating access request', {
        userId: request.user.id,
        resourceId: request.resource.id,
        action: request.action,
        sourceIP: request.sourceIP
      });

      const context = PolicyContext.create()
        .withUserId(userId)
        .withRequestId(`access-${request.id}`)
        .withCorrelationId(`security-${Date.now()}`)
        .withContext({
          resourceType: request.resource.type,
          resourceSensitivity: request.resource.sensitivityLevel,
          userRole: request.user.role,
          sourceIP: request.sourceIP,
          userAgent: request.userAgent,
          timestamp: new Date().toISOString()
        })
        .build();

      // Determine which policies to apply based on resource sensitivity
      const policiesToApply = this.determinePolicies(request.resource);
      
      // Evaluate all applicable policies
      const evaluationResults = await Promise.allSettled(
        policiesToApply.map(async policyId => {
          const policy = this.registry.resolve<AccessRequest>({ id: policyId });
          if (!policy) {
            throw new Error(`Policy ${policyId} not found`);
          }
          return await policy.check({ entity: request, context });
        })
      );

      // Process results
      const violations: any[] = [];
      const warnings: any[] = [];

      evaluationResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.isFailure()) {
            result.value.error.violations.forEach(violation => {
              if (violation.severity === 'ERROR') {
                violations.push(violation);
              } else if (violation.severity === 'WARNING') {
                warnings.push(violation);
              }
            });
          }
        } else {
          violations.push({
            code: 'POLICY_EVALUATION_ERROR',
            message: `Policy evaluation failed: ${result.reason}`,
            severity: 'ERROR'
          });
        }
      });

      // Emit policy evaluation event
      await this.eventBus.publish({
        eventType: 'SecurityPolicyEvaluated',
        payload: {
          requestId: request.id,
          userId: request.user.id,
          resourceId: request.resource.id,
          action: request.action,
          violations: violations.length,
          warnings: warnings.length,
          result: violations.length === 0 ? 'APPROVED' : 'DENIED'
        },
        metadata: {
          correlationId: context.correlationId,
          timestamp: new Date().toISOString()
        }
      });

      // Log security audit event
      await this.auditService.logSecurityEvent({
        action: 'ACCESS_REQUEST_EVALUATED',
        userId: request.user.id,
        resourceId: request.resource.id,
        result: violations.length === 0 ? 'APPROVED' : 'DENIED',
        violations: violations.map(v => v.code),
        warnings: warnings.map(w => w.code),
        context: {
          sourceIP: request.sourceIP,
          userAgent: request.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (violations.length > 0) {
        const errorMessages = violations.map(v => `${v.code}: ${v.message}`).join(', ');
        return Result.failure(new Error(`Access denied: ${errorMessages}`));
      }

      const securityContext: SecurityContext = {
        userId: request.user.id,
        resourceId: request.resource.id,
        action: request.action,
        approved: true,
        conditions: warnings.map(w => w.message),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        auditId: `audit-${Date.now()}`
      };

      return Result.success(securityContext);

    } catch (error) {
      this.logger.error('Security policy evaluation error', {
        requestId: request.id,
        error: error.message
      });

      return Result.failure(new Error(`Security evaluation failed: ${error.message}`));
    }
  }

  private determinePolicies(resource: Resource): string[] {
    const policies = ['base-security'];
    
    if (resource.sensitivityLevel === 'high') {
      policies.push('sensitive-resource-security');
    }
    
    if (resource.requiresCompliance) {
      policies.push('compliance-security');
    }
    
    return policies;
  }

  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<Result<ComplianceReport, Error>> {
    try {
      this.logger.info('Generating compliance report', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Get all security policies from registry
      const securityPolicies = this.registry.findByDomain('security');
      
      // Get policy evaluation metrics
      const evaluationMetrics = await Promise.all(
        securityPolicies.map(async policy => {
          const metrics = await this.getPolicyMetrics(policy.id, startDate, endDate);
          return {
            policyId: policy.id,
            policyName: policy.name,
            ...metrics
          };
        })
      );

      const report: ComplianceReport = {
        reportId: `compliance-${Date.now()}`,
        generatedAt: new Date(),
        period: { start: startDate, end: endDate },
        policies: evaluationMetrics,
        summary: {
          totalEvaluations: evaluationMetrics.reduce((sum, m) => sum + m.totalEvaluations, 0),
          approvedRequests: evaluationMetrics.reduce((sum, m) => sum + m.approvedRequests, 0),
          deniedRequests: evaluationMetrics.reduce((sum, m) => sum + m.deniedRequests, 0),
          complianceScore: this.calculateComplianceScore(evaluationMetrics)
        }
      };

      return Result.success(report);

    } catch (error) {
      return Result.failure(new Error(`Compliance report generation failed: ${error.message}`));
    }
  }

  private async getPolicyMetrics(
    policyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Implementation would query metrics from audit service
    // This is a simplified example
    return {
      totalEvaluations: 1000,
      approvedRequests: 850,
      deniedRequests: 150,
      averageEvaluationTime: 245,
      cacheHitRate: 0.78,
      retryRate: 0.05
    };
  }

  private calculateComplianceScore(metrics: any[]): number {
    const totalApproved = metrics.reduce((sum, m) => sum + m.approvedRequests, 0);
    const totalEvaluations = metrics.reduce((sum, m) => sum + m.totalEvaluations, 0);
    
    return totalEvaluations > 0 ? (totalApproved / totalEvaluations) * 100 : 0;
  }
}
```

## Key Features

- **Policy Behaviors**: Retry, caching, and temporal behaviors for cross-cutting concerns
- **Policy Registry**: Centralized policy management and discovery
- **Event-Driven**: Policy evaluation events for observability
- **Async Specifications**: External service integration with proper error handling
- **Compliance Reporting**: Automated compliance reporting and metrics
- **Audit Trail**: Comprehensive security audit logging
- **Resource-Based Policies**: Dynamic policy selection based on resource properties

## Usage Example

```typescript
// Usage in security service
export class SecurityService {
  constructor(private securityPolicy: EnterpriseSecurityPolicy) {}

  async authorizeAccess(
    user: User,
    resource: Resource,
    action: string,
    sourceIP: string,
    userAgent: string
  ): Promise<Result<SecurityContext, Error>> {
    try {
      const accessRequest: AccessRequest = {
        id: `req-${Date.now()}`,
        user,
        resource,
        action,
        sourceIP,
        userAgent,
        timestamp: new Date()
      };

      const authResult = await this.securityPolicy.evaluateAccessRequest(
        accessRequest,
        user.id
      );

      if (authResult.isFailure()) {
        return Result.failure(authResult.error);
      }

      return Result.success(authResult.value);
    } catch (error) {
      return Result.failure(new Error(`Authorization failed: ${error.message}`));
    }
  }
}
```

## Common Pitfalls

- **Performance Impact**: Monitor policy evaluation performance, especially with async specs
- **Circular Dependencies**: Avoid circular references in policy registry
- **Error Handling**: Properly handle external service failures in async specifications
- **Cache Invalidation**: Implement proper cache invalidation strategies for security policies
- **Audit Compliance**: Ensure all security decisions are properly audited and logged