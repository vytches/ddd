/**
 * DX-005: Discovery Engine
 *
 * Core engine for AI-powered discovery of DDD patterns and APIs
 * Leverages Enhanced Metadata System V2 and RepomixIntegration
 */

import { SmartTagFinder } from '../core/smart-tag-finder';
import { Colors } from '../core/utils/colors';
import { MultiLevelCache } from '../examples-engine/cache/multi-level-cache';
import { RepomixIntegration } from '../utils/repomix-integration';
import type { QueryIntent } from './intent-classifier';
import { IntentClassifier, IntentType } from './intent-classifier';

export interface DiscoveryOptions {
  framework?: string | undefined;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  format: 'quick' | 'guided' | 'detailed';
  validate: boolean;
}

export interface DiscoveryResult {
  query: string;
  packages: PackageRecommendation[];
  imports?: string;
  steps?: ImplementationStep[];
  learningPath?: LearningPath;
  relatedQueries?: string[];
  confidence: number;
}

export interface PackageRecommendation {
  name: string;
  description: string;
  quickStart?: string;
  priority: number;
  reason: string;
  examples?: string[];
}

export interface ImplementationStep {
  title: string;
  description: string;
  estimatedTime: string;
  code?: string;
  notes?: string[];
}

export interface LearningPath {
  estimatedTime: string;
  target: string;
  concepts: string[];
  prerequisites?: string[];
  nextTopics?: string[];
}

export class DiscoveryEngine {
  private smartTagFinder: SmartTagFinder;
  private cache: typeof MultiLevelCache;
  private keywordPatterns: Map<string, string[]>;
  private packageMappings: Map<string, PackageInfo>;
  private intentClassifier: IntentClassifier;

  constructor() {
    this.smartTagFinder = new SmartTagFinder();
    this.cache = MultiLevelCache; // Use static class
    this.keywordPatterns = new Map();
    this.packageMappings = new Map();
    this.intentClassifier = new IntentClassifier();
    this.initializePatterns();
    this.initializePackageMappings();
  }

  async discover(query: string, options: DiscoveryOptions): Promise<DiscoveryResult> {
    console.log(Colors.dim(`🔍 Processing query: "${query}"`));

    // Check cache first
    const cacheKey = this.generateCacheKey(query, options);
    const cached = await MultiLevelCache.get(cacheKey);
    if (cached) {
      console.log(Colors.dim('⚡ Using cached result'));
      return JSON.parse(cached);
    }

    // Phase 1: Intent Classification - AI-powered query understanding
    const intent = this.intentClassifier.classifyQuery(query);
    console.log(
      Colors.dim(`🎯 Intent: ${intent.type} (confidence: ${Math.round(intent.confidence * 100)}%)`)
    );

    // Merge intent-detected framework with options
    const enhancedOptions = {
      ...options,
      framework: options.framework || intent.framework,
      complexity: options.complexity || intent.complexity || 'intermediate',
    };

    // Phase 2: Enhanced keyword extraction and pattern matching
    const keywords = this.extractKeywords(query, intent);
    const patterns = this.identifyPatterns(keywords, intent);
    const packages = this.recommendPackages(patterns, enhancedOptions, intent);

    // Build result based on format
    const result: DiscoveryResult = {
      query,
      packages,
      confidence: this.calculateConfidence(keywords, patterns, intent),
      relatedQueries: this.generateRelatedQueries(patterns, intent),
    };

    // Add format-specific content based on intent and options
    switch (enhancedOptions.format) {
      case 'quick':
        result.imports = this.generateQuickImports(packages, intent);
        break;
      case 'guided':
        result.steps = await this.generateImplementationSteps(
          patterns,
          packages,
          enhancedOptions,
          intent
        );
        break;
      case 'detailed':
        result.learningPath = this.generateLearningPath(patterns, enhancedOptions, intent);
        result.steps = await this.generateImplementationSteps(
          patterns,
          packages,
          enhancedOptions,
          intent
        );
        break;
    }

    // Validate against actual codebase if requested
    if (options.validate) {
      await this.validateRecommendations(result);
    }

    // Cache result
    await MultiLevelCache.set(cacheKey, JSON.stringify(result));

    return result;
  }

  private extractKeywords(query: string, intent?: QueryIntent): string[] {
    const normalized = query.toLowerCase();
    const keywords = [];

    // Extract explicit keywords
    const words = normalized.split(/\s+/);
    keywords.push(...words);

    // Add intent-detected patterns
    if (intent?.patterns) {
      keywords.push(...intent.patterns);
    }

    // Pattern-based keyword extraction
    for (const [pattern, tags] of this.keywordPatterns.entries()) {
      if (normalized.includes(pattern)) {
        keywords.push(...tags);
      }
    }

    // Intent-specific keyword enhancement
    if (intent) {
      switch (intent.type) {
        case IntentType.HOW_TO:
          keywords.push('tutorial', 'guide', 'implementation');
          break;
        case IntentType.INTEGRATION:
          keywords.push('setup', 'configure', 'framework');
          if (intent.framework) keywords.push(intent.framework);
          break;
        case IntentType.TROUBLESHOOTING:
          keywords.push('debug', 'fix', 'error', 'problem');
          break;
        case IntentType.BEST_PRACTICES:
          keywords.push('patterns', 'recommendations', 'enterprise');
          break;
      }
    }

    return [...new Set(keywords)];
  }

  private identifyPatterns(keywords: string[], intent?: QueryIntent): string[] {
    const patterns = new Set<string>();

    // Direct pattern matching
    const patternKeywords = {
      aggregate: ['aggregate', 'aggregates', 'entity', 'entities', 'domain', 'model', 'root'],
      events: ['event', 'events', 'publish', 'subscribe', 'messaging', 'async', 'driven'],
      cqrs: ['command', 'commands', 'query', 'queries', 'cqrs', 'handler', 'handlers', 'bus'],
      validation: [
        'validate',
        'validation',
        'rule',
        'rules',
        'policy',
        'policies',
        'business',
        'constraint',
      ],
      repository: ['persist', 'store', 'save', 'database', 'repository', 'repositories'],
      di: [
        'inject',
        'injection',
        'dependency',
        'dependencies',
        'container',
        'service',
        'services',
        'registration',
      ],
      resilience: ['retry', 'circuit', 'timeout', 'fallback', 'resilience', 'resilient'],
      nestjs: ['nestjs', 'nest', 'module', 'modules', 'injectable', 'decorator', 'decorators'],
    };

    for (const [pattern, patternWords] of Object.entries(patternKeywords)) {
      if (keywords.some(keyword => patternWords.includes(keyword))) {
        patterns.add(pattern);
      }
    }

    // Intent-driven pattern enhancement
    if (intent) {
      switch (intent.type) {
        case IntentType.PATTERN_DISCOVERY:
          // Boost DDD core patterns
          if (keywords.some(k => ['ddd', 'domain', 'model'].includes(k))) {
            patterns.add('aggregate');
          }
          break;
        case IntentType.INTEGRATION:
          // Add framework integration patterns
          if (intent.framework) {
            patterns.add(intent.framework);
          }
          patterns.add('di'); // DI often needed for integration
          break;
        case IntentType.IMPLEMENTATION:
          // For "I need" queries, recommend core building blocks
          patterns.add('aggregate');
          patterns.add('validation');
          break;
        case IntentType.TROUBLESHOOTING:
          // Add debugging and resilience patterns
          patterns.add('resilience');
          patterns.add('validation');
          break;
      }
    }

    // Composite pattern detection
    if (patterns.has('aggregate') && patterns.has('events')) {
      patterns.add('event-sourcing');
    }

    if (patterns.has('cqrs') && patterns.has('events')) {
      patterns.add('event-driven-architecture');
    }

    return Array.from(patterns);
  }

  private recommendPackages(
    patterns: string[],
    options: DiscoveryOptions,
    intent?: QueryIntent
  ): PackageRecommendation[] {
    const recommendations = [];

    for (const pattern of patterns) {
      const packageInfo = this.packageMappings.get(pattern);
      if (packageInfo) {
        recommendations.push({
          name: packageInfo.name,
          description: packageInfo.description,
          quickStart: packageInfo.quickStart,
          priority: this.calculatePriority(pattern, options, intent),
          reason: this.generateRecommendationReason(pattern, intent),
          examples: packageInfo.examples,
        });
      }
    }

    // Sort by priority and complexity, adjust count based on intent
    const maxRecommendations = this.getMaxRecommendations(intent);
    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, maxRecommendations);
  }

  private calculatePriority(
    pattern: string,
    options: DiscoveryOptions,
    intent?: QueryIntent
  ): number {
    const basePriorities: Record<string, number> = {
      aggregate: 100,
      events: 90,
      cqrs: 85,
      validation: 80,
      repository: 75,
      di: 70,
      resilience: 65,
      nestjs: 60,
    };

    let priority = basePriorities[pattern] || 50;

    // Adjust for complexity
    if (options.complexity === 'beginner') {
      if (['aggregate', 'validation'].includes(pattern)) priority += 10;
      if (['resilience', 'di'].includes(pattern)) priority -= 20;
    }

    // Adjust for framework
    if (options.framework === 'nestjs' && pattern === 'nestjs') {
      priority += 30;
    }

    // Intent-based priority adjustments
    if (intent) {
      switch (intent.type) {
        case IntentType.HOW_TO:
          // Boost foundational patterns for learning
          if (['aggregate', 'validation'].includes(pattern)) priority += 15;
          break;
        case IntentType.INTEGRATION:
          // Boost framework and DI patterns
          if (['di', 'nestjs'].includes(pattern)) priority += 25;
          break;
        case IntentType.TROUBLESHOOTING:
          // Boost debugging and resilience patterns
          if (['resilience', 'validation'].includes(pattern)) priority += 20;
          break;
        case IntentType.BEST_PRACTICES:
          // Boost enterprise patterns
          if (['events', 'cqrs', 'validation'].includes(pattern)) priority += 10;
          break;
        case IntentType.IMPLEMENTATION:
          // Boost practical building blocks
          if (['aggregate', 'repository', 'validation'].includes(pattern)) priority += 15;
          break;
      }

      // Context-based adjustments
      if (intent.context?.urgency === 'high') {
        // Boost quick-start patterns for urgent requests
        if (['aggregate', 'validation'].includes(pattern)) priority += 10;
      }
    }

    return priority;
  }

  private generateQuickImports(packages: PackageRecommendation[], intent?: QueryIntent): string {
    if (packages.length === 0) return '';

    const maxPackages = intent?.type === IntentType.HOW_TO ? 2 : 3; // Fewer for learning
    const imports = packages
      .slice(0, maxPackages)
      .map(pkg => `npm install ${pkg.name}`)
      .join('\n');

    // Add intent-specific quick start advice
    let advice = '';
    if (intent) {
      switch (intent.type) {
        case IntentType.HOW_TO:
          advice = '\n# Start with these core packages for learning';
          break;
        case IntentType.INTEGRATION:
          advice = '\n# Essential packages for framework integration';
          break;
        case IntentType.TROUBLESHOOTING:
          advice = '\n# Packages that can help diagnose and fix issues';
          break;
      }
    }

    return `${advice}\n${imports}\n`;
  }

  private async generateImplementationSteps(
    patterns: string[],
    packages: PackageRecommendation[],
    options: DiscoveryOptions,
    intent?: QueryIntent
  ): Promise<ImplementationStep[]> {
    const steps = [];

    // Intent-driven step generation order
    const stepOrder = this.getStepOrder(intent, patterns);

    for (const pattern of stepOrder) {
      if (!patterns.includes(pattern)) continue;

      switch (pattern) {
        case 'aggregate':
          steps.push({
            title: 'Create Entity ID',
            description: this.getStepDescription('entity-id', intent),
            estimatedTime: intent?.context?.urgency === 'high' ? '1 minute' : '2 minutes',
            code: `import { EntityId } from '@vytches/ddd-value-objects';\n\nconst userId = EntityId.createWithRandomUUID();`,
            notes: ['EntityId provides type safety', 'Use factory methods, not constructor'],
          });

          steps.push({
            title: 'Create Aggregate Root',
            description: this.getStepDescription('aggregate-root', intent),
            estimatedTime: intent?.context?.urgency === 'high' ? '3 minutes' : '5 minutes',
            code: `import { AggregateRoot } from '@vytches/ddd-aggregates';\nimport { EntityId } from '@vytches/ddd-value-objects';\n\nclass User extends AggregateRoot {\n  constructor(id: EntityId, private email: string) {\n    super({ id, version: 0 });\n  }\n}`,
          });
          break;

        case 'events':
          steps.push({
            title: 'Add Domain Events',
            description: this.getStepDescription('domain-events', intent),
            estimatedTime: '3 minutes',
            code: `user.addDomainEvent({\n  eventType: 'UserCreated',\n  payload: { userId: id.getValue(), email },\n  timestamp: new Date()\n});`,
          });
          break;

        case 'nestjs':
          if (options.framework === 'nestjs') {
            steps.push({
              title: 'NestJS Integration',
              description: this.getStepDescription('nestjs-integration', intent),
              estimatedTime: '5 minutes',
              code: `import { VytchesDDDModule } from '@vytches/ddd-nestjs';\n\n@Module({\n  imports: [VytchesDDDModule.forRoot({ autoDiscovery: true })]\n})\nexport class AppModule {}`,
            });
          }
          break;

        case 'validation':
          if (
            intent?.type === IntentType.TROUBLESHOOTING ||
            intent?.type === IntentType.IMPLEMENTATION
          ) {
            steps.push({
              title: 'Add Validation',
              description: this.getStepDescription('validation', intent),
              estimatedTime: '4 minutes',
              code: `import { PolicyBuilder } from '@vytches/ddd-policies';\n\nconst userPolicy = PolicyBuilder.create<User>()\n  .withId('user-validation')\n  .must(new EmailSpecification())\n  .build();`,
            });
          }
          break;
      }
    }

    return steps.slice(0, this.getMaxSteps(intent));
  }

  private generateLearningPath(
    patterns: string[],
    options: DiscoveryOptions,
    intent?: QueryIntent
  ): LearningPath {
    const estimatedTimes = {
      beginner: '15-30 minutes',
      intermediate: '30-60 minutes',
      advanced: '1-2 hours',
    };

    const concepts = [];
    if (patterns.includes('aggregate')) concepts.push('Domain Aggregates', 'Entity Identity');
    if (patterns.includes('events')) concepts.push('Domain Events', 'Event Publishing');
    if (patterns.includes('cqrs')) concepts.push('Command Query Separation', 'Handler Patterns');
    if (patterns.includes('validation')) concepts.push('Business Rules', 'Specification Pattern');

    // Intent-specific concept enhancement
    if (intent) {
      switch (intent.type) {
        case IntentType.INTEGRATION:
          concepts.unshift('Framework Integration', 'Dependency Injection');
          break;
        case IntentType.TROUBLESHOOTING:
          concepts.push('Error Handling', 'Debugging Patterns');
          break;
        case IntentType.BEST_PRACTICES:
          concepts.push('Enterprise Patterns', 'Architectural Guidelines');
          break;
      }
    }

    // Adjust time based on urgency
    let estimatedTime = estimatedTimes[options.complexity];
    if (intent?.context?.urgency === 'high') {
      estimatedTime = estimatedTime.replace(/\d+/g, match =>
        Math.ceil(parseInt(match) * 0.7).toString()
      );
    }

    return {
      estimatedTime,
      target: this.generateLearningTarget(patterns, options, intent),
      concepts,
      prerequisites: this.generatePrerequisites(options, intent),
      nextTopics: this.generateNextTopics(patterns, intent),
    };
  }

  private generateRelatedQueries(patterns: string[], intent?: QueryIntent): string[] {
    const related = [];

    if (patterns.includes('aggregate')) {
      related.push('event sourcing with aggregates', 'aggregate lifecycle management');
    }
    if (patterns.includes('events')) {
      related.push('event store implementation', 'saga patterns');
    }
    if (patterns.includes('cqrs')) {
      related.push('query projections', 'command validation');
    }

    // Intent-specific related queries
    if (intent) {
      switch (intent.type) {
        case IntentType.HOW_TO:
          related.unshift('getting started with DDD', 'basic implementation guide');
          break;
        case IntentType.INTEGRATION:
          related.unshift(
            `${intent.framework || 'framework'} integration patterns`,
            'dependency injection setup'
          );
          break;
        case IntentType.TROUBLESHOOTING:
          related.unshift('common DDD pitfalls', 'debugging domain logic');
          break;
        case IntentType.BEST_PRACTICES:
          related.unshift('enterprise DDD patterns', 'architectural guidelines');
          break;
        case IntentType.COMPARISON:
          related.unshift('pattern comparison guide', 'choosing right patterns');
          break;
      }
    }

    return related.slice(0, 4); // Increased from 3 to 4 for intent-enhanced queries
  }

  private async validateRecommendations(result: DiscoveryResult): Promise<void> {
    try {
      console.log(Colors.dim('🔍 Validating against current codebase...'));

      const repomix = new RepomixIntegration();
      let totalValidationIssues = 0;

      for (const pkg of result.packages) {
        const packageName = pkg.name.replace('@vytches/ddd-', '');

        // Extract methods from code examples in steps
        const recommendedMethods = this.extractMethodsFromSteps(result.steps || []);

        if (recommendedMethods.length > 0) {
          console.log(
            Colors.dim(`  • Validating ${packageName}: ${recommendedMethods.join(', ')}`)
          );

          const validation = await repomix.validateRecommendations(
            packageName,
            recommendedMethods,
            {
              strictMode: false,
              maxSuggestions: 3,
            }
          );

          if (!validation.isValid) {
            totalValidationIssues += validation.issues.length;

            // Log validation issues
            for (const issue of validation.issues) {
              if (issue.severity === 'error') {
                console.log(Colors.dim(`    ⚠️  ${issue.type}: ${issue.message}`));
                if (issue.recommended) {
                  console.log(Colors.dim(`       → Try: ${issue.recommended}`));
                }
              }
            }

            // Update package description with validation notes
            if (validation.recommendedMethods.length > 0) {
              pkg.description += ` (Validated: ${validation.recommendedMethods.slice(0, 2).join(', ')})`;
            }
          } else {
            console.log(Colors.dim(`    ✅ ${packageName} validation passed`));
            pkg.description += ` (✓ Validated)`;
          }

          // Add confidence score based on validation
          result.confidence = Math.max(result.confidence - validation.issues.length * 0.1, 0.1);
        }
      }

      if (totalValidationIssues > 0) {
        console.log(Colors.dim(`⚠️  Found ${totalValidationIssues} validation issues`));
        console.log(Colors.dim('   Consider updating your approach based on recommendations'));
      } else {
        console.log(Colors.dim('✅ All recommendations validated successfully'));
      }
    } catch (error) {
      console.log(Colors.dim('⚠️  Validation skipped - repository analysis unavailable'));
      console.log(
        Colors.dim(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  private extractMethodsFromSteps(steps: ImplementationStep[]): string[] {
    const methods = new Set<string>();

    for (const step of steps) {
      if (step.code) {
        // Extract method calls from code examples
        const methodMatches = step.code.match(/\w+\.\w+\(/g);
        if (methodMatches) {
          methodMatches.forEach(match => {
            const method = match.replace('(', '');
            methods.add(method);
          });
        }

        // Extract class constructors and static methods
        const staticMatches = step.code.match(/\w+\.\w+(?=\(|\s|;)/g);
        if (staticMatches) {
          staticMatches.forEach(match => {
            if (!match.includes('console.') && !match.includes('Math.')) {
              methods.add(match);
            }
          });
        }
      }
    }

    return Array.from(methods);
  }

  private calculateConfidence(
    keywords: string[],
    patterns: string[],
    intent?: QueryIntent
  ): number {
    let baseConfidence = 0.5;

    // Pattern-based confidence
    if (patterns.length === 0) baseConfidence = 0.1;
    else if (patterns.length >= 3) baseConfidence = 0.9;
    else if (keywords.length >= 3) baseConfidence = 0.7;

    // Intent classification confidence boost
    if (intent && intent.confidence > 0.7) {
      baseConfidence = Math.min(baseConfidence + intent.confidence * 0.3, 1.0);
    }

    // Context-specific confidence adjustments
    if (intent?.context) {
      if (intent.context.experience === 'expert' && baseConfidence > 0.7) {
        baseConfidence = Math.min(baseConfidence + 0.1, 1.0);
      }
      if (intent.context.urgency === 'high' && patterns.length > 0) {
        baseConfidence = Math.min(baseConfidence + 0.05, 1.0);
      }
    }

    return Math.round(baseConfidence * 100) / 100; // Round to 2 decimal places
  }

  private generateCacheKey(query: string, options: DiscoveryOptions): string {
    return `discovery:${query}:${options.complexity}:${options.framework || 'none'}:${options.format}`;
  }

  private initializePatterns(): void {
    this.keywordPatterns = new Map([
      ['event driven', ['events', 'messaging', 'async']],
      ['event-driven', ['events', 'messaging', 'async']],
      ['event sourcing', ['events', 'aggregate', 'store']],
      ['event-sourcing', ['events', 'aggregate', 'store']],
      ['domain model', ['aggregate', 'entity', 'value-object']],
      ['domain-model', ['aggregate', 'entity', 'value-object']],
      ['business rules', ['validation', 'policy', 'specification']],
      ['business-rules', ['validation', 'policy', 'specification']],
      ['microservices', ['events', 'resilience', 'messaging']],
      ['cqrs', ['command', 'query', 'handler']],
      ['ddd', ['aggregate', 'entity', 'value-object', 'repository']],
      ['architecture', ['events', 'cqrs']], // "architecture" often refers to event-driven
    ]);
  }

  private initializePackageMappings(): void {
    this.packageMappings = new Map([
      [
        'aggregate',
        {
          name: '@vytches/ddd-aggregates',
          description: 'Domain aggregates with event sourcing capabilities',
          quickStart: 'npm install @vytches/ddd-aggregates',
          examples: ['aggregate-creation', 'event-handling'],
        },
      ],
      [
        'events',
        {
          name: '@vytches/ddd-events',
          description: 'Event-driven architecture with unified event bus',
          quickStart: 'npm install @vytches/ddd-events',
          examples: ['event-publishing', 'event-handlers'],
        },
      ],
      [
        'cqrs',
        {
          name: '@vytches/ddd-cqrs',
          description: 'Command Query Responsibility Segregation',
          quickStart: 'npm install @vytches/ddd-cqrs',
          examples: ['command-handlers', 'query-handlers'],
        },
      ],
      [
        'validation',
        {
          name: '@vytches/ddd-validation',
          description: 'Business rule validation and specifications',
          quickStart: 'npm install @vytches/ddd-validation',
          examples: ['business-rules', 'specifications'],
        },
      ],
      [
        'repository',
        {
          name: '@vytches/ddd-repositories',
          description: 'Repository pattern for domain persistence',
          quickStart: 'npm install @vytches/ddd-repositories',
          examples: ['repository-implementation', 'unit-of-work'],
        },
      ],
      [
        'di',
        {
          name: '@vytches/ddd-di',
          description: 'Dependency injection with auto-discovery',
          quickStart: 'npm install @vytches/ddd-di',
          examples: ['service-registration', 'auto-discovery'],
        },
      ],
      [
        'resilience',
        {
          name: '@vytches/ddd-resilience',
          description: 'Resilience patterns for robust applications',
          quickStart: 'npm install @vytches/ddd-resilience',
          examples: ['circuit-breaker', 'retry-patterns'],
        },
      ],
      [
        'nestjs',
        {
          name: '@vytches/ddd-nestjs',
          description: 'NestJS integration for VytchesDDD',
          quickStart: 'npm install @vytches/ddd-nestjs',
          examples: ['nestjs-setup', 'dependency-injection'],
        },
      ],
    ]);
  }

  // Intent-aware helper methods
  private generateRecommendationReason(pattern: string, intent?: QueryIntent): string {
    if (!intent) return `Matches pattern: ${pattern}`;

    switch (intent.type) {
      case IntentType.HOW_TO:
        return `Essential for learning ${pattern} patterns`;
      case IntentType.INTEGRATION:
        return `Required for ${intent.framework || 'framework'} integration with ${pattern}`;
      case IntentType.TROUBLESHOOTING:
        return `Helps diagnose and fix ${pattern} related issues`;
      case IntentType.BEST_PRACTICES:
        return `Enterprise-grade ${pattern} implementation`;
      case IntentType.IMPLEMENTATION:
        return `Core building block for ${pattern} implementation`;
      default:
        return `Matches pattern: ${pattern}`;
    }
  }

  private getMaxRecommendations(intent?: QueryIntent): number {
    if (!intent) return 5;

    switch (intent.type) {
      case IntentType.HOW_TO:
        return 3; // Fewer for learning
      case IntentType.TROUBLESHOOTING:
        return 4; // Focus on specific solutions
      case IntentType.INTEGRATION:
        return 6; // More for complex integrations
      default:
        return 5;
    }
  }

  private getStepOrder(intent?: QueryIntent, patterns: string[] = []): string[] {
    if (!intent) return patterns;

    const baseOrder = [
      'aggregate',
      'validation',
      'events',
      'cqrs',
      'repository',
      'di',
      'nestjs',
      'resilience',
    ];

    switch (intent.type) {
      case IntentType.HOW_TO:
        return ['aggregate', 'validation', 'events']; // Learning order
      case IntentType.INTEGRATION:
        return ['di', 'nestjs', 'aggregate', 'validation']; // Integration first
      case IntentType.TROUBLESHOOTING:
        return ['validation', 'resilience', 'aggregate']; // Debugging order
      default:
        return baseOrder;
    }
  }

  private getStepDescription(stepType: string, intent?: QueryIntent): string {
    const descriptions: Record<string, string> = {
      'entity-id': 'Start with strongly-typed identifiers for your domain entities',
      'aggregate-root': 'Build your domain aggregate with event capabilities',
      'domain-events': 'Implement event-driven patterns for loose coupling',
      'nestjs-integration': 'Configure VytchesDDD module for NestJS',
      validation: 'Add business rule validation with policies',
    };

    let description = descriptions[stepType] || 'Implementation step';

    if (intent?.type === IntentType.HOW_TO) {
      description = `Learn: ${description.toLowerCase()}`;
    } else if (intent?.type === IntentType.TROUBLESHOOTING) {
      description = `Fix: ${description.toLowerCase()}`;
    }

    return description;
  }

  private getMaxSteps(intent?: QueryIntent): number {
    if (!intent) return 5;

    switch (intent.type) {
      case IntentType.HOW_TO:
        return 3; // Fewer steps for learning
      case IntentType.INTEGRATION:
        return 6; // More steps for complex integration
      case IntentType.TROUBLESHOOTING:
        return 4; // Focused debugging steps
      default:
        return 5;
    }
  }

  private generateLearningTarget(
    patterns: string[],
    options: DiscoveryOptions,
    intent?: QueryIntent
  ): string {
    const baseTarget = `${options.complexity} level understanding of ${patterns.join(', ')}`;

    if (!intent) return baseTarget;

    switch (intent.type) {
      case IntentType.HOW_TO:
        return `Step-by-step guide to ${patterns.join(', ')} implementation`;
      case IntentType.INTEGRATION:
        return `${intent.framework || 'Framework'} integration with ${patterns.join(', ')}`;
      case IntentType.TROUBLESHOOTING:
        return `Debugging and fixing ${patterns.join(', ')} issues`;
      case IntentType.BEST_PRACTICES:
        return `Enterprise-grade ${patterns.join(', ')} patterns`;
      default:
        return baseTarget;
    }
  }

  private generatePrerequisites(options: DiscoveryOptions, intent?: QueryIntent): string[] {
    const base = options.complexity === 'beginner' ? ['Basic TypeScript'] : ['DDD fundamentals'];

    if (!intent) return base;

    switch (intent.type) {
      case IntentType.INTEGRATION:
        return [...base, `${intent.framework || 'Framework'} knowledge`];
      case IntentType.TROUBLESHOOTING:
        return [...base, 'Debugging skills', 'Problem diagnosis'];
      case IntentType.BEST_PRACTICES:
        return [...base, 'Enterprise architecture', 'Software patterns'];
      default:
        return base;
    }
  }

  private generateNextTopics(patterns: string[], intent?: QueryIntent): string[] {
    const base = patterns.includes('aggregate')
      ? ['Event Sourcing', 'CQRS']
      : ['Advanced Patterns'];

    if (!intent) return base;

    switch (intent.type) {
      case IntentType.HOW_TO:
        return ['Advanced implementation', 'Production deployment'];
      case IntentType.INTEGRATION:
        return ['Advanced framework features', 'Production configuration'];
      case IntentType.TROUBLESHOOTING:
        return ['Monitoring and observability', 'Performance optimization'];
      case IntentType.BEST_PRACTICES:
        return ['Architectural evolution', 'Scalability patterns'];
      default:
        return base;
    }
  }
}

interface PackageInfo {
  name: string;
  description: string;
  quickStart: string;
  examples: string[];
}
