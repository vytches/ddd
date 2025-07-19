/**
 * @fileoverview Context-Aware Prompt System
 * Intelligent prompts that adapt based on project context and user patterns
 */

import type {
  PromptConfig,
  ContextAwarePrompt,
  PromptSuggestion,
  ProjectAnalysis,
  ProjectStructureInfo,
  DetectedPattern,
  DependencyInfo,
  FrameworkInfo,
  SmartPromptEngine,
} from '../../types';
import type { WorkflowContext } from '../../workflows/types';
import { FileSystem } from '../utils/file-system';
import { Colors } from '../utils/colors';

/**
 * @llm-summary ContextAwarePromptEngine class for context aware prompt engine operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ContextAwarePromptEngine class implementing infrastructure service for context aware prompt engine operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ContextAwarePromptEngine();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ContextAwarePromptEngine());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ContextAwarePromptEngine implements SmartPromptEngine {
  private projectAnalysisCache = new Map<string, ProjectAnalysis>();

  /**
   * Factory method to create prompt engine
   */
  static create(): ContextAwarePromptEngine {
    return new ContextAwarePromptEngine();
  }

  /**
   * Analyze project context for intelligent suggestions
   */
  async analyzeContext(context: WorkflowContext): Promise<ProjectAnalysis> {
    const projectPath = (context.config?.outputDir as string) || process.cwd();

    // Check cache first
    if (this.projectAnalysisCache.has(projectPath)) {
      return this.projectAnalysisCache.get(projectPath)!;
    }

    const analysis: ProjectAnalysis = {
      structure: await this.analyzeProjectStructure(projectPath),
      patterns: await this.detectPatterns(projectPath),
      dependencies: await this.analyzeDependencies(projectPath),
      frameworks: await this.detectFrameworks(projectPath),
      conventions: await this.analyzeNamingConventions(projectPath),
      suggestions: [],
    };

    // Generate project-level suggestions
    analysis.suggestions = this.generateProjectSuggestions(analysis);

    // Cache the analysis
    this.projectAnalysisCache.set(projectPath, analysis);

    return analysis;
  }

  /**
   * Generate intelligent suggestions for prompts
   */
  async generateSuggestions(
    prompt: ContextAwarePrompt,
    context: WorkflowContext
  ): Promise<PromptSuggestion[]> {
    const suggestions: PromptSuggestion[] = [];

    // Use custom analyzer if provided
    if (prompt.analyzer) {
      const customSuggestions = await prompt.analyzer(context);
      suggestions.push(...customSuggestions);
    }

    // Generate context-based suggestions
    const analysis = await this.analyzeContext(context);
    const contextSuggestions = this.generateContextSuggestions(prompt, analysis, context);
    suggestions.push(...contextSuggestions);

    // Sort by confidence and limit results
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  /**
   * Adapt prompt based on context
   */
  async adaptPrompt(prompt: ContextAwarePrompt, context: WorkflowContext): Promise<PromptConfig> {
    const adaptedPrompt: PromptConfig = { ...prompt };

    // Check if prompt should be shown
    if (prompt.conditionalShow && !prompt.conditionalShow(context)) {
      return { ...adaptedPrompt, type: 'input', message: 'Skip this step', default: '' };
    }

    // Generate dynamic default
    if (prompt.dynamicDefault) {
      adaptedPrompt.default = await prompt.dynamicDefault(context);
    }

    // Enhance choices with suggestions
    if (prompt.type === 'select' || prompt.type === 'multiselect') {
      const suggestions = await this.generateSuggestions(prompt, context);

      if (suggestions.length > 0) {
        const enhancedChoices = suggestions.map(suggestion => ({
          name: `${suggestion.title} (${Math.round(suggestion.confidence * 100)}% confidence)`,
          value: suggestion.value,
          description: suggestion.description,
        }));

        adaptedPrompt.choices = enhancedChoices;
      }
    }

    return adaptedPrompt;
  }

  /**
   * Analyze project directory structure
   */
  private async analyzeProjectStructure(projectPath: string): Promise<ProjectStructureInfo> {
    const structure: ProjectStructureInfo = {
      hasSourceDir: false,
      hasDomainDir: false,
      hasApplicationDir: false,
      hasInfrastructureDir: false,
      hasTestsDir: false,
      architecture: 'unknown',
    };

    try {
      const srcPath = FileSystem.joinPath(projectPath, 'src');
      structure.hasSourceDir = FileSystem.exists(srcPath);

      if (structure.hasSourceDir) {
        const srcEntries = await FileSystem.listDirectory(srcPath);

        structure.hasDomainDir = srcEntries.some(entry => entry.toLowerCase().includes('domain'));
        structure.hasApplicationDir = srcEntries.some(
          entry =>
            entry.toLowerCase().includes('application') || entry.toLowerCase().includes('app')
        );
        structure.hasInfrastructureDir = srcEntries.some(
          entry =>
            entry.toLowerCase().includes('infrastructure') || entry.toLowerCase().includes('infra')
        );

        // Detect architecture pattern
        if (
          structure.hasDomainDir &&
          structure.hasApplicationDir &&
          structure.hasInfrastructureDir
        ) {
          structure.architecture = 'clean';
        } else if (srcEntries.some(entry => entry.toLowerCase().includes('adapters'))) {
          structure.architecture = 'hexagonal';
        } else if (srcEntries.some(entry => entry.toLowerCase().includes('core'))) {
          structure.architecture = 'onion';
        } else if (srcEntries.length > 3) {
          structure.architecture = 'layered';
        }
      }

      // Check for tests directory
      const testPaths = ['tests', 'test', '__tests__', 'src/tests'];
      for (const testPath of testPaths) {
        if (FileSystem.exists(FileSystem.joinPath(projectPath, testPath))) {
          structure.hasTestsDir = true;
          break;
        }
      }
    } catch (error) {
      // Continue with default structure
    }

    return structure;
  }

  /**
   * Detect DDD and architectural patterns
   */
  private async detectPatterns(projectPath: string): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];

    try {
      const files = await this.scanAllFiles(projectPath);

      // CQRS Pattern
      const hasCommands = files.some(f => f.includes('command'));
      const hasQueries = files.some(f => f.includes('query'));
      const hasHandlers = files.some(f => f.includes('handler'));

      if (hasCommands && hasQueries && hasHandlers) {
        patterns.push({
          name: 'CQRS',
          confidence: 0.9,
          evidence: ['Commands found', 'Queries found', 'Handlers found'],
          suggestions: ['Consider adding command/query validation', 'Add result patterns'],
        });
      }

      // Event Sourcing Pattern
      const hasEvents = files.some(f => f.includes('event'));
      const hasEventStore = files.some(f => f.includes('event-store') || f.includes('eventstore'));

      if (hasEvents && hasEventStore) {
        patterns.push({
          name: 'Event Sourcing',
          confidence: 0.85,
          evidence: ['Domain events found', 'Event store implementation'],
          suggestions: ['Add event versioning', 'Consider snapshots for performance'],
        });
      }

      // Repository Pattern
      const hasRepositories = files.some(f => f.includes('repository'));
      const hasInterfaces = files.some(f => f.includes('interface') || f.includes('abstract'));

      if (hasRepositories) {
        patterns.push({
          name: 'Repository Pattern',
          confidence: hasInterfaces ? 0.8 : 0.6,
          evidence: hasInterfaces
            ? ['Repository implementations', 'Interface abstractions']
            : ['Repository implementations'],
          suggestions: ['Ensure repository interfaces are separated from implementations'],
        });
      }

      // Value Objects Pattern
      const hasValueObjects = files.some(
        f => f.includes('value-object') || f.includes('value.object')
      );

      if (hasValueObjects) {
        patterns.push({
          name: 'Value Objects',
          confidence: 0.7,
          evidence: ['Value object implementations found'],
          suggestions: ['Ensure value objects are immutable', 'Add proper validation'],
        });
      }

      // Saga Pattern
      const hasSagas = files.some(f => f.includes('saga'));
      const hasOrchestration = files.some(f => f.includes('orchestrat') || f.includes('workflow'));

      if (hasSagas || hasOrchestration) {
        patterns.push({
          name: 'Saga Pattern',
          confidence: 0.75,
          evidence: ['Saga implementations found'],
          suggestions: ['Add compensation logic', 'Consider saga state persistence'],
        });
      }
    } catch (error) {
      // Continue with empty patterns
    }

    return patterns;
  }

  /**
   * Analyze project dependencies
   */
  private async analyzeDependencies(projectPath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    try {
      const packageJsonPath = FileSystem.joinPath(projectPath, 'package.json');
      if (FileSystem.exists(packageJsonPath)) {
        const packageJson = JSON.parse(await FileSystem.readFile(packageJsonPath));
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};

        // Analyze production dependencies
        for (const [name, version] of Object.entries(deps)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'production',
            category: this.categorizeDependency(name),
          });
        }

        // Analyze development dependencies
        for (const [name, version] of Object.entries(devDeps)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'development',
            category: this.categorizeDependency(name),
          });
        }
      }
    } catch (error) {
      // Continue with empty dependencies
    }

    return dependencies;
  }

  /**
   * Detect frameworks in use
   */
  private async detectFrameworks(projectPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];
    const dependencies = await this.analyzeDependencies(projectPath);

    // NestJS
    const nestDep = dependencies.find(d => d.name === '@nestjs/core');
    if (nestDep) {
      frameworks.push({
        name: 'NestJS',
        version: nestDep.version,
        capabilities: ['Dependency Injection', 'Decorators', 'Modules', 'Guards', 'Interceptors'],
        conventions: [
          {
            pattern: '*.controller.ts',
            description: 'Controllers handle HTTP requests',
            examples: ['user.controller.ts', 'order.controller.ts'],
            confidence: 0.9,
          },
          {
            pattern: '*.service.ts',
            description: 'Services contain business logic',
            examples: ['user.service.ts', 'order.service.ts'],
            confidence: 0.9,
          },
        ],
      });
    }

    // Express
    const expressDep = dependencies.find(d => d.name === 'express');
    if (expressDep) {
      frameworks.push({
        name: 'Express',
        version: expressDep.version,
        capabilities: ['Middleware', 'Routing', 'HTTP Server'],
        conventions: [
          {
            pattern: '*.routes.ts',
            description: 'Route definitions',
            examples: ['user.routes.ts', 'api.routes.ts'],
            confidence: 0.7,
          },
        ],
      });
    }

    // TypeORM
    const typeormDep = dependencies.find(d => d.name === 'typeorm');
    if (typeormDep) {
      frameworks.push({
        name: 'TypeORM',
        version: typeormDep.version,
        capabilities: ['ORM', 'Database Migrations', 'Entity Mapping'],
        conventions: [
          {
            pattern: '*.entity.ts',
            description: 'Database entities',
            examples: ['user.entity.ts', 'order.entity.ts'],
            confidence: 0.9,
          },
        ],
      });
    }

    return frameworks;
  }

  /**
   * Analyze naming conventions
   */
  private async analyzeNamingConventions(projectPath: string): Promise<any[]> {
    const conventions: any[] = [];

    try {
      const files = await this.scanAllFiles(projectPath);

      // Analyze file naming patterns
      const patterns = new Map<string, number>();

      files.forEach(file => {
        const fileName = FileSystem.getBaseName(file) + FileSystem.getExtension(file);

        // Extract patterns
        if (fileName.includes('.')) {
          const parts = fileName.split('.');
          if (parts.length >= 2) {
            const pattern = parts.slice(-2).join('.');
            patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
          }
        }
      });

      // Convert to conventions
      for (const [pattern, count] of patterns.entries()) {
        if (count >= 2) {
          // Pattern used at least twice
          const confidence = Math.min(0.9, (count / files.length) * 10);
          conventions.push({
            pattern,
            description: `Files following ${pattern} pattern`,
            examples: files
              .filter(f => f.endsWith(pattern))
              .slice(0, 3)
              .map(f => FileSystem.getBaseName(f) + FileSystem.getExtension(f)),
            confidence,
          });
        }
      }
    } catch (error) {
      // Continue with empty conventions
    }

    return conventions;
  }

  /**
   * Generate context-based suggestions
   */
  private generateContextSuggestions(
    prompt: ContextAwarePrompt,
    analysis: ProjectAnalysis,
    context: WorkflowContext
  ): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    // Framework-specific suggestions
    if (prompt.message.toLowerCase().includes('framework')) {
      analysis.frameworks.forEach(framework => {
        suggestions.push({
          title: framework.name,
          description: `Continue with ${framework.name} (detected in project)`,
          value: framework.name.toLowerCase(),
          confidence: 0.8,
          reasoning: `${framework.name} is already in use in this project`,
        });
      });
    }

    // Architecture suggestions
    if (prompt.message.toLowerCase().includes('architecture')) {
      if (analysis.structure.architecture !== 'unknown') {
        suggestions.push({
          title: `${analysis.structure.architecture} Architecture`,
          description: `Continue with ${analysis.structure.architecture} architecture (detected)`,
          value: analysis.structure.architecture,
          confidence: 0.85,
          reasoning: 'Project structure indicates this architecture is already in use',
        });
      }
    }

    // Pattern suggestions
    if (prompt.message.toLowerCase().includes('pattern')) {
      analysis.patterns.forEach(pattern => {
        suggestions.push({
          title: pattern.name,
          description: `Use ${pattern.name} (already implemented)`,
          value: pattern.name.toLowerCase().replace(/\s+/g, '-'),
          confidence: pattern.confidence,
          reasoning: `Evidence: ${pattern.evidence.join(', ')}`,
        });
      });
    }

    // Component naming suggestions
    if (prompt.message.toLowerCase().includes('name')) {
      const domainWords = this.extractDomainWords(analysis);
      domainWords.forEach((word, index) => {
        suggestions.push({
          title: word,
          description: `${word} (found in project context)`,
          value: word,
          confidence: Math.max(0.3, 0.8 - index * 0.1),
          reasoning: 'Extracted from existing project files and naming patterns',
        });
      });
    }

    return suggestions;
  }

  /**
   * Generate project-level suggestions
   */
  private generateProjectSuggestions(analysis: ProjectAnalysis): any[] {
    const suggestions: any[] = [];

    // Structure suggestions
    if (!analysis.structure.hasTestsDir) {
      suggestions.push({
        title: 'Add Test Directory',
        description: 'Create tests directory for comprehensive test coverage',
        priority: 'high',
        effort: 'low',
        impact: 'high',
        category: 'testing',
      });
    }

    if (analysis.structure.architecture === 'unknown') {
      suggestions.push({
        title: 'Define Architecture Pattern',
        description: 'Organize code using Clean Architecture or Hexagonal patterns',
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        category: 'structure',
      });
    }

    // Pattern suggestions
    const hasCQRS = analysis.patterns.some(p => p.name === 'CQRS');
    const hasEventSourcing = analysis.patterns.some(p => p.name === 'Event Sourcing');

    if (!hasCQRS && analysis.patterns.length > 2) {
      suggestions.push({
        title: 'Consider CQRS Pattern',
        description: 'Separate command and query models for complex domains',
        priority: 'medium',
        effort: 'medium',
        impact: 'medium',
        category: 'patterns',
      });
    }

    if (!hasEventSourcing && analysis.patterns.some(p => p.name.includes('Event'))) {
      suggestions.push({
        title: 'Consider Event Sourcing',
        description: 'Store events as the source of truth for audit trails',
        priority: 'low',
        effort: 'high',
        impact: 'medium',
        category: 'patterns',
      });
    }

    return suggestions;
  }

  /**
   * Categorize dependency by name
   */
  private categorizeDependency(name: string): DependencyInfo['category'] {
    if (name.includes('nest') || name.includes('express') || name.includes('fastify')) {
      return 'framework';
    }
    if (name.includes('test') || name.includes('jest') || name.includes('vitest')) {
      return 'testing';
    }
    if (name.includes('typeorm') || name.includes('prisma') || name.includes('mongoose')) {
      return 'database';
    }
    if (name.includes('@vytches-ddd')) {
      return 'ddd';
    }
    if (name.includes('lodash') || name.includes('uuid') || name.includes('moment')) {
      return 'utility';
    }
    return 'other';
  }

  /**
   * Extract domain words from project context
   */
  private extractDomainWords(analysis: ProjectAnalysis): string[] {
    const words = new Set<string>();

    // Extract from file patterns
    analysis.conventions.forEach(convention => {
      convention.examples?.forEach((example: string) => {
        const parts = example.split(/[.-_]/);
        parts.forEach(part => {
          if (part.length > 2 && !/^(js|ts|test|spec)$/.test(part)) {
            words.add(part.charAt(0).toUpperCase() + part.slice(1));
          }
        });
      });
    });

    // Extract from framework conventions
    analysis.frameworks.forEach(framework => {
      framework.conventions.forEach(convention => {
        convention.examples.forEach(example => {
          const parts = example.split(/[.-_]/);
          parts.forEach(part => {
            if (part.length > 2 && !/^(js|ts|controller|service|entity)$/.test(part)) {
              words.add(part.charAt(0).toUpperCase() + part.slice(1));
            }
          });
        });
      });
    });

    return Array.from(words).slice(0, 5); // Limit to top 5
  }

  /**
   * Scan all TypeScript files in project
   */
  private async scanAllFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const srcPath = FileSystem.joinPath(projectPath, 'src');
      if (FileSystem.exists(srcPath)) {
        files.push(...(await this.scanDirectory(srcPath)));
      }
    } catch (error) {
      // Continue with empty files
    }

    return files;
  }

  /**
   * Recursively scan directory for TypeScript files
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await FileSystem.listDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = FileSystem.joinPath(dirPath, entry);

        if (FileSystem.isDirectory(fullPath)) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Continue if directory scan fails
    }

    return files;
  }

  /**
   * Display project analysis results
   */
  displayAnalysis(analysis: ProjectAnalysis): void {
    console.log('');
    console.log(Colors.bold(Colors.cyan('📊 Project Analysis:')));
    console.log('');

    // Structure
    console.log(Colors.bold('🏗️ Project Structure:'));
    console.log(`  Architecture: ${Colors.cyan(analysis.structure.architecture)}`);
    console.log(
      `  Source Directory: ${analysis.structure.hasSourceDir ? Colors.green('✓') : Colors.red('✗')}`
    );
    console.log(
      `  Domain Layer: ${analysis.structure.hasDomainDir ? Colors.green('✓') : Colors.red('✗')}`
    );
    console.log(`  Tests: ${analysis.structure.hasTestsDir ? Colors.green('✓') : Colors.red('✗')}`);
    console.log('');

    // Frameworks
    if (analysis.frameworks.length > 0) {
      console.log(Colors.bold('⚙️ Detected Frameworks:'));
      analysis.frameworks.forEach(framework => {
        console.log(`  ${Colors.cyan(framework.name)} ${Colors.dim(framework.version)}`);
      });
      console.log('');
    }

    // Patterns
    if (analysis.patterns.length > 0) {
      console.log(Colors.bold('🔄 Detected Patterns:'));
      analysis.patterns.forEach(pattern => {
        const confidence = Math.round(pattern.confidence * 100);
        console.log(`  ${Colors.green(pattern.name)} ${Colors.dim(`(${confidence}% confidence)`)}`);
      });
      console.log('');
    }

    // Suggestions
    if (analysis.suggestions.length > 0) {
      console.log(Colors.bold('💡 Suggestions:'));
      analysis.suggestions.slice(0, 3).forEach(suggestion => {
        console.log(`  ${Colors.yellow('•')} ${suggestion.title}`);
        console.log(`    ${Colors.dim(suggestion.description)}`);
      });
      console.log('');
    }
  }
}

/**
 * @llm-summary SmartPrompts class for smart prompts operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * SmartPrompts class implementing infrastructure service for smart prompts operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SmartPrompts();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SmartPrompts());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SmartPrompts {
  /**
   * Create component name prompt with intelligent suggestions
   */
  static componentName(componentType: string): ContextAwarePrompt {
    return {
      type: 'input',
      message: `Enter ${componentType} name:`,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Component name is required';
        }
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(input)) {
          return 'Use PascalCase (e.g., UserAggregate)';
        }
        return true;
      },
      analyzer: async (context: WorkflowContext) => {
        const engine = ContextAwarePromptEngine.create();
        const analysis = await engine.analyzeContext(context);

        const suggestions: PromptSuggestion[] = [];

        // Extract domain-specific suggestions
        analysis.frameworks.forEach(framework => {
          framework.conventions.forEach(convention => {
            convention.examples.forEach(example => {
              const name = example.split('.')[0];
              if (name && name !== componentType.toLowerCase()) {
                suggestions.push({
                  title: name.charAt(0).toUpperCase() + name.slice(1),
                  description: `Based on existing ${framework.name} conventions`,
                  value: name.charAt(0).toUpperCase() + name.slice(1),
                  confidence: convention.confidence * 0.7,
                });
              }
            });
          });
        });

        return suggestions;
      },
    };
  }

  /**
   * Create framework selection prompt with auto-detection
   */
  static frameworkSelection(): ContextAwarePrompt {
    return {
      type: 'select',
      message: 'Select target framework:',
      choices: [
        { name: 'NestJS', value: 'nestjs', description: 'Enterprise Node.js framework' },
        { name: 'Express', value: 'express', description: 'Minimal web framework' },
        { name: 'Fastify', value: 'fastify', description: 'Fast web framework' },
        { name: 'Standalone', value: 'standalone', description: 'No web framework' },
      ],
      dynamicDefault: async (context: WorkflowContext) => {
        const engine = ContextAwarePromptEngine.create();
        const analysis = await engine.analyzeContext(context);

        // Return detected framework as default
        if (analysis.frameworks.length > 0 && analysis.frameworks[0]) {
          return analysis.frameworks[0].name.toLowerCase();
        }

        return 'nestjs'; // Default to NestJS
      },
    };
  }

  /**
   * Create architecture selection prompt with detection
   */
  static architectureSelection(): ContextAwarePrompt {
    return {
      type: 'select',
      message: 'Select architecture pattern:',
      choices: [
        {
          name: 'Clean Architecture',
          value: 'clean',
          description: 'Dependency inversion with clear boundaries',
        },
        {
          name: 'Hexagonal Architecture',
          value: 'hexagonal',
          description: 'Ports and adapters pattern',
        },
        {
          name: 'Onion Architecture',
          value: 'onion',
          description: 'Concentric layers with domain at center',
        },
        {
          name: 'Layered Architecture',
          value: 'layered',
          description: 'Traditional layered approach',
        },
      ],
      dynamicDefault: async (context: WorkflowContext) => {
        const engine = ContextAwarePromptEngine.create();
        const analysis = await engine.analyzeContext(context);

        if (analysis.structure.architecture !== 'unknown') {
          return analysis.structure.architecture;
        }

        return 'clean'; // Default to Clean Architecture
      },
    };
  }
}
