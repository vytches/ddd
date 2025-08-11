/**
 * @fileoverview Component Validator
 * Smart validation system for DDD components with context awareness
 */

import type {
  ComponentType,
  ValidationResult,
  ValidationRule,
  ValidationContext,
  ProjectContext as ProjectContextType,
} from '../../types';
import { Colors } from '../utils/colors';
import { FileSystem } from '../utils/file-system';

export class ComponentValidator {
  private validationRules = new Map<ComponentType, ValidationRule[]>();

  constructor() {
    this.setupValidationRules();
  }

  /**
   * Factory method to create validator
   */
  static create(): ComponentValidator {
    return new ComponentValidator();
  }

  /**
   * Validate component generation request
   */
  async validateComponent(
    type: ComponentType,
    name: string,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Get project context
    const projectContext = await this.analyzeProjectContext(context.projectPath);

    // Apply validation rules
    const rules = this.validationRules.get(type) || [];
    for (const rule of rules) {
      const result = await rule.validate(name, context, projectContext);
      warnings.push(...result.warnings);
      errors.push(...result.errors);
      suggestions.push(...result.suggestions);
    }

    // Check naming conventions
    const namingValidation = this.validateNaming(type, name);
    warnings.push(...namingValidation.warnings);
    errors.push(...namingValidation.errors);
    suggestions.push(...namingValidation.suggestions);

    // Check for conflicts with existing components
    const conflictValidation = await this.checkConflicts(type, name, context.projectPath);
    warnings.push(...conflictValidation.warnings);
    errors.push(...conflictValidation.errors);
    suggestions.push(...conflictValidation.suggestions);

    // Analyze dependencies and suggest related components
    const dependencyAnalysis = this.analyzeDependencies(type, name, projectContext);
    suggestions.push(...dependencyAnalysis.suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      metadata: {
        componentType: type,
        componentName: name,
        projectContext,
        confidence: this.calculateConfidence(warnings, errors, suggestions),
      },
    };
  }

  /**
   * Setup validation rules for different component types
   */
  private setupValidationRules(): void {
    // Aggregate validation rules
    this.validationRules.set('aggregate', [
      {
        name: 'aggregate-business-invariants',
        description: 'Validate business invariants and consistency',
        validate: async (name, context, projectContext) => {
          const warnings: string[] = [];
          const suggestions: string[] = [];

          // Check if aggregate has clear business purpose
          if (name.length < 3) {
            warnings.push('Aggregate name is very short, consider more descriptive name');
          }

          // Suggest value objects if none found
          if (!projectContext.hasValueObjects) {
            suggestions.push('Consider creating value objects for aggregate properties');
          }

          // Suggest events for state changes
          if (!projectContext.hasEvents) {
            suggestions.push('Add domain events to track aggregate state changes');
          }

          return { warnings, errors: [], suggestions };
        },
      },
      {
        name: 'aggregate-repository-pattern',
        description: 'Check repository pattern compliance',
        validate: async (name, context, projectContext) => {
          const suggestions: string[] = [];

          if (!projectContext.hasRepositories) {
            suggestions.push('Generate repository interface for data persistence');
          }

          if (projectContext.frameworks.includes('nestjs') && !projectContext.hasTypeORM) {
            suggestions.push('Consider TypeORM integration for NestJS persistence');
          }

          return { warnings: [], errors: [], suggestions };
        },
      },
    ]);

    // Entity validation rules
    this.validationRules.set('entity', [
      {
        name: 'entity-identity',
        description: 'Validate entity identity requirements',
        validate: async (name, context, projectContext) => {
          const warnings: string[] = [];
          const suggestions: string[] = [];

          if (!name.endsWith('Entity') && !projectContext.followsNamingConvention) {
            suggestions.push('Consider adding "Entity" suffix for clarity');
          }

          if (!projectContext.hasEntityId) {
            suggestions.push('Generate EntityId value object for type-safe identity');
          }

          return { warnings, errors: [], suggestions };
        },
      },
    ]);

    // Value Object validation rules
    this.validationRules.set('value-object', [
      {
        name: 'value-object-immutability',
        description: 'Ensure value object immutability',
        validate: async (name, context, projectContext) => {
          const suggestions: string[] = [];

          if (name.toLowerCase().includes('id')) {
            suggestions.push('Consider using EntityId base class for ID value objects');
          }

          suggestions.push('Ensure value object is immutable with validation in constructor');

          return { warnings: [], errors: [], suggestions };
        },
      },
    ]);

    // Event validation rules
    this.validationRules.set('event', [
      {
        name: 'event-naming',
        description: 'Validate event naming conventions',
        validate: async (name, context, projectContext) => {
          const warnings: string[] = [];
          const suggestions: string[] = [];

          if (!name.endsWith('Event')) {
            warnings.push('Event should end with "Event" suffix');
          }

          if (!name.includes('ed') && !name.includes('Created') && !name.includes('Updated')) {
            suggestions.push(
              'Use past tense for event names (e.g., OrderCreated, PaymentProcessed)'
            );
          }

          if (!projectContext.hasEventBus) {
            suggestions.push('Add event bus for domain event publishing');
          }

          return { warnings, errors: [], suggestions };
        },
      },
    ]);

    // Command validation rules
    this.validationRules.set('command', [
      {
        name: 'command-cqrs',
        description: 'Validate CQRS command patterns',
        validate: async (name, context, projectContext) => {
          const suggestions: string[] = [];

          if (!name.endsWith('Command')) {
            suggestions.push('Command should end with "Command" suffix');
          }

          if (!projectContext.hasCommandHandlers) {
            suggestions.push('Generate command handler for processing commands');
          }

          if (!projectContext.hasCQRS) {
            suggestions.push('Consider implementing CQRS pattern for complex domains');
          }

          return { warnings: [], errors: [], suggestions };
        },
      },
    ]);

    // Query validation rules
    this.validationRules.set('query', [
      {
        name: 'query-cqrs',
        description: 'Validate CQRS query patterns',
        validate: async (name, context, projectContext) => {
          const suggestions: string[] = [];

          if (!name.endsWith('Query')) {
            suggestions.push('Query should end with "Query" suffix');
          }

          if (!projectContext.hasQueryHandlers) {
            suggestions.push('Generate query handler for processing queries');
          }

          if (!projectContext.hasReadModels) {
            suggestions.push('Consider creating read models for optimized queries');
          }

          return { warnings: [], errors: [], suggestions };
        },
      },
    ]);
  }

  /**
   * Validate naming conventions
   */
  private validateNaming(type: ComponentType, name: string): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check basic naming rules
    if (!name || name.trim().length === 0) {
      errors.push('Component name cannot be empty');
      return { isValid: false, errors, warnings, suggestions };
    }

    // Check PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      warnings.push('Component name should be in PascalCase (e.g., OrderAggregate)');
    }

    // Check length
    if (name.length < 2) {
      errors.push('Component name is too short (minimum 2 characters)');
    }

    if (name.length > 50) {
      warnings.push('Component name is quite long, consider shortening');
    }

    // Check reserved words
    const reservedWords = ['class', 'function', 'interface', 'type', 'const', 'let', 'var'];
    if (reservedWords.includes(name.toLowerCase())) {
      errors.push(`"${name}" is a reserved word and cannot be used as component name`);
    }

    // Type-specific naming suggestions
    switch (type) {
      case 'aggregate':
        if (!name.endsWith('Aggregate') && !name.endsWith('Root')) {
          suggestions.push('Consider adding "Aggregate" suffix for clarity');
        }
        break;
      case 'entity':
        if (name.endsWith('Entity')) {
          suggestions.push('Entity suffix is optional but can improve clarity');
        }
        break;
      case 'value-object':
        if (name.endsWith('ValueObject')) {
          suggestions.push('ValueObject suffix is redundant, use descriptive name instead');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Check for conflicts with existing components
   */
  private async checkConflicts(
    type: ComponentType,
    name: string,
    projectPath: string
  ): Promise<ValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    try {
      const conflicts = await this.findExistingComponents(name, projectPath);

      if (conflicts.length > 0) {
        const exactMatch = conflicts.find(c => c.name === name);
        if (exactMatch) {
          errors.push(`Component "${name}" already exists at ${exactMatch.path}`);
        } else {
          const similarNames = conflicts.filter(
            c =>
              c.name.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(c.name.toLowerCase())
          );

          if (similarNames.length > 0) {
            warnings.push(`Similar components found: ${similarNames.map(c => c.name).join(', ')}`);
            suggestions.push('Consider using a more specific name to avoid confusion');
          }
        }
      }
    } catch (error) {
      warnings.push('Could not check for existing components');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Analyze project context
   */
  private async analyzeProjectContext(projectPath: string): Promise<ProjectContextType> {
    const context: ProjectContextType = {
      hasAggregates: false,
      hasEntities: false,
      hasValueObjects: false,
      hasEvents: false,
      hasCommands: false,
      hasQueries: false,
      hasRepositories: false,
      hasCommandHandlers: false,
      hasQueryHandlers: false,
      hasEventBus: false,
      hasEntityId: false,
      hasCQRS: false,
      hasReadModels: false,
      hasTypeORM: false,
      frameworks: [],
      followsNamingConvention: true,
    };

    try {
      // Check for package.json to detect frameworks
      const packageJsonPath = FileSystem.joinPath(projectPath, 'package.json');
      if (FileSystem.exists(packageJsonPath)) {
        const packageJson = JSON.parse(await FileSystem.readFile(packageJsonPath));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (dependencies['@nestjs/core']) context.frameworks.push('nestjs');
        if (dependencies['express']) context.frameworks.push('express');
        if (dependencies['fastify']) context.frameworks.push('fastify');
        if (dependencies['typeorm']) context.hasTypeORM = true;
      }

      // Scan for existing components
      const srcPath = FileSystem.joinPath(projectPath, 'src');
      if (FileSystem.exists(srcPath)) {
        const files = await this.scanDirectory(srcPath);

        context.hasAggregates = files.some(f => f.includes('aggregate'));
        context.hasEntities = files.some(f => f.includes('entity'));
        context.hasValueObjects = files.some(
          f => f.includes('value-object') || f.includes('value.object')
        );
        context.hasEvents = files.some(f => f.includes('event'));
        context.hasCommands = files.some(f => f.includes('command'));
        context.hasQueries = files.some(f => f.includes('query'));
        context.hasRepositories = files.some(f => f.includes('repository'));
        context.hasCommandHandlers = files.some(
          f => f.includes('handler') && f.includes('command')
        );
        context.hasQueryHandlers = files.some(f => f.includes('handler') && f.includes('query'));
        context.hasEventBus = files.some(f => f.includes('event-bus') || f.includes('event.bus'));
        context.hasEntityId = files.some(f => f.includes('entity-id') || f.includes('entity.id'));
        context.hasCQRS = context.hasCommands && context.hasQueries;
        context.hasReadModels = files.some(
          f => f.includes('read-model') || f.includes('projection')
        );
      }
    } catch (error) {
      // Continue with default context if analysis fails
    }

    return context;
  }

  /**
   * Analyze dependencies and suggest related components
   */
  private analyzeDependencies(
    type: ComponentType,
    name: string,
    projectContext: ProjectContextType
  ): { suggestions: string[] } {
    const suggestions: string[] = [];

    switch (type) {
      case 'aggregate':
        if (!projectContext.hasRepositories) {
          suggestions.push(`Generate I${name}Repository interface for data access`);
        }
        if (!projectContext.hasEvents) {
          suggestions.push(`Create ${name}Created and ${name}Updated events`);
        }
        if (!projectContext.hasCommands) {
          suggestions.push(`Generate Create${name}Command and Update${name}Command`);
        }
        break;

      case 'command':
        if (!projectContext.hasCommandHandlers) {
          suggestions.push(`Generate ${name}Handler to process this command`);
        }
        if (!projectContext.hasAggregates) {
          suggestions.push('Create aggregate to handle business logic');
        }
        break;

      case 'query':
        if (!projectContext.hasQueryHandlers) {
          suggestions.push(`Generate ${name}Handler to process this query`);
        }
        if (!projectContext.hasReadModels) {
          suggestions.push('Consider creating read models for optimized queries');
        }
        break;

      case 'event':
        if (!projectContext.hasEventBus) {
          suggestions.push('Add event bus for publishing and subscribing to events');
        }
        suggestions.push('Consider creating event handlers for side effects');
        break;
    }

    return { suggestions };
  }

  /**
   * Calculate confidence score for validation
   */
  private calculateConfidence(warnings: string[], errors: string[], suggestions: string[]): number {
    let confidence = 1.0;

    // Reduce confidence for errors
    confidence -= errors.length * 0.3;

    // Reduce confidence for warnings
    confidence -= warnings.length * 0.1;

    // Reduce confidence for many suggestions (indicates missing context)
    confidence -= Math.max(0, (suggestions.length - 2) * 0.05);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Find existing components with similar names
   */
  private async findExistingComponents(
    name: string,
    projectPath: string
  ): Promise<Array<{ name: string; path: string; type: string }>> {
    const components: Array<{ name: string; path: string; type: string }> = [];

    try {
      const srcPath = FileSystem.joinPath(projectPath, 'src');
      if (!FileSystem.exists(srcPath)) {
        return components;
      }

      const files = await this.scanDirectory(srcPath);

      for (const file of files) {
        const fileName = FileSystem.getBaseName(file) + FileSystem.getExtension(file);
        const componentName = this.extractComponentName(fileName);

        if (componentName && componentName.toLowerCase().includes(name.toLowerCase())) {
          components.push({
            name: componentName,
            path: file,
            type: this.detectComponentType(fileName),
          });
        }
      }
    } catch (error) {
      // Return empty array if scanning fails
    }

    return components;
  }

  /**
   * Recursively scan directory for files
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
   * Extract component name from file name
   */
  private extractComponentName(fileName: string): string | null {
    // Remove extension
    const nameWithoutExt = fileName.replace(/\.(ts|js)$/, '');

    // Convert kebab-case to PascalCase
    const pascalCase = nameWithoutExt
      .split(/[-_.]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    return pascalCase || null;
  }

  /**
   * Detect component type from file name
   */
  private detectComponentType(fileName: string): string {
    const lower = fileName.toLowerCase();

    if (lower.includes('aggregate')) return 'aggregate';
    if (lower.includes('entity')) return 'entity';
    if (lower.includes('value-object') || lower.includes('value.object')) return 'value-object';
    if (lower.includes('command')) return 'command';
    if (lower.includes('query')) return 'query';
    if (lower.includes('event')) return 'event';
    if (lower.includes('repository')) return 'repository';
    if (lower.includes('handler')) return 'handler';
    if (lower.includes('service')) return 'service';

    return 'unknown';
  }

  /**
   * Display validation results
   */
  displayValidationResults(result: ValidationResult): void {
    console.log('');
    console.log(Colors.bold('🔍 Component Validation Results:'));
    console.log('');

    if (result.isValid) {
      console.log(Colors.success('✅ Validation passed'));
    } else {
      console.log(Colors.error('❌ Validation failed'));
    }

    if (result.errors.length > 0) {
      console.log('');
      console.log(Colors.bold(Colors.red('Errors:')));
      result.errors.forEach(error => {
        console.log(`  ${Colors.red('•')} ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('');
      console.log(Colors.bold(Colors.yellow('Warnings:')));
      result.warnings.forEach(warning => {
        console.log(`  ${Colors.yellow('•')} ${warning}`);
      });
    }

    if (result.suggestions.length > 0) {
      console.log('');
      console.log(Colors.bold(Colors.cyan('Suggestions:')));
      result.suggestions.forEach(suggestion => {
        console.log(`  ${Colors.cyan('•')} ${suggestion}`);
      });
    }

    if (result.metadata?.confidence !== undefined) {
      const confidence = Math.round(result.metadata.confidence * 100);
      const confidenceColor =
        confidence >= 80 ? Colors.green : confidence >= 60 ? Colors.yellow : Colors.red;
      console.log('');
      console.log(`${Colors.bold('Confidence:')} ${confidenceColor(`${confidence}%`)}`);
    }

    console.log('');
  }
}
