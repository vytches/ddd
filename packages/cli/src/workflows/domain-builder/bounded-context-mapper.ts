/**
 * @fileoverview Bounded Context Mapper
 * Intelligent bounded context identification and relationship mapping
 */

import type { NLPAnalysis } from './natural-language-processor';
import { Colors } from '../../core/utils/colors';

/**
 * Bounded context definition
 */
export interface BoundedContext {
  name: string;
  description: string;
  entities: string[];
  processes: string[];
  events: string[];
  responsibilities: string[];
  type: 'core' | 'supporting' | 'generic';
  complexity: number;
}

/**
 * Context relationship definition
 */
export interface ContextRelationship {
  upstream: string;
  downstream: string;
  type: 'customer-supplier' | 'conformist' | 'anti-corruption-layer' | 'shared-kernel' | 'partnership';
  description: string;
  integration: 'synchronous' | 'asynchronous' | 'batch' | 'event-driven';
}

/**
 * Bounded context map result
 */
export interface BoundedContextMap {
  contexts: BoundedContext[];
  relationships: ContextRelationship[];
  insights: ContextInsight[];
}

/**
 * Context insight for recommendations
 */
export interface ContextInsight {
  type: 'warning' | 'suggestion' | 'opportunity';
  title: string;
  description: string;
  contexts: string[];
  impact: 'low' | 'medium' | 'high';
}

/**
 * Bounded Context Mapper for intelligent context identification
 */
export class BoundedContextMapper {
  private domainPatterns: Record<string, string[]> = {
    'e-commerce': [
      'Order Management', 'Customer Management', 'Inventory Management',
      'Payment Processing', 'Shipping & Fulfillment', 'Product Catalog'
    ],
    'banking': [
      'Account Management', 'Transaction Processing', 'Loan Management',
      'Payment Services', 'Compliance & Reporting', 'Customer Onboarding'
    ],
    'healthcare': [
      'Patient Management', 'Appointment Scheduling', 'Medical Records',
      'Billing & Insurance', 'Treatment Planning', 'Medication Management'
    ],
    'education': [
      'Student Management', 'Course Management', 'Assessment & Grading',
      'Enrollment & Registration', 'Academic Planning', 'Resource Management'
    ],
    'logistics': [
      'Transportation Management', 'Warehouse Management', 'Route Planning',
      'Package Tracking', 'Fleet Management', 'Customer Service'
    ],
    'insurance': [
      'Policy Management', 'Claims Processing', 'Underwriting',
      'Customer Management', 'Billing & Payments', 'Risk Assessment'
    ]
  };

  /**
   * Generate bounded contexts from NLP analysis
   */
  async generateContexts(nlpAnalysis: NLPAnalysis): Promise<BoundedContextMap> {
    // Detect domain type for pattern matching
    const domainType = this.detectDomainType(nlpAnalysis);

    // Generate contexts using multiple strategies
    const contexts = await this.generateContextsFromAnalysis(nlpAnalysis, domainType);

    // Generate relationships between contexts
    const relationships = this.generateContextRelationships(contexts, nlpAnalysis);

    // Generate insights and recommendations
    const insights = this.generateContextInsights(contexts, relationships, nlpAnalysis);

    return {
      contexts,
      relationships,
      insights
    };
  }

  /**
   * Validate provided bounded contexts against NLP analysis
   */
  async validateContexts(providedContexts: string[], nlpAnalysis: NLPAnalysis): Promise<BoundedContextMap> {
    // Create contexts from provided names
    const contexts = providedContexts.map(name => this.createContextFromName(name, nlpAnalysis));

    // Enhance contexts with NLP insights
    this.enhanceContextsWithNLP(contexts, nlpAnalysis);

    // Generate relationships
    const relationships = this.generateContextRelationships(contexts, nlpAnalysis);

    // Generate validation insights
    const insights = this.generateValidationInsights(contexts, nlpAnalysis);

    return {
      contexts,
      relationships,
      insights
    };
  }

  /**
   * Detect domain type from NLP analysis
   */
  private detectDomainType(nlpAnalysis: NLPAnalysis): string {
    const entities = nlpAnalysis.entities.map(e => e.toLowerCase());
    const processes = nlpAnalysis.processes.map(p => p.toLowerCase());
    const text = [...entities, ...processes].join(' ');

    // Check for domain-specific keywords
    const domainScores: Record<string, number> = {};

    Object.keys(this.domainPatterns).forEach(domain => {
      let score = 0;

      // Domain-specific keyword matching
      const keywords = this.getDomainKeywords(domain);
      keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });

      domainScores[domain] = score;
    });

    // Find highest scoring domain
    const topDomain = Object.entries(domainScores)
      .sort(([, a], [, b]) => b - a)[0];

    return topDomain && topDomain[1] > 0 ? topDomain[0] : 'generic';
  }

  /**
   * Generate contexts from NLP analysis
   */
  private async generateContextsFromAnalysis(nlpAnalysis: NLPAnalysis, domainType: string): Promise<BoundedContext[]> {
    const contexts: BoundedContext[] = [];

    // Strategy 1: Use domain patterns if detected
    if (domainType !== 'generic' && this.domainPatterns[domainType]) {
      const patternContexts = this.generateFromDomainPatterns(domainType, nlpAnalysis);
      contexts.push(...patternContexts);
    }

    // Strategy 2: Entity clustering
    const entityClusters = this.clusterEntitiesByDomain(nlpAnalysis.entities, nlpAnalysis.relationships);
    const clusterContexts = this.generateFromEntityClusters(entityClusters, nlpAnalysis);
    contexts.push(...clusterContexts);

    // Strategy 3: Process grouping
    const processGroups = this.groupProcessesByDomain(nlpAnalysis.processes, nlpAnalysis.entities);
    const processContexts = this.generateFromProcessGroups(processGroups, nlpAnalysis);
    contexts.push(...processContexts);

    // Merge and deduplicate contexts
    const mergedContexts = this.mergeAndDeduplicateContexts(contexts);

    // Ensure we have at least one context
    if (mergedContexts.length === 0) {
      mergedContexts.push(this.createDefaultContext(nlpAnalysis));
    }

    // Classify context types (core, supporting, generic)
    this.classifyContextTypes(mergedContexts, nlpAnalysis);

    return mergedContexts.slice(0, 8); // Limit to prevent overwhelming output
  }

  /**
   * Generate contexts from domain patterns
   */
  private generateFromDomainPatterns(domainType: string, nlpAnalysis: NLPAnalysis): BoundedContext[] {
    const patterns = this.domainPatterns[domainType];
    const contexts: BoundedContext[] = [];

    patterns?.forEach(pattern => {
      const context = this.createContextFromPattern(pattern, nlpAnalysis);
      if (context.entities.length > 0 || context.processes.length > 0) {
        contexts.push(context);
      }
    });

    return contexts;
  }

  /**
   * Cluster entities by domain relationships
   */
  private clusterEntitiesByDomain(entities: string[], relationships: any[]): string[][] {
    const clusters: string[][] = [];
    const used = new Set<string>();

    // Business domain clustering keywords
    const clusterKeywords: Record<string, string[]> = {
      'customer': ['customer', 'user', 'client', 'account', 'profile', 'contact'],
      'order': ['order', 'cart', 'item', 'product', 'inventory', 'catalog'],
      'payment': ['payment', 'invoice', 'billing', 'transaction', 'charge', 'refund'],
      'fulfillment': ['shipment', 'delivery', 'package', 'tracking', 'warehouse', 'logistics'],
      'content': ['document', 'file', 'media', 'content', 'resource', 'asset'],
      'communication': ['message', 'notification', 'email', 'sms', 'alert', 'communication'],
      'analytics': ['report', 'analytics', 'metric', 'dashboard', 'insight', 'statistic']
    };

    // Create clusters based on keywords
    Object.entries(clusterKeywords).forEach(([clusterName, keywords]) => {
      const cluster = entities.filter(entity => {
        const lowerEntity = entity.toLowerCase();
        return keywords.some(keyword => lowerEntity.includes(keyword)) && !used.has(entity);
      });

      if (cluster.length > 0) {
        cluster.forEach(entity => used.add(entity));
        clusters.push(cluster);
      }
    });

    // Add remaining entities to misc cluster
    const remaining = entities.filter(entity => !used.has(entity));
    if (remaining.length > 0) {
      clusters.push(remaining);
    }

    return clusters.filter(cluster => cluster.length > 0);
  }

  /**
   * Group processes by domain area
   */
  private groupProcessesByDomain(processes: string[], entities: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {
      'management': [],
      'processing': [],
      'communication': [],
      'analytics': [],
      'security': [],
      'general': []
    };

    processes.forEach(process => {
      const lowerProcess = process.toLowerCase();

      if (lowerProcess.includes('manage') || lowerProcess.includes('admin') || lowerProcess.includes('configure')) {
        groups?.['management']?.push(process);
      } else if (lowerProcess.includes('process') || lowerProcess.includes('execute') || lowerProcess.includes('perform')) {
        groups?.['processing']?.push(process);
      } else if (lowerProcess.includes('send') || lowerProcess.includes('notify') || lowerProcess.includes('communicate')) {
        groups?.['communication']?.push(process);
      } else if (lowerProcess.includes('analyze') || lowerProcess.includes('report') || lowerProcess.includes('calculate')) {
        groups?.['analytics']?.push(process);
      } else if (lowerProcess.includes('authenticate') || lowerProcess.includes('authorize') || lowerProcess.includes('secure')) {
        groups?.['security']?.push(process);
      } else {
        groups?.['general']?.push(process);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key as keyof typeof groups]?.length === 0) {
        delete groups[key as keyof typeof groups];
      }
    });

    return groups;
  }

  /**
   * Generate contexts from entity clusters
   */
  private generateFromEntityClusters(clusters: string[][], nlpAnalysis: NLPAnalysis): BoundedContext[] {
    return clusters.map((cluster, index) => {
      const contextName = this.generateContextNameFromEntities(cluster);
      return this.createContextFromEntities(contextName, cluster, nlpAnalysis);
    });
  }

  /**
   * Generate contexts from process groups
   */
  private generateFromProcessGroups(groups: Record<string, string[]>, nlpAnalysis: NLPAnalysis): BoundedContext[] {
    return Object.entries(groups).map(([groupName, processes]) => {
      const contextName = this.capitalizeWords(groupName);
      return this.createContextFromProcesses(contextName, processes, nlpAnalysis);
    });
  }

  /**
   * Create context from pattern
   */
  private createContextFromPattern(pattern: string, nlpAnalysis: NLPAnalysis): BoundedContext {
    const patternKeywords = pattern.toLowerCase().split(' ');

    // Find related entities
    const relatedEntities = nlpAnalysis.entities.filter(entity =>
      patternKeywords.some(keyword => entity.toLowerCase().includes(keyword))
    );

    // Find related processes
    const relatedProcesses = nlpAnalysis.processes.filter(process =>
      patternKeywords.some(keyword => process.toLowerCase().includes(keyword))
    );

    // Find related events
    const relatedEvents = nlpAnalysis.events.filter(event =>
      patternKeywords.some(keyword => event.toLowerCase().includes(keyword))
    );

    return {
      name: pattern,
      description: `Handles ${pattern.toLowerCase()} responsibilities within the domain`,
      entities: relatedEntities,
      processes: relatedProcesses,
      events: relatedEvents,
      responsibilities: this.generateResponsibilities(pattern, relatedEntities, relatedProcesses),
      type: 'core',
      complexity: this.calculateContextComplexity(relatedEntities, relatedProcesses, relatedEvents)
    };
  }

  /**
   * Create context from entities
   */
  private createContextFromEntities(name: string, entities: string[], nlpAnalysis: NLPAnalysis): BoundedContext {
    // Find related processes and events
    const relatedProcesses = nlpAnalysis.processes.filter(process =>
      entities.some(entity => process.toLowerCase().includes(entity.toLowerCase()))
    );

    const relatedEvents = nlpAnalysis.events.filter(event =>
      entities.some(entity => event.toLowerCase().includes(entity.toLowerCase()))
    );

    return {
      name,
      description: `Manages ${entities.join(', ').toLowerCase()} domain concepts`,
      entities,
      processes: relatedProcesses,
      events: relatedEvents,
      responsibilities: this.generateResponsibilities(name, entities, relatedProcesses),
      type: 'supporting',
      complexity: this.calculateContextComplexity(entities, relatedProcesses, relatedEvents)
    };
  }

  /**
   * Create context from processes
   */
  private createContextFromProcesses(name: string, processes: string[], nlpAnalysis: NLPAnalysis): BoundedContext {
    // Find related entities and events
    const relatedEntities = nlpAnalysis.entities.filter(entity =>
      processes.some(process => process.toLowerCase().includes(entity.toLowerCase()))
    );

    const relatedEvents = nlpAnalysis.events.filter(event =>
      processes.some(process => event.toLowerCase().includes(process.toLowerCase()))
    );

    return {
      name,
      description: `Handles ${processes.join(', ').toLowerCase()} operations`,
      entities: relatedEntities,
      processes,
      events: relatedEvents,
      responsibilities: this.generateResponsibilities(name, relatedEntities, processes),
      type: 'supporting',
      complexity: this.calculateContextComplexity(relatedEntities, processes, relatedEvents)
    };
  }

  /**
   * Merge and deduplicate similar contexts
   */
  private mergeAndDeduplicateContexts(contexts: BoundedContext[]): BoundedContext[] {
    const merged: BoundedContext[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < contexts.length; i++) {
      if (processed.has(i)) continue;

      const current = contexts[i];
      if (!current) continue;

      const similar: BoundedContext[] = [current];

      // Find similar contexts
      for (let j = i + 1; j < contexts.length; j++) {
        if (processed.has(j)) continue;

        const candidate = contexts[j];
        if (candidate && this.areContextsSimilar(current, candidate)) {
          similar.push(candidate);
          processed.add(j);
        }
      }

      // Merge similar contexts
      const mergedContext = this.mergeContexts(similar);
      merged.push(mergedContext);
      processed.add(i);
    }

    return merged;
  }

  /**
   * Check if two contexts are similar enough to merge
   */
  private areContextsSimilar(context1: BoundedContext, context2: BoundedContext): boolean {
    // Check name similarity
    const name1Words = context1.name.toLowerCase().split(/\s+/);
    const name2Words = context2.name.toLowerCase().split(/\s+/);
    const nameOverlap = name1Words.filter(word => name2Words.includes(word)).length;

    if (nameOverlap > 0) return true;

    // Check entity overlap
    const entityOverlap = context1.entities.filter(entity =>
      context2.entities.includes(entity)
    ).length;

    const maxEntities = Math.max(context1.entities.length, context2.entities.length);
    if (maxEntities > 0 && entityOverlap / maxEntities > 0.5) return true;

    return false;
  }

  /**
   * Merge multiple contexts into one
   */
  private mergeContexts(contexts: BoundedContext[]): BoundedContext {
    if (contexts.length === 1) {
      const first = contexts[0];
      if (!first) throw new Error('No contexts to merge');
      return first;
    }

    const merged = contexts[0];
    if (!merged) throw new Error('No contexts to merge');

    for (let i = 1; i < contexts.length; i++) {
      const context = contexts[i];
      if (!context) continue;

      // Merge entities
      context.entities.forEach(entity => {
        if (!merged.entities.includes(entity)) {
          merged.entities.push(entity);
        }
      });

      // Merge processes
      context.processes.forEach(process => {
        if (!merged.processes.includes(process)) {
          merged.processes.push(process);
        }
      });

      // Merge events
      context.events.forEach(event => {
        if (!merged.events.includes(event)) {
          merged.events.push(event);
        }
      });

      // Merge responsibilities
      context.responsibilities.forEach(resp => {
        if (!merged.responsibilities.includes(resp)) {
          merged.responsibilities.push(resp);
        }
      });
    }

    // Recalculate complexity
    merged.complexity = this.calculateContextComplexity(
      merged.entities,
      merged.processes,
      merged.events
    );

    return merged;
  }

  /**
   * Generate context relationships
   */
  private generateContextRelationships(contexts: BoundedContext[], nlpAnalysis: NLPAnalysis): ContextRelationship[] {
    const relationships: ContextRelationship[] = [];

    // Generate relationships based on entity dependencies and process flows
    for (let i = 0; i < contexts.length; i++) {
      for (let j = i + 1; j < contexts.length; j++) {
        const context1 = contexts[i];
        const context2 = contexts[j];

        if (context1 && context2) {
          const relationship = this.analyzeContextRelationship(context1, context2, nlpAnalysis);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Analyze relationship between two contexts
   */
  private analyzeContextRelationship(
    context1: BoundedContext,
    context2: BoundedContext,
    nlpAnalysis: NLPAnalysis
  ): ContextRelationship | null {
    // Check for shared entities or dependencies
    const sharedEntities = context1.entities.filter(entity =>
      context2.entities.includes(entity)
    );

    const hasProcessDependency = context1.processes.some(process =>
      context2.entities.some(entity =>
        process.toLowerCase().includes(entity.toLowerCase())
      )
    );

    const hasEventFlow = context1.events.some(event =>
      context2.processes.some(process =>
        event.toLowerCase().includes(process.toLowerCase())
      )
    );

    if (sharedEntities.length > 0) {
      return {
        upstream: context1.name,
        downstream: context2.name,
        type: 'shared-kernel',
        description: `Share common entities: ${sharedEntities.join(', ')}`,
        integration: 'synchronous'
      };
    }

    if (hasProcessDependency) {
      return {
        upstream: context2.name,
        downstream: context1.name,
        type: 'customer-supplier',
        description: `${context1.name} depends on ${context2.name} entities`,
        integration: 'synchronous'
      };
    }

    if (hasEventFlow) {
      return {
        upstream: context1.name,
        downstream: context2.name,
        type: 'customer-supplier',
        description: `Event-driven communication from ${context1.name} to ${context2.name}`,
        integration: 'event-driven'
      };
    }

    return null;
  }

  /**
   * Generate context insights and recommendations
   */
  private generateContextInsights(
    contexts: BoundedContext[],
    relationships: ContextRelationship[],
    nlpAnalysis: NLPAnalysis
  ): ContextInsight[] {
    const insights: ContextInsight[] = [];

    // Analyze context sizes
    contexts.forEach(context => {
      if (context.entities.length > 8) {
        insights.push({
          type: 'warning',
          title: 'Large Context Detected',
          description: `${context.name} has ${context.entities.length} entities. Consider splitting into smaller contexts.`,
          contexts: [context.name],
          impact: 'medium'
        });
      }

      if (context.complexity > 0.8) {
        insights.push({
          type: 'suggestion',
          title: 'High Complexity Context',
          description: `${context.name} is highly complex. Consider advanced patterns like CQRS or Event Sourcing.`,
          contexts: [context.name],
          impact: 'high'
        });
      }
    });

    // Analyze relationships
    const sharedKernels = relationships.filter(r => r.type === 'shared-kernel');
    if (sharedKernels.length > 2) {
      insights.push({
        type: 'warning',
        title: 'Too Many Shared Kernels',
        description: 'Multiple shared kernels detected. This can lead to tight coupling.',
        contexts: sharedKernels.flatMap(r => [r.upstream, r.downstream]),
        impact: 'high'
      });
    }

    // Domain modeling opportunities
    if (contexts.length === 1) {
      insights.push({
        type: 'suggestion',
        title: 'Single Context Domain',
        description: 'Consider if this domain would benefit from multiple bounded contexts.',
        contexts: contexts.map(c => c.name),
        impact: 'low'
      });
    }

    if (nlpAnalysis.complexity > 0.7 && contexts.length < 3) {
      insights.push({
        type: 'opportunity',
        title: 'Potential for More Contexts',
        description: 'High domain complexity suggests more bounded contexts might be beneficial.',
        contexts: contexts.map(c => c.name),
        impact: 'medium'
      });
    }

    return insights;
  }

  /**
   * Helper methods
   */
  private getDomainKeywords(domain: string): string[] {
    const keywords: Record<string, string[]> = {
      'e-commerce': ['order', 'product', 'customer', 'payment', 'cart', 'checkout', 'inventory'],
      'banking': ['account', 'transaction', 'payment', 'loan', 'credit', 'debit', 'balance'],
      'healthcare': ['patient', 'doctor', 'appointment', 'treatment', 'diagnosis', 'prescription'],
      'education': ['student', 'teacher', 'course', 'lesson', 'grade', 'exam', 'assignment'],
      'logistics': ['package', 'delivery', 'shipping', 'warehouse', 'tracking', 'route'],
      'insurance': ['policy', 'claim', 'premium', 'coverage', 'risk', 'underwriting']
    };

    return keywords[domain] || [];
  }

  private createContextFromName(name: string, nlpAnalysis: NLPAnalysis): BoundedContext {
    const nameWords = name.toLowerCase().split(/\s+/);

    // Find related entities, processes, and events
    const relatedEntities = nlpAnalysis.entities.filter(entity =>
      nameWords.some(word => entity.toLowerCase().includes(word))
    );

    const relatedProcesses = nlpAnalysis.processes.filter(process =>
      nameWords.some(word => process.toLowerCase().includes(word))
    );

    const relatedEvents = nlpAnalysis.events.filter(event =>
      nameWords.some(word => event.toLowerCase().includes(word))
    );

    return {
      name,
      description: `Handles ${name.toLowerCase()} responsibilities`,
      entities: relatedEntities,
      processes: relatedProcesses,
      events: relatedEvents,
      responsibilities: this.generateResponsibilities(name, relatedEntities, relatedProcesses),
      type: 'core',
      complexity: this.calculateContextComplexity(relatedEntities, relatedProcesses, relatedEvents)
    };
  }

  private enhanceContextsWithNLP(contexts: BoundedContext[], nlpAnalysis: NLPAnalysis): void {
    contexts.forEach(context => {
      // Add missing entities that match the context
      const contextKeywords = context.name.toLowerCase().split(/\s+/);

      nlpAnalysis.entities.forEach(entity => {
        if (!context.entities.includes(entity) &&
            contextKeywords.some(keyword => entity.toLowerCase().includes(keyword))) {
          context.entities.push(entity);
        }
      });

      // Add missing processes
      nlpAnalysis.processes.forEach(process => {
        if (!context.processes.includes(process) &&
            contextKeywords.some(keyword => process.toLowerCase().includes(keyword))) {
          context.processes.push(process);
        }
      });

      // Recalculate complexity
      context.complexity = this.calculateContextComplexity(
        context.entities,
        context.processes,
        context.events
      );
    });
  }

  private generateValidationInsights(contexts: BoundedContext[], nlpAnalysis: NLPAnalysis): ContextInsight[] {
    const insights: ContextInsight[] = [];

    // Check if all entities are covered
    const coveredEntities = new Set<string>();
    contexts.forEach(context => {
      context.entities.forEach(entity => coveredEntities.add(entity));
    });

    const uncoveredEntities = nlpAnalysis.entities.filter(entity => !coveredEntities.has(entity));
    if (uncoveredEntities.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Uncovered Entities',
        description: `Some entities are not assigned to any context: ${uncoveredEntities.join(', ')}`,
        contexts: [],
        impact: 'medium'
      });
    }

    return insights;
  }

  private createDefaultContext(nlpAnalysis: NLPAnalysis): BoundedContext {
    return {
      name: 'Core Domain',
      description: 'Main domain context containing core business logic',
      entities: nlpAnalysis.entities.slice(0, 8),
      processes: nlpAnalysis.processes.slice(0, 6),
      events: nlpAnalysis.events.slice(0, 10),
      responsibilities: ['Core business logic', 'Domain rule enforcement', 'State management'],
      type: 'core',
      complexity: nlpAnalysis.complexity
    };
  }

  private classifyContextTypes(contexts: BoundedContext[], nlpAnalysis: NLPAnalysis): void {
    // Classify based on complexity and business importance
    contexts.forEach(context => {
      if (context.complexity > 0.7 || context.entities.length > 6) {
        context.type = 'core';
      } else if (context.complexity > 0.4 || context.entities.length > 3) {
        context.type = 'supporting';
      } else {
        context.type = 'generic';
      }
    });

    // Ensure at least one core context
    const hasCoreContext = contexts.some(context => context.type === 'core');
    if (!hasCoreContext && contexts.length > 0) {
      const firstContext = contexts[0];
      if (firstContext) {
        firstContext.type = 'core';
      }
    }
  }

  private generateContextNameFromEntities(entities: string[]): string {
    if (entities.length === 0) return 'Context';

    // Find common theme
    const themes = [
      { keywords: ['customer', 'user', 'account'], name: 'Customer Management' },
      { keywords: ['order', 'cart', 'item'], name: 'Order Management' },
      { keywords: ['payment', 'billing', 'invoice'], name: 'Payment Processing' },
      { keywords: ['product', 'inventory', 'catalog'], name: 'Product Management' },
      { keywords: ['shipment', 'delivery', 'package'], name: 'Fulfillment' }
    ];

    for (const theme of themes) {
      if (entities.some(entity =>
        theme.keywords.some(keyword => entity.toLowerCase().includes(keyword))
      )) {
        return theme.name;
      }
    }

    // Default naming
    return `${entities[0]} Management`;
  }

  private generateResponsibilities(name: string, entities: string[], processes: string[]): string[] {
    const responsibilities: string[] = [];

    // Add entity-based responsibilities
    if (entities.length > 0) {
      responsibilities.push(`Manage ${entities.join(', ').toLowerCase()} lifecycle`);
      const primaryEntity = entities[0];
      if (primaryEntity) {
        responsibilities.push(`Enforce business rules for ${primaryEntity.toLowerCase()}`);
      }
    }

    // Add process-based responsibilities
    if (processes.length > 0) {
      responsibilities.push(`Handle ${processes.join(', ').toLowerCase()} operations`);
    }

    // Add default responsibilities
    responsibilities.push('Maintain data consistency');
    responsibilities.push('Provide domain services');

    return responsibilities.slice(0, 5);
  }

  private calculateContextComplexity(entities: string[], processes: string[], events: string[]): number {
    const entityWeight = entities.length * 0.1;
    const processWeight = processes.length * 0.08;
    const eventWeight = events.length * 0.05;

    return Math.min(entityWeight + processWeight + eventWeight, 1.0);
  }

  private capitalizeWords(str: string): string {
    return str.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
}
