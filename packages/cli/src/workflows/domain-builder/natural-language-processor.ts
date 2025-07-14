/**
 * @fileoverview Natural Language Processor
 * AI-powered analysis of domain descriptions for intelligent component extraction
 */

/**
 * NLP Analysis result
 */
export interface NLPAnalysis {
  entities: string[];
  processes: string[];
  relationships: Relationship[];
  businessRules: BusinessRule[];
  events: string[];
  complexity: number;
  domainType: 'simple' | 'moderate' | 'complex' | 'enterprise';
  recommendations: string[];
}

/**
 * Relationship between entities
 */
export interface Relationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many' | 'aggregation' | 'composition';
  description: string;
}

/**
 * Business rule extracted from description
 */
export interface BusinessRule {
  name: string;
  description: string;
  type: 'invariant' | 'validation' | 'policy' | 'constraint';
  entities: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Natural Language Processor for domain analysis
 */
export class NaturalLanguageProcessor {
  private entityKeywords: string[] = [
    'order', 'customer', 'user', 'product', 'payment', 'account', 'invoice',
    'shipment', 'inventory', 'booking', 'appointment', 'reservation', 'contract',
    'policy', 'claim', 'transaction', 'transfer', 'document', 'report', 'notification',
    'subscription', 'membership', 'cart', 'item', 'category', 'brand', 'supplier',
    'employee', 'department', 'project', 'task', 'milestone', 'resource', 'asset',
    'portfolio', 'campaign', 'promotion', 'discount', 'coupon', 'review', 'rating',
    'comment', 'feedback', 'ticket', 'issue', 'request', 'approval', 'workflow',
    'patient', 'doctor', 'nurse', 'treatment', 'diagnosis', 'prescription', 'medical',
    'student', 'teacher', 'course', 'lesson', 'exam', 'grade', 'assignment',
    'vehicle', 'driver', 'route', 'delivery', 'package', 'tracking', 'warehouse'
  ];

  private processKeywords: string[] = [
    'create', 'update', 'delete', 'submit', 'approve', 'reject', 'cancel', 'process',
    'validate', 'verify', 'confirm', 'authorize', 'authenticate', 'login', 'logout',
    'register', 'activate', 'deactivate', 'suspend', 'restore', 'archive', 'backup',
    'import', 'export', 'sync', 'migrate', 'transform', 'calculate', 'generate',
    'send', 'receive', 'publish', 'subscribe', 'notify', 'alert', 'remind',
    'schedule', 'book', 'reserve', 'allocate', 'assign', 'transfer', 'exchange',
    'refund', 'charge', 'bill', 'invoice', 'pay', 'collect', 'deposit', 'withdraw',
    'ship', 'deliver', 'track', 'route', 'dispatch', 'fulfill', 'return',
    'diagnose', 'treat', 'prescribe', 'examine', 'test', 'analyze', 'evaluate',
    'teach', 'learn', 'study', 'practice', 'exercise', 'train', 'educate'
  ];

  private eventKeywords: string[] = [
    'created', 'updated', 'deleted', 'submitted', 'approved', 'rejected', 'cancelled',
    'processed', 'completed', 'failed', 'started', 'finished', 'paused', 'resumed',
    'activated', 'deactivated', 'suspended', 'restored', 'archived', 'expired',
    'scheduled', 'booked', 'reserved', 'confirmed', 'verified', 'validated',
    'sent', 'received', 'delivered', 'returned', 'refunded', 'charged', 'paid',
    'assigned', 'transferred', 'allocated', 'released', 'locked', 'unlocked'
  ];

  private complexityIndicators: string[] = [
    'workflow', 'saga', 'orchestration', 'compensation', 'async', 'asynchronous',
    'parallel', 'concurrent', 'distributed', 'microservice', 'event-driven',
    'real-time', 'streaming', 'queue', 'batch', 'transaction', 'acid', 'consistency',
    'eventual', 'compensation', 'rollback', 'retry', 'circuit-breaker', 'timeout',
    'multi-tenant', 'scalable', 'high-availability', 'fault-tolerant', 'resilient',
    'compliance', 'audit', 'gdpr', 'hipaa', 'sox', 'pci', 'security', 'encryption',
    'authentication', 'authorization', 'rbac', 'oauth', 'jwt', 'saml', 'sso'
  ];

  /**
   * Analyze domain description using NLP techniques
   */
  async analyzeDescription(description: string): Promise<NLPAnalysis> {
    const lower = description.toLowerCase();
    const words = lower.split(/\s+/);
    const sentences = description.split(/[.!?]+/);

    // Extract entities
    const entities = this.extractEntities(lower, words);

    // Extract processes
    const processes = this.extractProcesses(lower, words);

    // Extract events
    const events = this.extractEvents(lower, words, entities);

    // Extract relationships
    const relationships = this.extractRelationships(description, entities);

    // Extract business rules
    const businessRules = this.extractBusinessRules(description, entities);

    // Calculate complexity
    const complexity = this.calculateComplexity(lower, words, entities, processes);

    // Determine domain type
    const domainType = this.determineDomainType(complexity, entities.length, processes.length);

    // Generate recommendations
    const recommendations = this.generateRecommendations(complexity, entities, processes, businessRules);

    return {
      entities,
      processes,
      events,
      relationships,
      businessRules,
      complexity,
      domainType,
      recommendations
    };
  }

  /**
   * Extract domain entities from description
   */
  private extractEntities(lower: string, words: string[]): string[] {
    const entities = new Set<string>();

    // Find entity keywords
    this.entityKeywords.forEach(keyword => {
      if (lower.includes(keyword)) {
        entities.add(this.capitalizeFirst(keyword));
      }
    });

    // Find potential entities using pattern matching
    const entityPatterns = [
      /(\w+)(?:\s+(?:has|have|contains?|includes?|manages?|handles?))/g,
      /(?:create|add|new|register)\s+(\w+)/g,
      /(\w+)\s+(?:can|may|should|must|will)/g,
      /(?:the|a|an)\s+(\w+)\s+(?:is|are|has|have)/g
    ];

    entityPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const candidate = match[1];
        if (candidate && candidate.length > 2 && !this.isCommonWord(candidate)) {
          entities.add(this.capitalizeFirst(candidate));
        }
      }
    });

    // Remove duplicates and filter
    return Array.from(entities)
      .filter(entity => entity.length > 2)
      .slice(0, 15); // Limit to prevent overwhelming output
  }

  /**
   * Extract business processes from description
   */
  private extractProcesses(lower: string, words: string[]): string[] {
    const processes = new Set<string>();

    // Find process keywords
    this.processKeywords.forEach(keyword => {
      if (lower.includes(keyword)) {
        processes.add(this.capitalizeFirst(keyword));
      }
    });

    // Find process patterns
    const processPatterns = [
      /(\w+(?:\s+\w+)?)\s+(?:process|workflow|procedure|operation)/g,
      /(?:when|if)\s+(\w+(?:\s+\w+)?)\s+(?:happens|occurs|is)/g,
      /(\w+(?:\s+\w+)?)\s+(?:can be|is|are)\s+(?:processed|handled|managed)/g,
      /(?:customer|user|system)\s+(?:can|may|should)\s+(\w+(?:\s+\w+)?)/g
    ];

    processPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const candidate = match[1]?.trim();
        if (candidate && candidate.length > 2 && !this.isCommonWord(candidate)) {
          processes.add(this.capitalizeWords(candidate));
        }
      }
    });

    return Array.from(processes).slice(0, 10);
  }

  /**
   * Extract domain events from description
   */
  private extractEvents(lower: string, words: string[], entities: string[]): string[] {
    const events = new Set<string>();

    // Generate events from entities and event keywords
    entities.forEach(entity => {
      this.eventKeywords.forEach(eventKeyword => {
        if (lower.includes(eventKeyword) || lower.includes(entity.toLowerCase())) {
          events.add(`${entity}${this.capitalizeFirst(eventKeyword)}`);
        }
      });
    });

    // Find explicit event patterns
    const eventPatterns = [
      /when\s+(\w+(?:\s+\w+)?)\s+(?:happens|occurs|is\s+\w+)/g,
      /after\s+(\w+(?:\s+\w+)?)/g,
      /(\w+)\s+(?:event|notification|alert|signal)/g
    ];

    eventPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const candidate = match[1]?.trim();
        if (candidate && candidate.length > 2) {
          events.add(`${this.capitalizeWords(candidate.replace(/\s+/g, ''))} + Event`);
        }
      }
    });

    return Array.from(events).slice(0, 20);
  }

  /**
   * Extract relationships between entities
   */
  private extractRelationships(description: string, entities: string[]): Relationship[] {
    const relationships: Relationship[] = [];
    const lower = description.toLowerCase();

    // Relationship patterns
    const relationshipPatterns = [
      {
        pattern: /(\w+)\s+(?:has|have|contains?|includes?)\s+(?:one|many|multiple)?\s*(\w+)/g,
        type: 'one-to-many' as const
      },
      {
        pattern: /(\w+)\s+belongs?\s+to\s+(\w+)/g,
        type: 'many-to-one' as const
      },
      {
        pattern: /(\w+)\s+(?:is\s+part\s+of|consists?\s+of)\s+(\w+)/g,
        type: 'composition' as const
      },
      {
        pattern: /(\w+)\s+(?:uses?|utilizes?|depends?\s+on)\s+(\w+)/g,
        type: 'aggregation' as const
      }
    ];

    relationshipPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const from = this.capitalizeFirst(match[1] || '');
        const to = this.capitalizeFirst(match[2] || '');

        if (entities.includes(from) || entities.includes(to)) {
          relationships.push({
            from,
            to,
            type,
            description: match[0]
          });
        }
      }
    });

    return relationships.slice(0, 10);
  }

  /**
   * Extract business rules from description
   */
  private extractBusinessRules(description: string, entities: string[]): BusinessRule[] {
    const businessRules: BusinessRule[] = [];
    const lower = description.toLowerCase();

    // Business rule patterns
    const rulePatterns = [
      {
        pattern: /(\w+(?:\s+\w+)?)\s+(?:must|should|cannot|can't|may not|is not allowed)/g,
        type: 'constraint' as const,
        priority: 'high' as const
      },
      {
        pattern: /(?:only|at least|at most|minimum|maximum|within)\s+(\w+(?:\s+\w+)?)/g,
        type: 'validation' as const,
        priority: 'medium' as const
      },
      {
        pattern: /(?:if|when)\s+(\w+(?:\s+\w+)?)\s+then/g,
        type: 'policy' as const,
        priority: 'medium' as const
      },
      {
        pattern: /(\w+(?:\s+\w+)?)\s+(?:always|never|invariant)/g,
        type: 'invariant' as const,
        priority: 'high' as const
      }
    ];

    rulePatterns.forEach(({ pattern, type, priority }) => {
      let match;
      while ((match = pattern.exec(lower)) !== null) {
        const ruleName = this.capitalizeWords(match[1]?.trim().replace(/\s+/g, '') || '');
        const relatedEntities = entities.filter(entity =>
          lower.includes(entity.toLowerCase())
        );

        businessRules.push({
          name: `${ruleName}Rule`,
          description: match[0],
          type,
          entities: relatedEntities,
          priority
        });
      }
    });

    return businessRules.slice(0, 8);
  }

  /**
   * Calculate domain complexity score
   */
  private calculateComplexity(lower: string, words: string[], entities: string[], processes: string[]): number {
    let score = 0;

    // Base complexity from entity count
    score += Math.min(entities.length * 0.1, 0.4);

    // Process complexity
    score += Math.min(processes.length * 0.05, 0.2);

    // Complexity indicators
    let complexityCount = 0;
    this.complexityIndicators.forEach(indicator => {
      if (lower.includes(indicator)) {
        complexityCount++;
      }
    });
    score += Math.min(complexityCount * 0.05, 0.3);

    // Async/event-driven indicators
    if (lower.includes('async') || lower.includes('event') || lower.includes('queue')) {
      score += 0.1;
    }

    // Integration complexity
    if (lower.includes('external') || lower.includes('third-party') || lower.includes('api')) {
      score += 0.1;
    }

    // Compliance/security complexity
    if (this.complexityIndicators.some(indicator =>
      ['compliance', 'audit', 'gdpr', 'hipaa', 'security'].includes(indicator) &&
      lower.includes(indicator)
    )) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Determine domain type based on analysis
   */
  private determineDomainType(complexity: number, entityCount: number, processCount: number): NLPAnalysis['domainType'] {
    if (complexity >= 0.8 || entityCount >= 15 || processCount >= 12) {
      return 'enterprise';
    } else if (complexity >= 0.6 || entityCount >= 10 || processCount >= 8) {
      return 'complex';
    } else if (complexity >= 0.4 || entityCount >= 5 || processCount >= 5) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    complexity: number,
    entities: string[],
    processes: string[],
    businessRules: BusinessRule[]
  ): string[] {
    const recommendations: string[] = [];

    // Architecture recommendations
    if (complexity >= 0.8) {
      recommendations.push('Consider microservices architecture for high complexity');
      recommendations.push('Implement CQRS pattern for read/write separation');
      recommendations.push('Use event sourcing for audit trails and complex state');
    } else if (complexity >= 0.6) {
      recommendations.push('Clean Architecture recommended for moderate complexity');
      recommendations.push('Consider CQRS for command/query separation');
    } else {
      recommendations.push('Hexagonal Architecture suitable for this domain');
    }

    // Pattern recommendations
    if (entities.length >= 10) {
      recommendations.push('Use bounded contexts to organize large entity sets');
      recommendations.push('Implement aggregate patterns for consistency boundaries');
    }

    if (processes.length >= 8) {
      recommendations.push('Consider saga patterns for complex business processes');
      recommendations.push('Implement process managers for workflow orchestration');
    }

    if (businessRules.length >= 5) {
      recommendations.push('Use specification patterns for complex business rules');
      recommendations.push('Implement policy patterns for rule composition');
    }

    // Technology recommendations
    if (complexity >= 0.7) {
      recommendations.push('Consider event streaming for real-time processing');
      recommendations.push('Implement resilience patterns (circuit breaker, retry)');
    }

    return recommendations.slice(0, 6);
  }

  /**
   * Helper methods
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private capitalizeWords(str: string): string {
    return str.split(' ').map(word => this.capitalizeFirst(word)).join('');
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
      'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'cannot', 'this', 'that', 'these', 'those', 'it', 'its', 'they',
      'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his',
      'she', 'her', 'hers'
    ];
    return commonWords.includes(word);
  }
}
