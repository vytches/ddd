/**
 * @fileoverview Command Suggester
 * Intelligent command suggestions based on project state and context
 */

import type { ProjectAnalysis, CommandSuggestion as CommandSuggestionType } from '../../types';
import { Colors } from '../utils/colors';
import { ContextAwarePromptEngine } from '../prompts/context-aware-prompts';
import { FileSystem } from '../utils/file-system';

/**
 * Suggestion rules for different project states
 */
interface SuggestionRule {
  condition: (analysis: ProjectAnalysis) => boolean;
  suggestions: CommandSuggestionType[];
  priority: number;
}

/**
 * @llm-summary Contract for command suggestion functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CommandSuggestion interface implementing infrastructure service for command suggestion operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommandSuggestion implements CommandSuggestion {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CommandSuggestion {
  command: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'next-step' | 'improvement' | 'fix' | 'enhancement';
  confidence: number;
}

/**
 * @llm-summary CommandSuggester class for command suggester operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * CommandSuggester class implementing infrastructure service for command suggester operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CommandSuggester();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CommandSuggester());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CommandSuggester {
  private suggestionRules: SuggestionRule[] = [];
  private promptEngine: ContextAwarePromptEngine;

  constructor() {
    this.promptEngine = ContextAwarePromptEngine.create();
    this.setupSuggestionRules();
  }

  /**
   * Factory method to create suggester
   */
  static create(): CommandSuggester {
    return new CommandSuggester();
  }

  /**
   * Get smart command suggestions based on project state
   */
  async getSuggestions(projectPath?: string): Promise<CommandSuggestionType[]> {
    const path = projectPath || process.cwd();
    const analysis = await this.promptEngine.analyzeContext({
      workflowType: 'analysis',
      step: 1,
      totalSteps: 1,
      data: {},
      metadata: {
        startedAt: new Date(),
        lastModified: new Date(),
        sessionId: `analysis-${Date.now()}`,
      },
      config: {
        outputDir: path,
        debug: false,
        templateDir: '',
        projectStructure: 'clean-architecture',
        framework: 'nestjs',
        patterns: [],
        plugins: [],
      },
      answers: {},
      outputPath: path,
    });

    const suggestions: CommandSuggestionType[] = [];

    // Apply suggestion rules
    for (const rule of this.suggestionRules) {
      if (rule.condition(analysis)) {
        suggestions.push(...rule.suggestions);
      }
    }

    // Add context-specific suggestions
    const contextSuggestions = this.generateContextSuggestions(analysis);
    suggestions.push(...contextSuggestions);

    // Sort by priority and confidence
    return this.prioritizeSuggestions(suggestions);
  }

  /**
   * Display suggestions to user
   */
  displaySuggestions(suggestions: CommandSuggestionType[]): void {
    if (suggestions.length === 0) {
      return;
    }

    console.log('');
    console.log(Colors.bold('💡 Suggested Commands:'));
    console.log('');

    const categorized = this.categorizeSuggestions(suggestions);

    // Display by category
    if (categorized['next-step'] && categorized['next-step'].length > 0) {
      console.log(Colors.cyan('Next Steps:'));
      categorized['next-step'].forEach(this.displaySuggestion);
      console.log('');
    }

    if (categorized.fix && categorized.fix.length > 0) {
      console.log(Colors.red('Fixes Needed:'));
      categorized.fix.forEach(this.displaySuggestion);
      console.log('');
    }

    if (categorized.improvement && categorized.improvement.length > 0) {
      console.log(Colors.yellow('Improvements:'));
      categorized.improvement.forEach(this.displaySuggestion);
      console.log('');
    }

    if (categorized.enhancement && categorized.enhancement.length > 0) {
      console.log(Colors.green('Enhancements:'));
      categorized.enhancement.forEach(this.displaySuggestion);
    }
  }

  /**
   * Setup suggestion rules
   */
  private setupSuggestionRules(): void {
    // No aggregates but has domain directory
    this.suggestionRules.push({
      condition: analysis =>
        analysis.structure.hasDomainDir &&
        !analysis.patterns.some(p => p.name.includes('Aggregate')),
      suggestions: [
        {
          command: 'vytches-ddd generate aggregate Order',
          description: 'Create your first aggregate',
          reason: 'Domain directory exists but no aggregates found',
          priority: 'high',
          category: 'next-step',
          confidence: 0.9,
        },
      ],
      priority: 10,
    });

    // Has aggregates but no commands
    this.suggestionRules.push({
      condition: analysis =>
        analysis.patterns.some(p => p.name.includes('Aggregate')) &&
        !analysis.patterns.some(p => p.name === 'CQRS'),
      suggestions: [
        {
          command: 'vytches-ddd generate command CreateOrder',
          description: 'Add CQRS commands for your aggregates',
          reason: 'Aggregates exist but no CQRS commands found',
          priority: 'medium',
          category: 'next-step',
          confidence: 0.8,
        },
      ],
      priority: 8,
    });

    // No tests directory
    this.suggestionRules.push({
      condition: analysis => !analysis.structure.hasTestsDir,
      suggestions: [
        {
          command: 'vytches-ddd analyze --type test-coverage',
          description: 'Analyze test coverage and generate test structure',
          reason: 'No tests directory found',
          priority: 'high',
          category: 'fix',
          confidence: 0.95,
        },
      ],
      priority: 9,
    });

    // Has events but no event bus
    this.suggestionRules.push({
      condition: analysis =>
        analysis.patterns.some(p => p.name.includes('Event')) &&
        !analysis.dependencies.some(d => d.name.includes('event')),
      suggestions: [
        {
          command: 'pnpm add @vytches/ddd-events',
          description: 'Add event bus for domain events',
          reason: 'Domain events found but no event bus implementation',
          priority: 'medium',
          category: 'improvement',
          confidence: 0.85,
        },
      ],
      priority: 7,
    });

    // Using TypeORM
    this.suggestionRules.push({
      condition: analysis => analysis.dependencies.some(d => d.name === 'typeorm'),
      suggestions: [
        {
          command: 'vytches-ddd generate repository --orm typeorm',
          description: 'Generate TypeORM repository implementations',
          reason: 'TypeORM detected in dependencies',
          priority: 'medium',
          category: 'enhancement',
          confidence: 0.75,
        },
      ],
      priority: 6,
    });

    // Clean architecture without proper structure
    this.suggestionRules.push({
      condition: analysis =>
        analysis.structure.architecture === 'clean' &&
        (!analysis.structure.hasApplicationDir || !analysis.structure.hasInfrastructureDir),
      suggestions: [
        {
          command: 'vytches-ddd scaffold clean-architecture',
          description: 'Complete Clean Architecture structure',
          reason: 'Clean Architecture detected but missing layers',
          priority: 'high',
          category: 'fix',
          confidence: 0.9,
        },
      ],
      priority: 9,
    });
  }

  /**
   * Generate context-specific suggestions
   */
  private generateContextSuggestions(analysis: ProjectAnalysis): CommandSuggestionType[] {
    const suggestions: CommandSuggestionType[] = [];

    // Framework-specific suggestions
    if (analysis.frameworks.some(f => f.name === 'NestJS')) {
      if (!analysis.patterns.some(p => p.name.includes('Module'))) {
        suggestions.push({
          command: 'vytches-ddd generate module --framework nestjs',
          description: 'Generate NestJS modules for your domain',
          reason: 'NestJS detected but domain modules not found',
          priority: 'medium',
          category: 'improvement',
          confidence: 0.8,
        });
      }
    }

    // Pattern-specific suggestions
    if (analysis.patterns.some(p => p.name === 'Event Sourcing')) {
      if (!analysis.dependencies.some(d => d.name.includes('event-store'))) {
        suggestions.push({
          command: 'pnpm add @vytches/ddd-event-store',
          description: 'Add event store for Event Sourcing',
          reason: 'Event Sourcing pattern detected but no event store',
          priority: 'high',
          category: 'next-step',
          confidence: 0.85,
        });
      }
    }

    // Workflow suggestions
    if (!analysis.patterns.length || analysis.patterns.length < 2) {
      suggestions.push({
        command: 'vytches-ddd workflow --type domain-modeling',
        description: 'Start interactive domain modeling workflow',
        reason: 'Limited DDD patterns detected - workflow can help design your domain',
        priority: 'high',
        category: 'next-step',
        confidence: 0.7,
      });
    }

    return suggestions;
  }

  /**
   * Prioritize suggestions
   */
  private prioritizeSuggestions(suggestions: CommandSuggestionType[]): CommandSuggestionType[] {
    return suggestions
      .sort((a, b) => {
        // First by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, 5); // Limit to top 5
  }

  /**
   * Categorize suggestions
   */
  private categorizeSuggestions(
    suggestions: CommandSuggestionType[]
  ): Record<string, CommandSuggestionType[]> {
    const categorized: Record<string, CommandSuggestionType[]> = {
      'next-step': [],
      improvement: [],
      fix: [],
      enhancement: [],
    };

    suggestions.forEach(suggestion => {
      categorized[suggestion.category]?.push(suggestion);
    });

    return categorized;
  }

  /**
   * Display single suggestion
   */
  private displaySuggestion(suggestion: CommandSuggestionType): void {
    const priorityIcon = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    };

    console.log(`  ${priorityIcon[suggestion.priority]} ${Colors.bold(suggestion.command)}`);
    console.log(`     ${Colors.dim(suggestion.description)}`);
    if (suggestion.confidence < 0.8) {
      console.log(`     ${Colors.dim(`Confidence: ${Math.round(suggestion.confidence * 100)}%`)}`);
    }
  }

  /**
   * Get quick suggestion for current directory
   */
  async getQuickSuggestion(): Promise<CommandSuggestionType | null> {
    const suggestions = await this.getSuggestions();
    return suggestions.length > 0 ? suggestions[0] || null : null;
  }

  /**
   * Check if project needs initialization
   */
  async needsInitialization(projectPath?: string): Promise<boolean> {
    const path = projectPath || process.cwd();

    // Check for basic DDD structure
    const hasSrc = FileSystem.exists(FileSystem.joinPath(path, 'src'));
    const hasPackageJson = FileSystem.exists(FileSystem.joinPath(path, 'package.json'));

    if (!hasSrc || !hasPackageJson) {
      return true;
    }

    // Check for vytches-ddd presence
    try {
      const packageJsonPath = FileSystem.joinPath(path, 'package.json');
      const packageJson = JSON.parse(await FileSystem.readFile(packageJsonPath));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      return !Object.keys(deps).some(dep => dep.includes('@vytches/ddd'));
    } catch {
      return true;
    }
  }
}
