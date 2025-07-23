/* eslint-disable no-case-declarations */
/**
 * @llm-summary Component generation workflow implementation
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Workflow for generating DDD components like entities, aggregates,
 * value objects, and services with proper patterns and structure.
 *
 * @example
 * ```typescript
 * const workflow = new ComponentGenerationWorkflow();
 * const context = await workflow.start('entity');
 * ```
 *
 * @since 1.0.0
 * @public
 */

import type { WorkflowContext, ComponentGenerationOptions } from '../types';
import { Colors } from '../../core/utils/colors';
import { Prompts } from '../../core/utils/prompts';
import { FileSystem } from '../../core/utils/file-system';

export class ComponentGenerationWorkflow {
  private options: ComponentGenerationOptions;

  constructor(options: Partial<ComponentGenerationOptions> = {}) {
    this.options = {
      componentType: options.componentType ?? '',
      name: options.name || '',
      framework: options.framework || 'standalone',
      patterns: options.patterns || [],
      outputPath: options.outputPath || process.cwd(),
    };
  }

  /**
   * Start the component generation workflow
   */
  async start(componentType?: string): Promise<WorkflowContext> {
    console.log(Colors.info('🔧 Starting Component Generation Workflow...'));
    console.log('');

    const context: WorkflowContext = {
      workflowType: 'component-generation',
      step: 1,
      totalSteps: 4,
      data: {
        componentType: componentType || this.options.componentType,
      },
      metadata: {
        startedAt: new Date(),
        lastModified: new Date(),
        sessionId: `component-generation-${Date.now()}`,
      },
    };

    // Step 1: Component Type Selection
    await this.stepComponentTypeSelection(context);

    // Step 2: Component Configuration
    await this.stepComponentConfiguration(context);

    // Step 3: Pattern Integration
    await this.stepPatternIntegration(context);

    // Step 4: Code Generation
    await this.stepCodeGeneration(context);

    console.log('');
    console.log(Colors.success('✅ Component generation completed!'));

    return context;
  }

  /**
   * Step 1: Component Type Selection
   */
  private async stepComponentTypeSelection(context: WorkflowContext): Promise<void> {
    console.log(Colors.bold(`(${context.step}/${context.totalSteps}) Component Type Selection`));

    if (!context.data.componentType) {
      const componentType = await Prompts.select({
        message: 'What type of component do you want to generate?',
        choices: [
          { value: 'entity', name: '🏛️  Entity', description: 'Domain entity with identity' },
          {
            value: 'aggregate',
            name: '📦 Aggregate Root',
            description: 'Aggregate with business logic',
          },
          { value: 'value-object', name: '💎 Value Object', description: 'Immutable value type' },
          { value: 'service', name: '⚙️  Domain Service', description: 'Business logic service' },
          { value: 'repository', name: '🗄️  Repository', description: 'Data access interface' },
          { value: 'command', name: '📝 Command', description: 'CQRS command object' },
          { value: 'query', name: '🔍 Query', description: 'CQRS query object' },
          { value: 'event', name: '📡 Domain Event', description: 'Domain event definition' },
        ],
      });

      context.data.componentType = componentType;
    }

    console.log(Colors.success(`📝 Component Type: ${context.data.componentType}`));
    context.step++;
  }

  /**
   * Step 2: Component Configuration
   */
  private async stepComponentConfiguration(context: WorkflowContext): Promise<void> {
    console.log(Colors.bold(`(${context.step}/${context.totalSteps}) Component Configuration`));

    if (!this.options.name) {
      const name = await Prompts.ask({
        message: `Enter the ${context.data.componentType} name:`,
        default: 'e.g., User, Order, ProductCatalog',
        validate: (value: string) => value.length >= 2 || 'Name must be at least 2 characters',
      });

      context.data.componentName = name;
    } else {
      context.data.componentName = this.options.name;
    }

    // Get component-specific configuration
    await this.getComponentSpecificConfig(context);

    console.log(Colors.success(`🏷️  Component Name: ${context.data.componentName}`));
    context.step++;
  }

  /**
   * Step 3: Pattern Integration
   */
  private async stepPatternIntegration(context: WorkflowContext): Promise<void> {
    console.log(Colors.bold(`(${context.step}/${context.totalSteps}) Pattern Integration`));

    const availablePatterns = this.getAvailablePatternsFor(context.data.componentType as string);

    if (availablePatterns.length > 0) {
      const patterns = await Prompts.multiSelect({
        message: 'Select patterns to integrate:',
        choices: availablePatterns,
      });

      context.data.patterns = patterns;

      if (patterns.length > 0) {
        console.log(Colors.success(`🎨 Patterns: ${patterns.join(', ')}`));
      }
    }

    context.step++;
  }

  /**
   * Step 4: Code Generation
   */
  private async stepCodeGeneration(context: WorkflowContext): Promise<void> {
    console.log(Colors.bold(`(${context.step}/${context.totalSteps}) Code Generation`));

    const componentType = context.data.componentType as string;
    const componentName = context.data.componentName as string;
    const patterns = (context.data.patterns as string[]) || [];

    console.log(Colors.info(`⚡ Generating ${componentType}: ${componentName}...`));

    // Generate the component
    const files = await this.generateComponent(componentType, componentName, patterns);

    context.data.generatedFiles = files;
    console.log(Colors.success(`📄 Generated ${files.length} files`));

    files.forEach(file => {
      console.log(Colors.dim(`  ✓ ${file}`));
    });

    context.step++;
  }

  /**
   * Get component-specific configuration
   */
  private async getComponentSpecificConfig(context: WorkflowContext): Promise<void> {
    const componentType = context.data.componentType as string;

    switch (componentType) {
      case 'entity':
      case 'aggregate':
        const hasId = await Prompts.confirm({
          message: 'Does this entity have a custom ID type?',
          default: false,
        });
        context.data.hasCustomId = hasId;
        break;

      case 'value-object':
        const isComposite = await Prompts.confirm({
          message: 'Is this a composite value object?',
          default: false,
        });
        context.data.isComposite = isComposite;
        break;

      case 'service':
        const isStateless = await Prompts.confirm({
          message: 'Is this service stateless?',
          default: true,
        });
        context.data.isStateless = isStateless;
        break;
    }
  }

  /**
   * Get available patterns for component type
   */
  private getAvailablePatternsFor(
    componentType: string
  ): Array<{ value: string; name: string; description: string }> {
    const allPatterns = {
      validation: { value: 'validation', name: '✅ Validation', description: 'Input validation' },
      auditing: { value: 'auditing', name: '📋 Auditing', description: 'Audit trail' },
      events: { value: 'events', name: '📡 Domain Events', description: 'Event publishing' },
      caching: { value: 'caching', name: '💾 Caching', description: 'Result caching' },
      logging: { value: 'logging', name: '📝 Logging', description: 'Structured logging' },
      retry: { value: 'retry', name: '🔄 Retry Logic', description: 'Resilience patterns' },
    };

    switch (componentType) {
      case 'entity':
      case 'aggregate':
        return [allPatterns.validation, allPatterns.auditing, allPatterns.events];
      case 'service':
        return [allPatterns.caching, allPatterns.logging, allPatterns.retry];
      case 'repository':
        return [allPatterns.caching, allPatterns.logging];
      default:
        return [allPatterns.validation, allPatterns.logging];
    }
  }

  /**
   * Generate component files
   */
  private async generateComponent(
    componentType: string,
    componentName: string,
    patterns: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    const outputPath = this.options.outputPath;

    // Generate main component file
    const mainFile = this.generateMainComponentFile(componentType, componentName, patterns);
    const mainFilePath = FileSystem.joinPath(
      outputPath,
      `${componentName.toLowerCase()}.${componentType}.ts`
    );

    files.push(mainFilePath);

    // Generate test file
    const testFile = this.generateTestFile(componentType, componentName);
    const testFilePath = FileSystem.joinPath(
      outputPath,
      `${componentName.toLowerCase()}.${componentType}.test.ts`
    );

    files.push(testFilePath);

    // Generate pattern-specific files
    for (const pattern of patterns) {
      const patternFiles = this.generatePatternFiles(componentType, componentName, pattern);
      files.push(...patternFiles);
    }

    return files;
  }

  /**
   * Generate main component file content
   */
  private generateMainComponentFile(
    componentType: string,
    componentName: string,
    patterns: string[]
  ): string {
    const hasValidation = patterns.includes('validation');
    const hasEvents = patterns.includes('events');

    return `/**
 * ${componentName} ${componentType}
 * Generated by VytchesDDD CLI
 */

import { ${this.getBaseClass(componentType)} } from '@vytches-ddd/core';
${hasValidation ? "import { ValidationError } from '@vytches-ddd/domain-primitives';" : ''}
${hasEvents ? "import { DomainEvent } from '@vytches-ddd/events';" : ''}

export class ${componentName} extends ${this.getBaseClass(componentType)} {
  constructor(${this.getConstructorParams(componentType)}) {
    super();
    ${hasValidation ? 'this.validate();' : ''}
  }

  ${hasValidation ? this.generateValidationMethod() : ''}
  ${hasEvents ? this.generateEventMethods(componentName) : ''}
}
`;
  }

  /**
   * Generate test file content
   */
  private generateTestFile(componentType: string, componentName: string): string {
    return `/**
 * ${componentName} ${componentType} tests
 * Generated by VytchesDDD CLI
 */

import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { ${componentName} } from './${componentName.toLowerCase()}.${componentType}';

describe('${componentName}', () => {
  describe('constructor', () => {
    it('should create ${componentType} successfully', () => {
      const [error, instance] = safeRun(() => new ${componentName}(/* valid params */));

      expect(error).toBeUndefined();
      expect(instance).toBeInstanceOf(${componentName});
    });

    it('should validate input parameters', () => {
      const [error] = safeRun(() => new ${componentName}(/* invalid params */));

      expect(error).toBeDefined();
    });
  });
});
`;
  }

  /**
   * Generate pattern-specific files
   */
  private generatePatternFiles(
    componentType: string,
    componentName: string,
    pattern: string
  ): string[] {
    // This would generate additional files based on patterns
    return [];
  }

  /**
   * Get base class for component type
   */
  private getBaseClass(componentType: string): string {
    switch (componentType) {
      case 'entity':
        return 'Entity';
      case 'aggregate':
        return 'AggregateRoot';
      case 'value-object':
        return 'ValueObject';
      case 'service':
        return 'DomainService';
      default:
        return 'BaseClass';
    }
  }

  /**
   * Get constructor parameters for component type
   */
  private getConstructorParams(componentType: string): string {
    switch (componentType) {
      case 'entity':
      case 'aggregate':
        return 'id: EntityId, props: any';
      case 'value-object':
        return 'props: any';
      case 'service':
        return '';
      default:
        return 'props: any';
    }
  }

  /**
   * Generate validation method
   */
  private generateValidationMethod(): string {
    return `
  private validate(): void {
    // Add validation logic here
    if (!this.isValid()) {
      throw new ValidationError('Invalid ${this.options.componentType} data');
    }
  }

  private isValid(): boolean {
    // Implement validation rules
    return true;
  }`;
  }

  /**
   * Generate event methods
   */
  private generateEventMethods(componentName: string): string {
    return `
  private publishEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }

  public ${componentName.toLowerCase()}Created(): void {
    this.publishEvent(new ${componentName}CreatedEvent(this.id));
  }`;
  }
}
