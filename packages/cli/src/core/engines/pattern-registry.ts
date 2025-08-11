/**
 * @fileoverview Pattern Registry - All VytchesDDD patterns registry
 * Central registry for all DDD patterns and their metadata
 */

import type { ComponentType } from '../../types';
import { CLIError } from '../../types';

export interface PatternDefinition {
  name: ComponentType;
  displayName: string;
  description: string;
  category: 'domain' | 'application' | 'infrastructure' | 'patterns';
  dependencies: ComponentType[];
  templates: string[];
  examples: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  frameworks: string[];
}

export class PatternRegistry {
  private patterns = new Map<ComponentType, PatternDefinition>();

  constructor() {
    this.initializeBuiltInPatterns();
  }

  /**
   * Create pattern registry instance
   */
  static create(): PatternRegistry {
    return new PatternRegistry();
  }

  /**
   * Initialize built-in pattern definitions
   */
  private initializeBuiltInPatterns(): void {
    // Domain Layer Patterns
    this.patterns.set('aggregate', {
      name: 'aggregate',
      displayName: 'Aggregate Root',
      description: 'Domain aggregate that encapsulates business logic and maintains consistency',
      category: 'domain',
      dependencies: ['entity', 'value-object'],
      templates: ['aggregates/aggregate.ts.template', 'aggregates/aggregate.test.ts.template'],
      examples: ['OrderAggregate', 'CustomerAggregate', 'ProductAggregate'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('entity', {
      name: 'entity',
      displayName: 'Entity',
      description: 'Domain entity with unique identity and lifecycle',
      category: 'domain',
      dependencies: ['value-object'],
      templates: ['entities/entity.ts.template', 'entities/entity.test.ts.template'],
      examples: ['OrderItem', 'Customer', 'Product'],
      complexity: 'basic',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('value-object', {
      name: 'value-object',
      displayName: 'Value Object',
      description: 'Immutable value object that describes characteristics',
      category: 'domain',
      dependencies: [],
      templates: [
        'value-objects/value-object.ts.template',
        'value-objects/value-object.test.ts.template',
      ],
      examples: ['Money', 'Address', 'Email'],
      complexity: 'basic',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('specification', {
      name: 'specification',
      displayName: 'Specification',
      description: 'Business rule specification for domain validation',
      category: 'domain',
      dependencies: [],
      templates: [
        'specifications/specification.ts.template',
        'specifications/specification.test.ts.template',
      ],
      examples: ['CustomerEligibilitySpec', 'OrderValidationSpec'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('policy', {
      name: 'policy',
      displayName: 'Business Policy',
      description: 'Complex business policy with multiple rules and conditions',
      category: 'domain',
      dependencies: ['specification'],
      templates: ['policies/policy.ts.template'],
      examples: ['PricingPolicy', 'DiscountPolicy', 'RefundPolicy'],
      complexity: 'advanced',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    // Application Layer Patterns
    this.patterns.set('command', {
      name: 'command',
      displayName: 'Command',
      description: 'CQRS command that represents an intent to change state',
      category: 'application',
      dependencies: [],
      templates: ['commands/command.ts.template'],
      examples: ['CreateOrderCommand', 'UpdateCustomerCommand'],
      complexity: 'basic',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('query', {
      name: 'query',
      displayName: 'Query',
      description: 'CQRS query that represents a request for data',
      category: 'application',
      dependencies: [],
      templates: ['queries/query.ts.template'],
      examples: ['GetOrderQuery', 'GetCustomerQuery'],
      complexity: 'basic',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('handler', {
      name: 'handler',
      displayName: 'Command/Query Handler',
      description: 'Handles commands and queries in CQRS pattern',
      category: 'application',
      dependencies: ['command', 'query'],
      templates: ['command-handler.ts.template', 'query-handler.ts.template'],
      examples: ['CreateOrderHandler', 'GetOrderHandler'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('service', {
      name: 'service',
      displayName: 'Domain Service',
      description: "Domain service for operations that don't belong to entities",
      category: 'application',
      dependencies: [],
      templates: ['domain-services/domain-service.ts.template'],
      examples: ['PricingService', 'NotificationService'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('event', {
      name: 'event',
      displayName: 'Domain Event',
      description: 'Domain event that represents something important that happened',
      category: 'domain',
      dependencies: [],
      templates: ['events/domain-event.ts.template'],
      examples: ['OrderCreatedEvent', 'CustomerRegisteredEvent'],
      complexity: 'basic',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    // Infrastructure Layer Patterns
    this.patterns.set('repository', {
      name: 'repository',
      displayName: 'Repository',
      description: 'Repository pattern for data access abstraction',
      category: 'infrastructure',
      dependencies: ['aggregate'],
      templates: ['repositories/repository.ts.template'],
      examples: ['OrderRepository', 'CustomerRepository'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('middleware', {
      name: 'middleware',
      displayName: 'Middleware',
      description: 'Cross-cutting concern middleware for request processing',
      category: 'infrastructure',
      dependencies: [],
      templates: ['middleware.ts.template', 'middleware.test.ts.template'],
      examples: ['ValidationMiddleware', 'LoggingMiddleware'],
      complexity: 'intermediate',
      frameworks: ['nestjs', 'express'],
    });

    this.patterns.set('processor', {
      name: 'processor',
      displayName: 'Event Processor',
      description: 'Processes domain events for side effects',
      category: 'infrastructure',
      dependencies: ['event'],
      templates: ['event-processor.ts.template', 'processor.test.ts.template'],
      examples: ['EmailProcessor', 'NotificationProcessor'],
      complexity: 'advanced',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('saga', {
      name: 'saga',
      displayName: 'Saga',
      description: 'Long-running business process orchestrator',
      category: 'patterns',
      dependencies: ['event', 'command'],
      templates: ['saga.ts.template', 'saga.test.ts.template'],
      examples: ['OrderProcessingSaga', 'PaymentSaga'],
      complexity: 'advanced',
      frameworks: ['nestjs', 'express', 'standalone'],
    });

    this.patterns.set('projection', {
      name: 'projection',
      displayName: 'Projection',
      description: 'Read model projection from event stream',
      category: 'patterns',
      dependencies: ['event'],
      templates: ['projection.ts.template', 'projection.test.ts.template'],
      examples: ['OrderSummaryProjection', 'CustomerViewProjection'],
      complexity: 'advanced',
      frameworks: ['nestjs', 'express', 'standalone'],
    });
  }

  /**
   * Get pattern definition
   */
  getPattern(type: ComponentType): PatternDefinition {
    const pattern = this.patterns.get(type);
    if (!pattern) {
      throw new CLIError(`Unknown pattern type: ${type}`);
    }
    return pattern;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): PatternDefinition[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(
    category: 'domain' | 'application' | 'infrastructure' | 'patterns'
  ): PatternDefinition[] {
    return this.getAllPatterns().filter(pattern => pattern.category === category);
  }

  /**
   * Get patterns by complexity
   */
  getPatternsByComplexity(complexity: 'basic' | 'intermediate' | 'advanced'): PatternDefinition[] {
    return this.getAllPatterns().filter(pattern => pattern.complexity === complexity);
  }

  /**
   * Get patterns supported by framework
   */
  getPatternsByFramework(framework: string): PatternDefinition[] {
    return this.getAllPatterns().filter(pattern => pattern.frameworks.includes(framework));
  }

  /**
   * Check if pattern exists
   */
  hasPattern(type: ComponentType): boolean {
    return this.patterns.has(type);
  }

  /**
   * Register custom pattern
   */
  registerPattern(pattern: PatternDefinition): void {
    this.patterns.set(pattern.name, pattern);
  }

  /**
   * Get pattern dependencies
   */
  getPatternDependencies(type: ComponentType): ComponentType[] {
    const pattern = this.getPattern(type);
    return pattern.dependencies;
  }

  /**
   * Get all dependencies recursively
   */
  getAllDependencies(type: ComponentType): ComponentType[] {
    const visited = new Set<ComponentType>();
    const dependencies: ComponentType[] = [];

    const collectDependencies = (patternType: ComponentType) => {
      if (visited.has(patternType)) {
        return;
      }

      visited.add(patternType);
      const pattern = this.getPattern(patternType);

      for (const dep of pattern.dependencies) {
        dependencies.push(dep);
        collectDependencies(dep);
      }
    };

    collectDependencies(type);
    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Check if pattern has dependencies
   */
  hasDependencies(type: ComponentType): boolean {
    const pattern = this.getPattern(type);
    return pattern.dependencies.length > 0;
  }

  /**
   * Get pattern suggestions based on existing patterns
   */
  getSuggestions(existingPatterns: ComponentType[]): ComponentType[] {
    const suggestions: ComponentType[] = [];
    const existing = new Set(existingPatterns);

    // Suggest complementary patterns
    if (existing.has('aggregate') && !existing.has('repository')) {
      suggestions.push('repository');
    }

    if (existing.has('command') && !existing.has('handler')) {
      suggestions.push('handler');
    }

    if (existing.has('event') && !existing.has('processor')) {
      suggestions.push('processor');
    }

    if (existing.has('aggregate') && existing.has('event') && !existing.has('saga')) {
      suggestions.push('saga');
    }

    if (existing.has('event') && !existing.has('projection')) {
      suggestions.push('projection');
    }

    return suggestions;
  }

  /**
   * Validate pattern combination
   */
  validatePatternCombination(patterns: ComponentType[]): {
    isValid: boolean;
    missingDependencies: ComponentType[];
    conflicts: string[];
  } {
    const patternSet = new Set(patterns);
    const missingDependencies: ComponentType[] = [];
    const conflicts: string[] = [];

    // Check dependencies
    for (const pattern of patterns) {
      const deps = this.getPatternDependencies(pattern);
      for (const dep of deps) {
        if (!patternSet.has(dep)) {
          missingDependencies.push(dep);
        }
      }
    }

    // Check for conflicts (example: can't have both aggregate and entity as main pattern)
    // Add more conflict rules as needed

    return {
      isValid: missingDependencies.length === 0 && conflicts.length === 0,
      missingDependencies: [...new Set(missingDependencies)],
      conflicts,
    };
  }

  /**
   * Generate pattern documentation
   */
  generatePatternDocumentation(type: ComponentType): string {
    const pattern = this.getPattern(type);

    let doc = `# ${pattern.displayName}\n\n`;
    doc += `**Category**: ${pattern.category}\n`;
    doc += `**Complexity**: ${pattern.complexity}\n\n`;
    doc += `${pattern.description}\n\n`;

    if (pattern.dependencies.length > 0) {
      doc += `## Dependencies\n\n`;
      pattern.dependencies.forEach(dep => {
        const depPattern = this.getPattern(dep);
        doc += `- [${depPattern.displayName}](#${dep})\n`;
      });
      doc += '\n';
    }

    if (pattern.examples.length > 0) {
      doc += `## Examples\n\n`;
      pattern.examples.forEach(example => {
        doc += `- \`${example}\`\n`;
      });
      doc += '\n';
    }

    doc += `## Supported Frameworks\n\n`;
    pattern.frameworks.forEach(framework => {
      doc += `- ${framework}\n`;
    });

    return doc;
  }

  /**
   * Get learning path for patterns
   */
  getLearningPath(): ComponentType[][] {
    return [
      // Basic patterns - start here
      ['value-object', 'entity'],

      // Intermediate patterns
      ['aggregate', 'specification'],

      // Application patterns
      ['command', 'query', 'handler'],

      // Infrastructure patterns
      ['repository', 'event'],

      // Advanced patterns
      ['policy', 'middleware', 'processor'],

      // Expert patterns
      ['saga', 'projection'],
    ];
  }
}
