/**
 * @fileoverview Pattern Orchestrator
 * AI-powered selection and orchestration of all VytchesDDD patterns for complete domain implementation
 */

import type { NLPAnalysis } from './natural-language-processor';
import type { BoundedContextMap } from './bounded-context-mapper';
/**
 * Pattern recommendation result
 */
export interface PatternRecommendations {
  core: CorePattern[];
  advanced: AdvancedPattern[];
  infrastructure: InfrastructurePattern[];
  enterprise: EnterprisePattern[];
  reasoning: PatternReasoning[];
}

/**
 * Core DDD patterns
 */
export interface CorePattern {
  name: string;
  type: 'aggregate' | 'entity' | 'value-object' | 'repository' | 'specification' | 'domain-service';
  confidence: number;
  reasoning: string;
  dependencies: string[];
  contexts: string[];
}

/**
 * Advanced DDD patterns
 */
export interface AdvancedPattern {
  name: string;
  type: 'cqrs' | 'event-sourcing' | 'saga' | 'projection' | 'policy' | 'outbox' | 'acl';
  confidence: number;
  reasoning: string;
  requirements: string[];
  benefits: string[];
  complexity: number;
  contexts: string[];
}

/**
 * Infrastructure patterns
 */
export interface InfrastructurePattern {
  name: string;
  type: 'resilience' | 'messaging' | 'caching' | 'monitoring' | 'security' | 'database';
  confidence: number;
  reasoning: string;
  implementation: string[];
  configuration: Record<string, any>;
}

/**
 * Enterprise patterns
 */
export interface EnterprisePattern {
  name: string;
  type: 'compliance' | 'audit' | 'multi-tenant' | 'federation' | 'analytics' | 'governance';
  confidence: number;
  reasoning: string;
  standards: string[];
  requirements: string[];
}

/**
 * Pattern reasoning for transparency
 */
export interface PatternReasoning {
  pattern: string;
  category: 'core' | 'advanced' | 'infrastructure' | 'enterprise';
  confidence: number;
  factors: ReasoningFactor[];
  alternatives: string[];
  tradeoffs: string[];
}

/**
 * Reasoning factor
 */
export interface ReasoningFactor {
  factor: string;
  weight: number;
  evidence: string;
  impact: 'positive' | 'negative' | 'neutral';
}

/**
 * Pattern Orchestrator for intelligent pattern selection
 */
export class PatternOrchestrator {
  private corePatternRules: PatternRule[] = [];
  private advancedPatternRules: PatternRule[] = [];
  private infrastructureRules: PatternRule[] = [];
  private enterpriseRules: PatternRule[] = [];

  constructor() {
    this.setupPatternRules();
  }

  /**
   * Recommend patterns based on domain analysis
   */
  async recommendPatterns(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    requestedPatterns: string[] = []
  ): Promise<PatternRecommendations> {

    const core = await this.recommendCorePatterns(nlpAnalysis, boundedContexts);
    const advanced = await this.recommendAdvancedPatterns(nlpAnalysis, boundedContexts, requestedPatterns);
    const infrastructure = await this.recommendInfrastructurePatterns(nlpAnalysis, boundedContexts);
    const enterprise = await this.recommendEnterprisePatterns(nlpAnalysis, boundedContexts);
    const reasoning = this.generatePatternReasoning(core, advanced, infrastructure, enterprise);

    return {
      core,
      advanced,
      infrastructure,
      enterprise,
      reasoning
    };
  }

  /**
   * Recommend core DDD patterns
   */
  private async recommendCorePatterns(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): Promise<CorePattern[]> {
    const patterns: CorePattern[] = [];

    // Aggregates - Always needed for DDD
    boundedContexts.contexts.forEach(context => {
      context.entities.forEach(entity => {
        if (this.shouldCreateAggregate(entity, nlpAnalysis, context)) {
          patterns.push({
            name: `${entity}Aggregate`,
            type: 'aggregate',
            confidence: 0.9,
            reasoning: `${entity} is a core domain entity with business rules and state management`,
            dependencies: [`${entity}Entity`, `${entity}Repository`],
            contexts: [context.name]
          });
        }
      });
    });

    // Value Objects - Based on domain analysis
    const valueObjects = this.identifyValueObjects(nlpAnalysis);
    valueObjects.forEach(vo => {
      patterns.push({
        name: `${vo}VO`,
        type: 'value-object',
        confidence: 0.8,
        reasoning: `${vo} represents a domain concept without identity`,
        dependencies: [],
        contexts: this.findContextsForConcept(vo, boundedContexts)
      });
    });

    // Repositories - One per aggregate
    const aggregates = patterns.filter(p => p.type === 'aggregate');
    aggregates.forEach(aggregate => {
      const entityName = aggregate.name.replace('Aggregate', '');
      patterns.push({
        name: `I${entityName}Repository`,
        type: 'repository',
        confidence: 0.95,
        reasoning: `Repository interface for ${entityName} aggregate persistence`,
        dependencies: [aggregate.name],
        contexts: aggregate.contexts
      });
    });

    // Specifications - Based on business rules
    nlpAnalysis.businessRules.forEach(rule => {
      if (rule.type === 'validation' || rule.type === 'constraint') {
        patterns.push({
          name: `${rule.name}Specification`,
          type: 'specification',
          confidence: 0.7,
          reasoning: `Business rule: ${rule.description}`,
          dependencies: rule.entities.map(e => `${e}Aggregate`),
          contexts: this.findContextsForEntities(rule.entities, boundedContexts)
        });
      }
    });

    // Domain Services - For complex business logic
    const domainServices = this.identifyDomainServices(nlpAnalysis, boundedContexts);
    domainServices.forEach(service => {
      patterns.push({
        name: `${service.name}DomainService`,
        type: 'domain-service',
        confidence: service.confidence,
        reasoning: service.reasoning,
        dependencies: service.dependencies,
        contexts: service.contexts
      });
    });

    return patterns;
  }

  /**
   * Recommend advanced DDD patterns
   */
  private async recommendAdvancedPatterns(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    requestedPatterns: string[]
  ): Promise<AdvancedPattern[]> {
    const patterns: AdvancedPattern[] = [];

    // CQRS - For complex read/write scenarios
    if (this.shouldUseCQRS(nlpAnalysis, boundedContexts) || requestedPatterns.includes('cqrs')) {
      patterns.push({
        name: 'CQRS',
        type: 'cqrs',
        confidence: 0.8,
        reasoning: 'Complex domain with multiple read scenarios and performance requirements',
        requirements: ['Command handlers', 'Query handlers', 'Read models', 'Command/Query bus'],
        benefits: ['Optimized read models', 'Scalable queries', 'Clear separation of concerns'],
        complexity: 0.7,
        contexts: boundedContexts.contexts.map(c => c.name)
      });
    }

    // Event Sourcing - For audit requirements or complex state changes
    if (this.shouldUseEventSourcing(nlpAnalysis, boundedContexts) || requestedPatterns.includes('event-sourcing')) {
      patterns.push({
        name: 'Event Sourcing',
        type: 'event-sourcing',
        confidence: 0.85,
        reasoning: 'Domain requires audit trails and complex state reconstruction',
        requirements: ['Event store', 'Event handlers', 'Snapshots', 'Event versioning'],
        benefits: ['Complete audit trail', 'Time travel debugging', 'Event replay capability'],
        complexity: 0.9,
        contexts: this.getEventSourcingContexts(nlpAnalysis, boundedContexts)
      });
    }

    // Saga Pattern - For long-running processes
    if (this.shouldUseSagas(nlpAnalysis, boundedContexts) || requestedPatterns.includes('saga')) {
      const sagaProcesses = this.identifySagaProcesses(nlpAnalysis, boundedContexts);
      sagaProcesses.forEach(saga => {
        patterns.push({
          name: `${saga.name}Saga`,
          type: 'saga',
          confidence: saga.confidence,
          reasoning: saga.reasoning,
          requirements: ['Saga orchestrator', 'Compensation handlers', 'State persistence'],
          benefits: ['Distributed transaction coordination', 'Compensation logic', 'Process resilience'],
          complexity: 0.8,
          contexts: saga.contexts
        });
      });
    }

    // Projections - For read model optimization
    if (patterns.some(p => p.type === 'cqrs' || p.type === 'event-sourcing')) {
      const projections = this.identifyProjections(nlpAnalysis, boundedContexts);
      projections.forEach(projection => {
        patterns.push({
          name: `${projection.name}Projection`,
          type: 'projection',
          confidence: projection.confidence,
          reasoning: projection.reasoning,
          requirements: ['Event handlers', 'Read model storage', 'Projection rebuilding'],
          benefits: ['Optimized queries', 'Denormalized data', 'View-specific models'],
          complexity: 0.6,
          contexts: projection.contexts
        });
      });
    }

    // Policy Pattern - For complex business rules
    if (nlpAnalysis.businessRules.length > 3) {
      const policies = this.identifyPolicies(nlpAnalysis, boundedContexts);
      policies.forEach(policy => {
        patterns.push({
          name: `${policy.name}Policy`,
          type: 'policy',
          confidence: policy.confidence,
          reasoning: policy.reasoning,
          requirements: ['Policy engine', 'Rule composition', 'Validation framework'],
          benefits: ['Flexible business rules', 'Rule composition', 'Dynamic policies'],
          complexity: 0.5,
          contexts: policy.contexts
        });
      });
    }

    // Outbox Pattern - For reliable event publishing
    if (boundedContexts.contexts.length > 1 || nlpAnalysis.events.length > 5) {
      patterns.push({
        name: 'Outbox Pattern',
        type: 'outbox',
        confidence: 0.7,
        reasoning: 'Multiple contexts require reliable event publishing and message delivery',
        requirements: ['Outbox table', 'Message publisher', 'Transactional guarantees'],
        benefits: ['Reliable message delivery', 'At-least-once semantics', 'Transaction safety'],
        complexity: 0.6,
        contexts: boundedContexts.contexts.map(c => c.name)
      });
    }

    // Anti-Corruption Layer - For external integrations
    if (this.hasExternalIntegrations(nlpAnalysis)) {
      patterns.push({
        name: 'Anti-Corruption Layer',
        type: 'acl',
        confidence: 0.8,
        reasoning: 'External system integrations detected, ACL protects domain model',
        requirements: ['Adapter interfaces', 'Translation services', 'External API clients'],
        benefits: ['Domain model protection', 'Clean integration', 'Legacy system isolation'],
        complexity: 0.7,
        contexts: ['Integration']
      });
    }

    return patterns;
  }

  /**
   * Recommend infrastructure patterns
   */
  private async recommendInfrastructurePatterns(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): Promise<InfrastructurePattern[]> {
    const patterns: InfrastructurePattern[] = [];

    // Resilience Patterns - For complex domains
    if (nlpAnalysis.complexity > 0.6 || boundedContexts.contexts.length > 2) {
      patterns.push({
        name: 'Circuit Breaker',
        type: 'resilience',
        confidence: 0.8,
        reasoning: 'Complex domain requires resilience against external service failures',
        implementation: ['@vytches-ddd/resilience CircuitBreaker', 'Failure detection', 'Automatic recovery'],
        configuration: {
          failureThreshold: 5,
          timeout: 60000,
          halfOpenRetryDelay: 30000
        }
      });

      patterns.push({
        name: 'Retry Pattern',
        type: 'resilience',
        confidence: 0.7,
        reasoning: 'Transient failure handling for external dependencies',
        implementation: ['@vytches-ddd/resilience RetryPolicy', 'Exponential backoff', 'Jitter'],
        configuration: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 30000
        }
      });
    }

    // Messaging Patterns
    if (boundedContexts.contexts.length > 1) {
      patterns.push({
        name: 'Message Bus',
        type: 'messaging',
        confidence: 0.9,
        reasoning: 'Multiple bounded contexts require event-driven communication',
        implementation: ['@vytches-ddd/messaging EventBus', 'Message routing', 'Dead letter handling'],
        configuration: {
          provider: 'redis',
          retryAttempts: 3,
          deadLetterQueue: true
        }
      });
    }

    // Caching Patterns - For read-heavy scenarios
    if (this.hasReadHeavyScenarios(nlpAnalysis)) {
      patterns.push({
        name: 'Read Model Caching',
        type: 'caching',
        confidence: 0.7,
        reasoning: 'Read-heavy scenarios benefit from caching strategies',
        implementation: ['Redis caching', 'Cache invalidation', 'TTL management'],
        configuration: {
          provider: 'redis',
          defaultTTL: 3600,
          keyPrefix: 'domain'
        }
      });
    }

    // Monitoring Patterns
    patterns.push({
      name: 'Domain Metrics',
      type: 'monitoring',
      confidence: 0.8,
      reasoning: 'Domain monitoring for business metrics and performance',
      implementation: ['Prometheus metrics', 'Custom domain counters', 'Business KPIs'],
      configuration: {
        provider: 'prometheus',
        businessMetrics: true,
        performanceMetrics: true
      }
    });

    // Security Patterns
    if (this.hasSecurityRequirements(nlpAnalysis)) {
      patterns.push({
        name: 'Domain Authorization',
        type: 'security',
        confidence: 0.85,
        reasoning: 'Security requirements detected for domain access control',
        implementation: ['RBAC middleware', 'Domain-specific permissions', 'Audit logging'],
        configuration: {
          provider: 'rbac',
          auditEnabled: true,
          permissions: 'domain-based'
        }
      });
    }

    // Database Patterns
    patterns.push({
      name: 'Repository Implementation',
      type: 'database',
      confidence: 0.95,
      reasoning: 'Database persistence layer for domain aggregates',
      implementation: ['Repository pattern', 'Unit of work', 'Database abstraction'],
      configuration: {
        provider: 'postgresql',
        orm: 'typeorm',
        transactions: true
      }
    });

    return patterns;
  }

  /**
   * Recommend enterprise patterns
   */
  private async recommendEnterprisePatterns(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): Promise<EnterprisePattern[]> {
    const patterns: EnterprisePattern[] = [];

    // Compliance Patterns
    if (this.hasComplianceRequirements(nlpAnalysis)) {
      const complianceTypes = this.identifyComplianceTypes(nlpAnalysis);
      complianceTypes.forEach(compliance => {
        patterns.push({
          name: `${compliance.toUpperCase()} Compliance`,
          type: 'compliance',
          confidence: 0.9,
          reasoning: `${compliance.toUpperCase()} compliance requirements detected in domain`,
          standards: [compliance.toUpperCase()],
          requirements: this.getComplianceRequirements(compliance)
        });
      });
    }

    // Audit Patterns
    if (this.hasAuditRequirements(nlpAnalysis)) {
      patterns.push({
        name: 'Domain Audit Trail',
        type: 'audit',
        confidence: 0.85,
        reasoning: 'Audit requirements for domain operations and state changes',
        standards: ['Audit logging', 'Change tracking', 'User attribution'],
        requirements: ['Audit event store', 'Audit queries', 'Compliance reporting']
      });
    }

    // Multi-tenancy Patterns
    if (this.hasMultiTenancyRequirements(nlpAnalysis)) {
      patterns.push({
        name: 'Multi-Tenant Domain',
        type: 'multi-tenant',
        confidence: 0.8,
        reasoning: 'Multi-tenant architecture required for domain isolation',
        standards: ['Tenant isolation', 'Data segregation', 'Tenant routing'],
        requirements: ['Tenant context', 'Isolated storage', 'Tenant-aware queries']
      });
    }

    // Analytics Patterns
    if (nlpAnalysis.processes.some(p => p.toLowerCase().includes('analytic') || p.toLowerCase().includes('report'))) {
      patterns.push({
        name: 'Domain Analytics',
        type: 'analytics',
        confidence: 0.7,
        reasoning: 'Analytics and reporting requirements detected',
        standards: ['Business intelligence', 'Data warehouse', 'Real-time analytics'],
        requirements: ['Analytics projections', 'Data marts', 'Reporting APIs']
      });
    }

    return patterns;
  }

  /**
   * Generate pattern reasoning for transparency
   */
  private generatePatternReasoning(
    core: CorePattern[],
    advanced: AdvancedPattern[],
    infrastructure: InfrastructurePattern[],
    enterprise: EnterprisePattern[]
  ): PatternReasoning[] {
    const reasoning: PatternReasoning[] = [];

    // Core pattern reasoning
    core.forEach(pattern => {
      reasoning.push({
        pattern: pattern.name,
        category: 'core',
        confidence: pattern.confidence,
        factors: [
          {
            factor: 'Domain Modeling',
            weight: 0.9,
            evidence: pattern.reasoning,
            impact: 'positive'
          }
        ],
        alternatives: this.getAlternatives(pattern.type),
        tradeoffs: this.getTradeoffs(pattern.type)
      });
    });

    // Advanced pattern reasoning
    advanced.forEach(pattern => {
      reasoning.push({
        pattern: pattern.name,
        category: 'advanced',
        confidence: pattern.confidence,
        factors: [
          {
            factor: 'Complexity Management',
            weight: 0.8,
            evidence: pattern.reasoning,
            impact: 'positive'
          },
          {
            factor: 'Implementation Complexity',
            weight: pattern.complexity,
            evidence: `Complexity score: ${pattern.complexity}`,
            impact: 'negative'
          }
        ],
        alternatives: this.getAdvancedAlternatives(pattern.type),
        tradeoffs: [`Increased complexity: ${pattern.complexity}`, ...pattern.requirements]
      });
    });

    return reasoning;
  }

  /**
   * Setup pattern selection rules
   */
  private setupPatternRules(): void {
    // Core pattern rules will be defined here
    // Advanced pattern rules will be defined here
    // Infrastructure rules will be defined here
    // Enterprise rules will be defined here
  }

  // Helper methods (implementations would be detailed based on specific logic)
  private shouldCreateAggregate(entity: string, nlpAnalysis: NLPAnalysis, context: any): boolean {
    // Logic to determine if entity should be an aggregate
    return context.entities.includes(entity) &&
           nlpAnalysis.businessRules.some(rule => rule.entities.includes(entity));
  }

  private identifyValueObjects(nlpAnalysis: NLPAnalysis): string[] {
    // Extract potential value objects from domain analysis
    const valueObjectPatterns = ['id', 'email', 'phone', 'address', 'money', 'date', 'time'];
    return nlpAnalysis.entities.filter(entity =>
      valueObjectPatterns.some(pattern => entity.toLowerCase().includes(pattern))
    ).slice(0, 5);
  }

  private shouldUseCQRS(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): boolean {
    return nlpAnalysis.complexity > 0.6 ||
           boundedContexts.contexts.length > 2 ||
           nlpAnalysis.processes.length > 8;
  }

  private shouldUseEventSourcing(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): boolean {
    const hasAuditRequirements = nlpAnalysis.businessRules.some(rule =>
      rule.description.toLowerCase().includes('audit') ||
      rule.description.toLowerCase().includes('track') ||
      rule.description.toLowerCase().includes('history')
    );

    return hasAuditRequirements || nlpAnalysis.events.length > 10;
  }

  private shouldUseSagas(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): boolean {
    const hasLongRunningProcesses = nlpAnalysis.processes.some(process =>
      process.toLowerCase().includes('workflow') ||
      process.toLowerCase().includes('orchestrat') ||
      process.toLowerCase().includes('process')
    );

    return hasLongRunningProcesses || boundedContexts.contexts.length > 2;
  }

  private identifyDomainServices(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): any[] {
    // Identify complex business logic that doesn't belong to a single aggregate
    return nlpAnalysis.processes
      .filter(process => process.toLowerCase().includes('calculat') || process.toLowerCase().includes('validat'))
      .map(process => ({
        name: process,
        confidence: 0.7,
        reasoning: `Complex business logic: ${process}`,
        dependencies: [],
        contexts: [boundedContexts.contexts[0]?.name || 'Core']
      }))
      .slice(0, 3);
  }

  private findContextsForConcept(concept: string, boundedContexts: BoundedContextMap): string[] {
    return boundedContexts.contexts
      .filter(context =>
        context.entities.some(entity => entity.toLowerCase().includes(concept.toLowerCase()))
      )
      .map(context => context.name);
  }

  private findContextsForEntities(entities: string[], boundedContexts: BoundedContextMap): string[] {
    return boundedContexts.contexts
      .filter(context =>
        entities.some(entity => context.entities.includes(entity))
      )
      .map(context => context.name);
  }

  private getEventSourcingContexts(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): string[] {
    // Return contexts that would benefit from event sourcing
    return boundedContexts.contexts
      .filter(context => context.complexity > 0.7)
      .map(context => context.name);
  }

  private identifySagaProcesses(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): any[] {
    return nlpAnalysis.processes
      .filter(process =>
        process.toLowerCase().includes('order') ||
        process.toLowerCase().includes('payment') ||
        process.toLowerCase().includes('fulfillment')
      )
      .map(process => ({
        name: process,
        confidence: 0.8,
        reasoning: `Long-running business process: ${process}`,
        contexts: boundedContexts.contexts.map(c => c.name)
      }))
      .slice(0, 2);
  }

  private identifyProjections(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): any[] {
    return ['Summary', 'Detail', 'Analytics']
      .map(type => ({
        name: `${type}View`,
        confidence: 0.7,
        reasoning: `${type} projection for optimized read queries`,
        contexts: boundedContexts.contexts.map(c => c.name)
      }));
  }

  private identifyPolicies(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): any[] {
    return nlpAnalysis.businessRules
      .filter(rule => rule.type === 'policy')
      .map(rule => ({
        name: rule.name.replace('Rule', ''),
        confidence: 0.8,
        reasoning: `Business policy: ${rule.description}`,
        contexts: this.findContextsForEntities(rule.entities, boundedContexts)
      }));
  }

  private hasExternalIntegrations(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('external') || text.includes('third-party') || text.includes('api');
  }

  private hasReadHeavyScenarios(nlpAnalysis: NLPAnalysis): boolean {
    return nlpAnalysis.processes.some(process =>
      process.toLowerCase().includes('search') ||
      process.toLowerCase().includes('query') ||
      process.toLowerCase().includes('report')
    );
  }

  private hasSecurityRequirements(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('security') || text.includes('auth') || text.includes('permission');
  }

  private hasComplianceRequirements(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('compliance') || text.includes('gdpr') || text.includes('hipaa');
  }

  private hasAuditRequirements(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('audit') || text.includes('track') || text.includes('history');
  }

  private hasMultiTenancyRequirements(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('tenant') || text.includes('multi-tenant') || text.includes('organization');
  }

  private identifyComplianceTypes(nlpAnalysis: NLPAnalysis): string[] {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    const types: string[] = [];

    if (text.includes('gdpr')) types.push('gdpr');
    if (text.includes('hipaa')) types.push('hipaa');
    if (text.includes('sox')) types.push('sox');
    if (text.includes('pci')) types.push('pci');

    return types;
  }

  private getComplianceRequirements(compliance: string): string[] {
    const requirements: Record<string, string[]> = {
      gdpr: ['Data encryption', 'Right to be forgotten', 'Consent management', 'Data portability'],
      hipaa: ['PHI encryption', 'Access controls', 'Audit logging', 'Risk assessment'],
      sox: ['Financial controls', 'Change management', 'Documentation', 'Segregation of duties'],
      pci: ['Payment data encryption', 'Network security', 'Access controls', 'Regular testing']
    };

    return requirements[compliance] || ['General compliance controls'];
  }

  private getAlternatives(type: string): string[] {
    const alternatives: Record<string, string[]> = {
      aggregate: ['Entity with services', 'Anemic model with services'],
      repository: ['Data access layer', 'Active record pattern'],
      specification: ['Validation services', 'Business rule services']
    };

    return alternatives[type] || [];
  }

  private getTradeoffs(type: string): string[] {
    const tradeoffs: Record<string, string[]> = {
      aggregate: ['Increased complexity', 'Learning curve'],
      repository: ['Abstraction overhead', 'Additional interfaces'],
      specification: ['Pattern overhead', 'Composition complexity']
    };

    return tradeoffs[type] || [];
  }

  private getAdvancedAlternatives(type: string): string[] {
    const alternatives: Record<string, string[]> = {
      cqrs: ['Simple CRUD', 'Repository pattern only'],
      'event-sourcing': ['Traditional state storage', 'Audit tables'],
      saga: ['Two-phase commit', 'Manual coordination']
    };

    return alternatives[type] || [];
  }
}

/**
 * Pattern rule interface for extensibility
 */
interface PatternRule {
  condition: (nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap) => boolean;
  pattern: any;
  priority: number;
}
