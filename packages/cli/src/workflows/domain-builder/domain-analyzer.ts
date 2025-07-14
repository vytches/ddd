/**
 * @fileoverview Domain Analyzer
 * Advanced domain analysis for complexity assessment and architectural recommendations
 */

import type { NLPAnalysis } from './natural-language-processor';
import type { BoundedContextMap } from './bounded-context-mapper';

/**
 * Domain analysis result
 */
export interface DomainAnalysis {
  complexity: ComplexityAnalysis;
  architecture: ArchitectureRecommendation;
  risks: DomainRisk[];
  opportunities: DomainOpportunity[];
  metrics: DomainMetrics;
  recommendations: DomainRecommendation[];
}

/**
 * Complexity analysis breakdown
 */
export interface ComplexityAnalysis {
  overall: number;
  factors: ComplexityFactor[];
  breakdown: {
    entities: number;
    relationships: number;
    businessRules: number;
    processes: number;
    integrations: number;
  };
  classification: 'simple' | 'moderate' | 'complex' | 'enterprise';
  reasoning: string;
}

/**
 * Complexity factor contributing to overall score
 */
export interface ComplexityFactor {
  name: string;
  score: number;
  weight: number;
  impact: number;
  description: string;
  evidence: string[];
}

/**
 * Architecture recommendation
 */
export interface ArchitectureRecommendation {
  primary: string;
  alternatives: string[];
  reasoning: string;
  confidence: number;
  considerations: string[];
  migration: MigrationStrategy | null;
}

/**
 * Migration strategy for existing systems
 */
export interface MigrationStrategy {
  approach: 'big-bang' | 'strangler-fig' | 'branch-by-abstraction' | 'incremental';
  phases: MigrationPhase[];
  duration: string;
  risks: string[];
  benefits: string[];
}

/**
 * Migration phase
 */
export interface MigrationPhase {
  name: string;
  order: number;
  duration: string;
  activities: string[];
  deliverables: string[];
  risks: string[];
}

/**
 * Domain risk assessment
 */
export interface DomainRisk {
  type: 'technical' | 'business' | 'operational' | 'security' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  likelihood: number;
  mitigation: string[];
  contexts: string[];
}

/**
 * Domain opportunity identification
 */
export interface DomainOpportunity {
  type: 'optimization' | 'automation' | 'integration' | 'innovation' | 'cost-reduction';
  value: 'low' | 'medium' | 'high';
  description: string;
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
  prerequisites: string[];
  contexts: string[];
}

/**
 * Domain metrics and KPIs
 */
export interface DomainMetrics {
  size: {
    entities: number;
    aggregates: number;
    boundedContexts: number;
    relationships: number;
  };
  complexity: {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    businessRuleComplexity: number;
    integrationComplexity: number;
  };
  quality: {
    cohesion: number;
    coupling: number;
    abstraction: number;
    stability: number;
  };
  business: {
    coreProcesses: number;
    supportingProcesses: number;
    genericProcesses: number;
    businessValue: number;
  };
}

/**
 * Domain recommendation
 */
export interface DomainRecommendation {
  category: 'architecture' | 'patterns' | 'technology' | 'process' | 'governance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies: string[];
  success_criteria: string[];
}

/**
 * Domain Analyzer for comprehensive domain assessment
 */
export class DomainAnalyzer {
  /**
   * Analyze domain comprehensively
   */
  async analyzeDomain(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): Promise<DomainAnalysis> {

    const complexity = this.analyzeComplexity(nlpAnalysis, boundedContexts);
    const architecture = this.recommendArchitecture(nlpAnalysis, boundedContexts, complexity);
    const risks = this.assessRisks(nlpAnalysis, boundedContexts, complexity);
    const opportunities = this.identifyOpportunities(nlpAnalysis, boundedContexts);
    const metrics = this.calculateMetrics(nlpAnalysis, boundedContexts);
    const recommendations = this.generateRecommendations(nlpAnalysis, boundedContexts, complexity, architecture);

    return {
      complexity,
      architecture,
      risks,
      opportunities,
      metrics,
      recommendations
    };
  }

  /**
   * Analyze domain complexity
   */
  private analyzeComplexity(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): ComplexityAnalysis {
    const factors: ComplexityFactor[] = [];

    // Entity complexity
    const entityComplexity = this.calculateEntityComplexity(nlpAnalysis, boundedContexts);
    factors.push(entityComplexity);

    // Relationship complexity
    const relationshipComplexity = this.calculateRelationshipComplexity(nlpAnalysis, boundedContexts);
    factors.push(relationshipComplexity);

    // Business rule complexity
    const businessRuleComplexity = this.calculateBusinessRuleComplexity(nlpAnalysis);
    factors.push(businessRuleComplexity);

    // Process complexity
    const processComplexity = this.calculateProcessComplexity(nlpAnalysis, boundedContexts);
    factors.push(processComplexity);

    // Integration complexity
    const integrationComplexity = this.calculateIntegrationComplexity(nlpAnalysis, boundedContexts);
    factors.push(integrationComplexity);

    // Calculate overall complexity
    const overall = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);

    // Complexity breakdown
    const breakdown = {
      entities: entityComplexity.score,
      relationships: relationshipComplexity.score,
      businessRules: businessRuleComplexity.score,
      processes: processComplexity.score,
      integrations: integrationComplexity.score
    };

    // Classification
    const classification = this.classifyComplexity(overall);

    // Reasoning
    const reasoning = this.generateComplexityReasoning(factors, overall, classification);

    return {
      overall,
      factors,
      breakdown,
      classification,
      reasoning
    };
  }

  /**
   * Calculate entity complexity
   */
  private calculateEntityComplexity(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): ComplexityFactor {
    const entityCount = nlpAnalysis.entities.length;
    const contextCount = boundedContexts.contexts.length;

    // Score based on entity count and distribution
    let score = Math.min(entityCount * 0.05, 0.4);

    // Adjust for context distribution
    if (contextCount > 0) {
      const avgEntitiesPerContext = entityCount / contextCount;
      if (avgEntitiesPerContext > 8) {
        score += 0.1; // High entity concentration
      }
    }

    const evidence = [
      `${entityCount} entities identified`,
      `Distributed across ${contextCount} contexts`,
      contextCount > 0 ? `Average ${Math.round(entityCount / contextCount)} entities per context` : 'No context organization'
    ];

    return {
      name: 'Entity Complexity',
      score,
      weight: 0.25,
      impact: score * 0.25,
      description: 'Complexity from domain entities and their organization',
      evidence
    };
  }

  /**
   * Calculate relationship complexity
   */
  private calculateRelationshipComplexity(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): ComplexityFactor {
    const relationshipCount = nlpAnalysis.relationships.length;
    const contextRelationships = boundedContexts.relationships.length;

    let score = Math.min(relationshipCount * 0.03, 0.3);
    score += Math.min(contextRelationships * 0.05, 0.2);

    const evidence = [
      `${relationshipCount} entity relationships`,
      `${contextRelationships} context relationships`,
      `Relationship density: ${relationshipCount > 0 ? (relationshipCount / nlpAnalysis.entities.length).toFixed(2) : '0'}`
    ];

    return {
      name: 'Relationship Complexity',
      score,
      weight: 0.2,
      impact: score * 0.2,
      description: 'Complexity from entity and context relationships',
      evidence
    };
  }

  /**
   * Calculate business rule complexity
   */
  private calculateBusinessRuleComplexity(nlpAnalysis: NLPAnalysis): ComplexityFactor {
    const ruleCount = nlpAnalysis.businessRules.length;
    const highPriorityRules = nlpAnalysis.businessRules.filter(rule => rule.priority === 'high').length;

    let score = Math.min(ruleCount * 0.08, 0.4);
    score += highPriorityRules * 0.05; // Extra weight for high priority rules

    const evidence = [
      `${ruleCount} business rules identified`,
      `${highPriorityRules} high-priority rules`,
      `Rule types: ${[...new Set(nlpAnalysis.businessRules.map(r => r.type))].join(', ')}`
    ];

    return {
      name: 'Business Rule Complexity',
      score,
      weight: 0.25,
      impact: score * 0.25,
      description: 'Complexity from business rules and constraints',
      evidence
    };
  }

  /**
   * Calculate process complexity
   */
  private calculateProcessComplexity(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): ComplexityFactor {
    const processCount = nlpAnalysis.processes.length;
    const longRunningProcesses = nlpAnalysis.processes.filter(process =>
      process.toLowerCase().includes('workflow') ||
      process.toLowerCase().includes('orchestrat') ||
      process.toLowerCase().includes('saga')
    ).length;

    let score = Math.min(processCount * 0.04, 0.3);
    score += longRunningProcesses * 0.1; // Extra weight for complex processes

    const evidence = [
      `${processCount} business processes`,
      `${longRunningProcesses} complex/long-running processes`,
      `Process distribution across ${boundedContexts.contexts.length} contexts`
    ];

    return {
      name: 'Process Complexity',
      score,
      weight: 0.2,
      impact: score * 0.2,
      description: 'Complexity from business processes and workflows',
      evidence
    };
  }

  /**
   * Calculate integration complexity
   */
  private calculateIntegrationComplexity(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): ComplexityFactor {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();

    let score = 0;
    const evidence: string[] = [];

    // External integrations
    if (text.includes('external') || text.includes('third-party') || text.includes('api')) {
      score += 0.15;
      evidence.push('External system integrations detected');
    }

    // Async/event-driven patterns
    if (text.includes('async') || text.includes('event') || text.includes('message')) {
      score += 0.1;
      evidence.push('Asynchronous/event-driven patterns');
    }

    // Multiple contexts
    if (boundedContexts.contexts.length > 2) {
      score += boundedContexts.contexts.length * 0.03;
      evidence.push(`${boundedContexts.contexts.length} bounded contexts requiring integration`);
    }

    // Context relationships
    const complexRelationships = boundedContexts.relationships.filter(rel =>
      rel.type === 'anti-corruption-layer' || rel.integration === 'event-driven'
    ).length;

    if (complexRelationships > 0) {
      score += complexRelationships * 0.05;
      evidence.push(`${complexRelationships} complex context relationships`);
    }

    if (evidence.length === 0) {
      evidence.push('No complex integrations detected');
    }

    return {
      name: 'Integration Complexity',
      score,
      weight: 0.1,
      impact: score * 0.1,
      description: 'Complexity from system integrations and context communication',
      evidence
    };
  }

  /**
   * Classify complexity level
   */
  private classifyComplexity(score: number): ComplexityAnalysis['classification'] {
    if (score >= 0.8) return 'enterprise';
    if (score >= 0.6) return 'complex';
    if (score >= 0.3) return 'moderate';
    return 'simple';
  }

  /**
   * Generate complexity reasoning
   */
  private generateComplexityReasoning(
    factors: ComplexityFactor[],
    overall: number,
    classification: string
  ): string {
    const topFactors = factors
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3)
      .map(f => f.name);

    return `Domain classified as ${classification} with ${(overall * 100).toFixed(0)}% complexity. ` +
           `Primary complexity drivers: ${topFactors.join(', ')}. ` +
           `This suggests ${this.getArchitecturalGuidance(classification)}.`;
  }

  /**
   * Get architectural guidance based on complexity
   */
  private getArchitecturalGuidance(classification: string): string {
    const guidance: Record<string, string> = {
      simple: 'a simple layered or hexagonal architecture',
      moderate: 'clean architecture with clear bounded contexts',
      complex: 'clean architecture with CQRS and event-driven patterns',
      enterprise: 'microservices with full event sourcing and advanced patterns'
    };

    return (guidance[classification] || guidance.moderate) as string;
  }

  /**
   * Recommend architecture based on analysis
   */
  private recommendArchitecture(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis
  ): ArchitectureRecommendation {
    const recommendations = this.getArchitectureRecommendations(complexity.classification, boundedContexts);

    return {
      primary: recommendations.primary,
      alternatives: recommendations.alternatives,
      reasoning: recommendations.reasoning,
      confidence: recommendations.confidence,
      considerations: recommendations.considerations,
      migration: this.assessMigrationStrategy(nlpAnalysis, boundedContexts, complexity)
    };
  }

  /**
   * Get architecture recommendations based on complexity
   */
  private getArchitectureRecommendations(
    classification: string,
    boundedContexts: BoundedContextMap
  ): {
    primary: string;
    alternatives: string[];
    reasoning: string;
    confidence: number;
    considerations: string[];
  } {
    const contextCount = boundedContexts.contexts.length;

    switch (classification) {
      case 'simple':
        return {
          primary: 'Hexagonal Architecture',
          alternatives: ['Layered Architecture', 'Clean Architecture'],
          reasoning: 'Simple domain with clear external dependencies',
          confidence: 0.9,
          considerations: ['Easy to understand', 'Quick to implement', 'Good for small teams']
        };

      case 'moderate':
        return {
          primary: 'Clean Architecture',
          alternatives: ['Hexagonal Architecture', 'Onion Architecture'],
          reasoning: 'Moderate complexity requires clear separation of concerns',
          confidence: 0.85,
          considerations: ['Clear layer separation', 'Testable design', 'Scalable structure']
        };

      case 'complex':
        return {
          primary: contextCount > 3 ? 'Modular Monolith' : 'Clean Architecture',
          alternatives: ['Microservices', 'Event-Driven Architecture'],
          reasoning: 'Complex domain with multiple contexts and advanced patterns',
          confidence: 0.8,
          considerations: ['CQRS recommended', 'Event sourcing for audit', 'Advanced testing strategies']
        };

      case 'enterprise':
        return {
          primary: 'Microservices',
          alternatives: ['Event-Driven Architecture', 'Modular Monolith'],
          reasoning: 'Enterprise complexity requires distributed architecture',
          confidence: 0.75,
          considerations: ['Service boundaries', 'Data consistency', 'Operational complexity']
        };

      default:
        return {
          primary: 'Clean Architecture',
          alternatives: ['Hexagonal Architecture'],
          reasoning: 'Default recommendation for unknown complexity',
          confidence: 0.6,
          considerations: ['Flexible starting point', 'Can evolve with requirements']
        };
    }
  }

  /**
   * Assess migration strategy
   */
  private assessMigrationStrategy(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis
  ): MigrationStrategy | null {
    // Only provide migration strategy for complex systems
    if (complexity.classification === 'simple') return null;

    const hasLegacyIndicators = this.hasLegacySystemIndicators(nlpAnalysis);
    if (!hasLegacyIndicators) return null;

    return {
      approach: complexity.classification === 'enterprise' ? 'strangler-fig' : 'incremental',
      phases: this.generateMigrationPhases(boundedContexts, complexity),
      duration: this.estimateMigrationDuration(boundedContexts, complexity),
      risks: this.identifyMigrationRisks(complexity),
      benefits: this.identifyMigrationBenefits(complexity)
    };
  }

  /**
   * Check for legacy system indicators
   */
  private hasLegacySystemIndicators(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('legacy') ||
           text.includes('migration') ||
           text.includes('modernization') ||
           text.includes('replace');
  }

  /**
   * Generate migration phases
   */
  private generateMigrationPhases(
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis
  ): MigrationPhase[] {
    const phases: MigrationPhase[] = [];

    // Phase 1: Foundation
    phases.push({
      name: 'Foundation Setup',
      order: 1,
      duration: '2-4 weeks',
      activities: ['Set up new architecture', 'Establish patterns', 'Create shared infrastructure'],
      deliverables: ['Project structure', 'Base patterns', 'CI/CD pipeline'],
      risks: ['Team learning curve', 'Tooling challenges']
    });

    // Phase 2-N: Context migration
    boundedContexts.contexts.forEach((context, index) => {
      phases.push({
        name: `${context.name} Migration`,
        order: index + 2,
        duration: '3-6 weeks',
        activities: [
          `Extract ${context.name} domain`,
          'Implement new patterns',
          'Create anti-corruption layer',
          'Gradual traffic migration'
        ],
        deliverables: [
          `${context.name} bounded context`,
          'Integration tests',
          'Performance benchmarks'
        ],
        risks: ['Data consistency', 'Integration complexity', 'Performance impact']
      });
    });

    // Final phase: Cleanup
    phases.push({
      name: 'Legacy Decommission',
      order: phases.length + 1,
      duration: '2-3 weeks',
      activities: ['Remove legacy code', 'Final testing', 'Documentation update'],
      deliverables: ['Clean codebase', 'Updated documentation', 'Migration report'],
      risks: ['Missed dependencies', 'Knowledge loss']
    });

    return phases;
  }

  /**
   * Estimate migration duration
   */
  private estimateMigrationDuration(
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis
  ): string {
    const baseWeeks = 4; // Foundation
    const contextWeeks = boundedContexts.contexts.length * 4; // Per context
    const complexityMultiplier = complexity.overall; // Complexity factor
    const cleanupWeeks = 2; // Cleanup

    const totalWeeks = Math.ceil((baseWeeks + contextWeeks) * (1 + complexityMultiplier) + cleanupWeeks);
    const months = Math.ceil(totalWeeks / 4);

    return `${totalWeeks} weeks (${months} months)`;
  }

  /**
   * Identify migration risks
   */
  private identifyMigrationRisks(complexity: ComplexityAnalysis): string[] {
    const risks = [
      'Data migration complexity',
      'Business disruption',
      'Team productivity impact',
      'Integration challenges'
    ];

    if (complexity.classification === 'enterprise') {
      risks.push('Regulatory compliance', 'Performance degradation', 'Security vulnerabilities');
    }

    return risks;
  }

  /**
   * Identify migration benefits
   */
  private identifyMigrationBenefits(complexity: ComplexityAnalysis): string[] {
    const benefits = [
      'Improved maintainability',
      'Better testability',
      'Cleaner architecture',
      'Reduced technical debt'
    ];

    if (complexity.classification === 'enterprise') {
      benefits.push('Better scalability', 'Improved performance', 'Enhanced security');
    }

    return benefits;
  }

  /**
   * Assess domain risks
   */
  private assessRisks(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis
  ): DomainRisk[] {
    const risks: DomainRisk[] = [];

    // Technical risks
    if (complexity.overall > 0.7) {
      risks.push({
        type: 'technical',
        severity: 'high',
        description: 'High domain complexity may lead to implementation challenges',
        impact: 'Increased development time and maintenance costs',
        likelihood: 0.7,
        mitigation: ['Incremental development', 'Strong testing strategy', 'Expert consultation'],
        contexts: boundedContexts.contexts.map(c => c.name)
      });
    }

    // Business risks
    if (nlpAnalysis.businessRules.length > 8) {
      risks.push({
        type: 'business',
        severity: 'medium',
        description: 'Complex business rules may be misinterpreted or incorrectly implemented',
        impact: 'Business process failures and compliance issues',
        likelihood: 0.5,
        mitigation: ['Business stakeholder involvement', 'Specification by example', 'Regular reviews'],
        contexts: boundedContexts.contexts.filter(c => c.complexity > 0.6).map(c => c.name)
      });
    }

    // Security risks
    if (this.hasSecurityRequirements(nlpAnalysis)) {
      risks.push({
        type: 'security',
        severity: 'high',
        description: 'Security requirements need careful implementation',
        impact: 'Data breaches and compliance violations',
        likelihood: 0.6,
        mitigation: ['Security reviews', 'Penetration testing', 'Compliance audits'],
        contexts: ['All contexts']
      });
    }

    return risks;
  }

  /**
   * Identify domain opportunities
   */
  private identifyOpportunities(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): DomainOpportunity[] {
    const opportunities: DomainOpportunity[] = [];

    // Automation opportunities
    const manualProcesses = nlpAnalysis.processes.filter(process =>
      process.toLowerCase().includes('manual') || process.toLowerCase().includes('approve')
    );

    if (manualProcesses.length > 0) {
      opportunities.push({
        type: 'automation',
        value: 'high',
        description: 'Automate manual processes to improve efficiency',
        benefits: ['Reduced processing time', 'Lower error rates', 'Cost savings'],
        effort: 'medium',
        prerequisites: ['Business rule definition', 'Workflow modeling'],
        contexts: boundedContexts.contexts.map(c => c.name)
      });
    }

    // Integration opportunities
    if (boundedContexts.contexts.length > 2) {
      opportunities.push({
        type: 'integration',
        value: 'medium',
        description: 'Event-driven integration between contexts',
        benefits: ['Loose coupling', 'Better scalability', 'Improved resilience'],
        effort: 'medium',
        prerequisites: ['Event modeling', 'Message infrastructure'],
        contexts: boundedContexts.contexts.map(c => c.name)
      });
    }

    return opportunities;
  }

  /**
   * Calculate domain metrics
   */
  private calculateMetrics(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap
  ): DomainMetrics {
    return {
      size: {
        entities: nlpAnalysis.entities.length,
        aggregates: this.estimateAggregateCount(nlpAnalysis, boundedContexts),
        boundedContexts: boundedContexts.contexts.length,
        relationships: nlpAnalysis.relationships.length
      },
      complexity: {
        cyclomaticComplexity: this.calculateCyclomaticComplexity(nlpAnalysis),
        cognitiveComplexity: this.calculateCognitiveComplexity(nlpAnalysis),
        businessRuleComplexity: nlpAnalysis.businessRules.length * 0.1,
        integrationComplexity: boundedContexts.relationships.length * 0.1
      },
      quality: {
        cohesion: this.calculateCohesion(boundedContexts),
        coupling: this.calculateCoupling(boundedContexts),
        abstraction: this.calculateAbstraction(nlpAnalysis),
        stability: this.calculateStability(boundedContexts)
      },
      business: {
        coreProcesses: boundedContexts.contexts.filter(c => c.type === 'core').length,
        supportingProcesses: boundedContexts.contexts.filter(c => c.type === 'supporting').length,
        genericProcesses: boundedContexts.contexts.filter(c => c.type === 'generic').length,
        businessValue: this.calculateBusinessValue(nlpAnalysis, boundedContexts)
      }
    };
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateRecommendations(
    nlpAnalysis: NLPAnalysis,
    boundedContexts: BoundedContextMap,
    complexity: ComplexityAnalysis,
    architecture: ArchitectureRecommendation
  ): DomainRecommendation[] {
    const recommendations: DomainRecommendation[] = [];

    // Architecture recommendations
    recommendations.push({
      category: 'architecture',
      priority: 'high',
      title: `Implement ${architecture.primary}`,
      description: architecture.reasoning,
      benefits: ['Clear separation of concerns', 'Improved maintainability', 'Better testability'],
      effort: complexity.classification === 'simple' ? 'low' : 'medium',
      timeline: '2-4 weeks',
      dependencies: ['Team training', 'Tooling setup'],
      success_criteria: ['Clean layer separation', 'Dependency inversion', 'Test coverage > 80%']
    });

    // Pattern recommendations
    if (complexity.overall > 0.6) {
      recommendations.push({
        category: 'patterns',
        priority: 'medium',
        title: 'Implement CQRS Pattern',
        description: 'Separate read and write models for better performance and scalability',
        benefits: ['Optimized queries', 'Better scalability', 'Clear responsibility separation'],
        effort: 'medium',
        timeline: '3-5 weeks',
        dependencies: ['Event infrastructure', 'Read model storage'],
        success_criteria: ['Separate command/query models', 'Performance improvements', 'Scalable reads']
      });
    }

    // Technology recommendations
    recommendations.push({
      category: 'technology',
      priority: 'medium',
      title: 'Set up comprehensive testing',
      description: 'Implement multi-layer testing strategy for domain reliability',
      benefits: ['Higher code quality', 'Faster development', 'Reduced bugs'],
      effort: 'low',
      timeline: '1-2 weeks',
      dependencies: ['Testing framework selection', 'CI/CD pipeline'],
      success_criteria: ['Test coverage > 90%', 'Automated testing', 'Fast feedback loops']
    });

    return recommendations;
  }

  // Helper methods for metric calculations
  private estimateAggregateCount(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): number {
    // Estimate one aggregate per 2-3 entities, distributed across contexts
    return Math.ceil(nlpAnalysis.entities.length / 2.5);
  }

  private calculateCyclomaticComplexity(nlpAnalysis: NLPAnalysis): number {
    // Estimate based on business rules and processes
    return nlpAnalysis.businessRules.length + nlpAnalysis.processes.length * 0.5;
  }

  private calculateCognitiveComplexity(nlpAnalysis: NLPAnalysis): number {
    // Estimate based on relationships and nested business rules
    return nlpAnalysis.relationships.length + nlpAnalysis.businessRules.length * 0.8;
  }

  private calculateCohesion(boundedContexts: BoundedContextMap): number {
    // Higher cohesion when contexts have focused responsibilities
    const avgEntitiesPerContext = boundedContexts.contexts.length > 0 ?
      boundedContexts.contexts.reduce((sum, ctx) => sum + ctx.entities.length, 0) / boundedContexts.contexts.length : 0;

    return Math.max(0, 1 - (avgEntitiesPerContext / 10)); // Lower is better for cohesion
  }

  private calculateCoupling(boundedContexts: BoundedContextMap): number {
    // Lower coupling when fewer relationships between contexts
    const relationshipRatio = boundedContexts.contexts.length > 0 ?
      boundedContexts.relationships.length / boundedContexts.contexts.length : 0;

    return Math.min(1, relationshipRatio / 3); // Lower is better
  }

  private calculateAbstraction(nlpAnalysis: NLPAnalysis): number {
    // Higher abstraction with more value objects and specifications
    const abstractionCount = nlpAnalysis.businessRules.length;
    return Math.min(1, abstractionCount / 10);
  }

  private calculateStability(boundedContexts: BoundedContextMap): number {
    // Stability based on context independence
    const dependentContexts = boundedContexts.relationships.length;
    const totalContexts = boundedContexts.contexts.length;

    return totalContexts > 0 ? Math.max(0, 1 - (dependentContexts / totalContexts)) : 1;
  }

  private calculateBusinessValue(nlpAnalysis: NLPAnalysis, boundedContexts: BoundedContextMap): number {
    // Business value based on core processes and business rules
    const coreContexts = boundedContexts.contexts.filter(c => c.type === 'core').length;
    const totalContexts = boundedContexts.contexts.length;

    return totalContexts > 0 ? coreContexts / totalContexts : 0;
  }

  private hasSecurityRequirements(nlpAnalysis: NLPAnalysis): boolean {
    const text = [...nlpAnalysis.entities, ...nlpAnalysis.processes].join(' ').toLowerCase();
    return text.includes('security') || text.includes('auth') || text.includes('permission') || text.includes('encrypt');
  }
}
