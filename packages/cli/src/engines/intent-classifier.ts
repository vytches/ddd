/**
 * DX-005: Intent Classification Engine
 *
 * Classifies user queries into intent categories for better discovery
 */

export interface QueryIntent {
  type: IntentType;
  confidence: number;
  patterns: string[];
  framework?: string | undefined;
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  context?: IntentContext;
}

export enum IntentType {
  PATTERN_DISCOVERY = 'pattern-discovery', // "event sourcing", "CQRS"
  HOW_TO = 'how-to', // "How do I create aggregates?"
  INTEGRATION = 'integration', // "NestJS integration"
  LEARNING = 'learning', // "DDD fundamentals"
  TROUBLESHOOTING = 'troubleshooting', // "aggregate not working"
  COMPARISON = 'comparison', // "CQRS vs event sourcing"
  BEST_PRACTICES = 'best-practices', // "validation best practices"
  IMPLEMENTATION = 'implementation', // "I need event-driven app"
}

export interface IntentContext {
  urgency?: 'low' | 'medium' | 'high';
  experience?: 'beginner' | 'intermediate' | 'expert';
  projectPhase?: 'planning' | 'development' | 'refactoring';
  codebase?: 'new' | 'existing' | 'legacy';
}

export class IntentClassifier {
  private intentPatterns: Map<IntentType, IntentPattern[]> = new Map();

  constructor() {
    this.initializeIntentPatterns();
  }

  classifyQuery(query: string): QueryIntent {
    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    // Calculate confidence for each intent type
    const intentScores = new Map<IntentType, number>();
    const detectedPatterns: string[] = [];

    for (const [intentType, patterns] of this.intentPatterns.entries()) {
      let maxScore = 0;
      let matchedPatterns: string[] = [];

      for (const pattern of patterns) {
        const score = this.calculatePatternScore(normalized, words, pattern);
        if (score > maxScore) {
          maxScore = score;
          matchedPatterns = [pattern.trigger];
        } else if (score === maxScore && score > 0) {
          matchedPatterns.push(pattern.trigger);
        }
      }

      if (maxScore > 0) {
        intentScores.set(intentType, maxScore);
        detectedPatterns.push(...matchedPatterns);
      }
    }

    // Find the intent with highest confidence
    const bestIntent = this.findBestIntent(intentScores);
    const context = this.extractContext(normalized, words);
    const framework = this.detectFramework(normalized);
    const complexity = this.inferComplexity(normalized, bestIntent.type);

    return {
      type: bestIntent.type,
      confidence: bestIntent.confidence,
      patterns: [...new Set(detectedPatterns)],
      framework: framework || undefined,
      complexity,
      context,
    };
  }

  private calculatePatternScore(
    normalized: string,
    words: string[],
    pattern: IntentPattern
  ): number {
    let score = 0;

    // Exact phrase matching (highest priority)
    if (pattern.phrases) {
      for (const phrase of pattern.phrases) {
        if (normalized.includes(phrase.toLowerCase())) {
          score += pattern.weight * 1.0;
          break;
        }
      }
    }

    // Keyword matching
    if (pattern.keywords) {
      const matchedKeywords = pattern.keywords.filter(keyword =>
        words.includes(keyword.toLowerCase())
      );
      score += (matchedKeywords.length / pattern.keywords.length) * pattern.weight * 0.7;
    }

    // Pattern matching (regex or contains)
    if (pattern.regex) {
      for (const regex of pattern.regex) {
        if (regex.test(normalized)) {
          score += pattern.weight * 0.8;
          break;
        }
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private findBestIntent(intentScores: Map<IntentType, number>): {
    type: IntentType;
    confidence: number;
  } {
    if (intentScores.size === 0) {
      return { type: IntentType.PATTERN_DISCOVERY, confidence: 0.3 }; // Default fallback
    }

    const sorted = Array.from(intentScores.entries()).sort(([, a], [, b]) => b - a);

    const bestIntent = sorted[0];
    if (!bestIntent) {
      return { type: IntentType.PATTERN_DISCOVERY, confidence: 0.3 }; // Fallback
    }

    return {
      type: bestIntent[0],
      confidence: bestIntent[1],
    };
  }

  private extractContext(normalized: string, words: string[]): IntentContext {
    const context: IntentContext = {};

    // Urgency detection
    if (this.containsAny(normalized, ['urgent', 'asap', 'quickly', 'fast', 'immediate'])) {
      context.urgency = 'high';
    } else if (this.containsAny(normalized, ['soon', 'need', 'help'])) {
      context.urgency = 'medium';
    } else {
      context.urgency = 'low';
    }

    // Experience level detection
    if (this.containsAny(normalized, ['beginner', 'new', 'starting', 'first time', 'basic'])) {
      context.experience = 'beginner';
    } else if (this.containsAny(normalized, ['advanced', 'expert', 'complex', 'enterprise'])) {
      context.experience = 'expert';
    } else {
      context.experience = 'intermediate';
    }

    // Project phase detection
    if (this.containsAny(normalized, ['planning', 'design', 'architecture'])) {
      context.projectPhase = 'planning';
    } else if (this.containsAny(normalized, ['refactor', 'improve', 'migrate', 'update'])) {
      context.projectPhase = 'refactoring';
    } else {
      context.projectPhase = 'development';
    }

    // Codebase type detection
    if (this.containsAny(normalized, ['new project', 'from scratch', 'greenfield'])) {
      context.codebase = 'new';
    } else if (this.containsAny(normalized, ['legacy', 'old', 'existing'])) {
      context.codebase = 'legacy';
    } else {
      context.codebase = 'existing';
    }

    return context;
  }

  private detectFramework(normalized: string): string | undefined {
    const frameworks = [
      'nestjs',
      'nest',
      'express',
      'fastify',
      'koa',
      'angular',
      'react',
      'vue',
      'next',
      'nuxt',
    ];

    for (const framework of frameworks) {
      if (normalized.includes(framework)) {
        // Normalize framework names
        if (framework === 'nest') return 'nestjs';
        return framework;
      }
    }

    return undefined;
  }

  private inferComplexity(
    normalized: string,
    intentType: IntentType
  ): 'beginner' | 'intermediate' | 'advanced' {
    // Explicit complexity indicators
    if (this.containsAny(normalized, ['basic', 'simple', 'beginner', 'new'])) {
      return 'beginner';
    }
    if (this.containsAny(normalized, ['advanced', 'complex', 'enterprise', 'expert'])) {
      return 'advanced';
    }

    // Intent-based complexity inference
    switch (intentType) {
      case IntentType.HOW_TO:
      case IntentType.LEARNING:
        return 'beginner';

      case IntentType.BEST_PRACTICES:
      case IntentType.COMPARISON:
        return 'advanced';

      default:
        return 'intermediate';
    }
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private initializeIntentPatterns(): void {
    this.intentPatterns = new Map([
      [
        IntentType.HOW_TO,
        [
          {
            trigger: 'how-to-question',
            weight: 0.9,
            phrases: ['how do i', 'how to', 'how can i', 'how should i'],
            keywords: ['how', 'do', 'can', 'should'],
            regex: [/^how\s+(do|can|should)\s+i\s+/],
          },
        ],
      ],

      [
        IntentType.INTEGRATION,
        [
          {
            trigger: 'framework-integration',
            weight: 0.8,
            phrases: ['nestjs integration', 'express integration', 'integration with'],
            keywords: ['integration', 'integrate', 'setup', 'configure'],
            regex: [/\w+\s+integration/, /integrate\s+with\s+\w+/],
          },
        ],
      ],

      [
        IntentType.LEARNING,
        [
          {
            trigger: 'learning-intent',
            weight: 0.7,
            phrases: ['fundamentals', 'basics', 'learn about', 'understand'],
            keywords: ['learn', 'fundamentals', 'basics', 'tutorial', 'guide'],
            regex: [/learn\s+(about\s+)?\w+/, /\w+\s+fundamentals/],
          },
        ],
      ],

      [
        IntentType.IMPLEMENTATION,
        [
          {
            trigger: 'implementation-need',
            weight: 0.8,
            phrases: ['i need', 'i want', 'implement', 'create'],
            keywords: ['need', 'want', 'implement', 'create', 'build'],
            regex: [/^i\s+(need|want)\s+/, /implement\s+\w+/],
          },
        ],
      ],

      [
        IntentType.TROUBLESHOOTING,
        [
          {
            trigger: 'problem-solving',
            weight: 0.8,
            phrases: ['not working', 'error', 'problem', 'issue', 'fix'],
            keywords: ['error', 'problem', 'issue', 'fix', 'broken', 'failing'],
            regex: [/\w+\s+(not\s+working|broken|failing)/, /fix\s+\w+/],
          },
        ],
      ],

      [
        IntentType.COMPARISON,
        [
          {
            trigger: 'comparison-query',
            weight: 0.7,
            phrases: ['vs', 'versus', 'difference between', 'compare'],
            keywords: ['vs', 'versus', 'difference', 'compare', 'better'],
            regex: [/\w+\s+vs\s+\w+/, /difference\s+between/, /compare\s+\w+/],
          },
        ],
      ],

      [
        IntentType.BEST_PRACTICES,
        [
          {
            trigger: 'best-practices',
            weight: 0.7,
            phrases: ['best practices', 'recommendations', 'patterns'],
            keywords: ['best', 'practices', 'patterns', 'recommendations', 'guidelines'],
            regex: [/best\s+practices/, /\w+\s+patterns/],
          },
        ],
      ],

      [
        IntentType.PATTERN_DISCOVERY,
        [
          {
            trigger: 'pattern-discovery',
            weight: 0.6,
            phrases: ['event sourcing', 'cqrs', 'aggregates', 'domain events'],
            keywords: ['event', 'command', 'query', 'aggregate', 'domain', 'pattern'],
            regex: [/\w+\s+(pattern|architecture)/, /event\s+\w+/, /domain\s+\w+/],
          },
        ],
      ],
    ]);
  }
}

interface IntentPattern {
  trigger: string;
  weight: number;
  phrases?: string[];
  keywords?: string[];
  regex?: RegExp[];
}
