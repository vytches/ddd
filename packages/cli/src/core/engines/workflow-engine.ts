/* eslint-disable no-case-declarations */
/**
 * @fileoverview Workflow Engine - Interactive workflow system
 * AI-assisted workflow management for complex CLI operations
 */

import type { WorkflowStep, WorkflowContext } from '../../types';
import { CLIError } from '../../types';
import { Prompts } from '../utils/prompts';
import { Colors } from '../utils/colors';
import { Performance } from '../utils/performance';

/**
 * @llm-summary WorkflowEngine class for workflow engine operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * WorkflowEngine class implementing infrastructure service for workflow engine operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new WorkflowEngine();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new WorkflowEngine());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class WorkflowEngine {
  private steps = new Map<string, WorkflowStep>();
  private context: WorkflowContext;
  private currentStep: string | null = null;
  private completed = new Set<string>();

  constructor(initialContext: Partial<WorkflowContext> = {}) {
    this.context = {
      answers: {},
      config: {} as any, // Will be injected
      outputPath: './src',
      ...initialContext,
    };
  }

  /**
   * Create workflow engine instance
   */
  static create(initialContext?: Partial<WorkflowContext>): WorkflowEngine {
    return new WorkflowEngine(initialContext);
  }

  /**
   * Register a workflow step
   */
  registerStep(step: WorkflowStep): void {
    this.steps.set(step.id, step);
  }

  /**
   * Register multiple workflow steps
   */
  registerSteps(steps: WorkflowStep[]): void {
    steps.forEach(step => this.registerStep(step));
  }

  /**
   * Start workflow from specified step
   */
  async start(startStepId: string): Promise<WorkflowContext> {
    if (!this.steps.has(startStepId)) {
      throw new CLIError(`Workflow step not found: ${startStepId}`);
    }

    this.currentStep = startStepId;

    console.log(Colors.bold(Colors.cyan('🎯 VytchesDDD Workflow Started')));
    console.log('');

    try {
      while (this.currentStep) {
        await this.executeStep(this.currentStep);
      }

      console.log('');
      console.log(Colors.success('Workflow completed successfully!'));

      return this.context;
    } catch (error) {
      console.log('');
      console.error(
        Colors.error(`Workflow failed: ${error instanceof Error ? error.message : error}`)
      );
      throw error;
    } finally {
      Prompts.close();
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(stepId: string): Promise<void> {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new CLIError(`Workflow step not found: ${stepId}`);
    }

    // Skip if already completed (for branching workflows)
    if (this.completed.has(stepId)) {
      this.currentStep = this.getNextStep(step);
      return;
    }

    const startTime = Performance.now();

    try {
      console.log(Colors.bold(`📋 ${step.title}`));
      if (step.description) {
        console.log(Colors.dim(step.description));
      }
      console.log('');

      // Execute step based on type
      switch (step.type) {
        case 'prompt':
          await this.executePromptStep(step);
          break;
        case 'action':
          await this.executeActionStep(step);
          break;
        case 'decision':
          await this.executeDecisionStep(step);
          break;
        case 'completion':
          await this.executeCompletionStep(step);
          break;
        default:
          throw new CLIError(`Unknown step type: ${step.type}`);
      }

      // Mark step as completed
      this.completed.add(stepId);

      // Move to next step
      this.currentStep = this.getNextStep(step);

      // Show progress
      if (this.context.config.debug) {
        const duration = Performance.since(startTime);
        console.log(Colors.dim(`Step completed in ${duration.toFixed(1)}ms`));
      }

      console.log('');
    } catch (error) {
      throw new CLIError(
        `Failed to execute step '${step.title}': ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Execute prompt step
   */
  private async executePromptStep(step: WorkflowStep): Promise<void> {
    if (!step.prompt) {
      throw new CLIError(`Prompt step '${step.id}' missing prompt configuration`);
    }

    const prompt = step.prompt;
    let answer: any;

    switch (prompt.type) {
      case 'input':
        answer = await Prompts.ask({
          message: prompt.message,
          ...(prompt.default && { default: prompt.default }),
          ...(prompt.validate && { validate: prompt.validate }),
        });
        break;

      case 'select':
        if (!prompt.choices) {
          throw new CLIError(`Select prompt '${step.id}' missing choices`);
        }

        const rawChoices =
          typeof prompt.choices === 'function' ? prompt.choices(this.context) : prompt.choices;

        const choices = Array.isArray(rawChoices)
          ? rawChoices.map(choice =>
              typeof choice === 'string' ? { name: choice, value: choice } : choice
            )
          : [];

        answer = await Prompts.select({
          message: prompt.message,
          choices,
          default: prompt.default,
        });
        break;

      case 'multiselect':
        if (!prompt.choices) {
          throw new CLIError(`Multi-select prompt '${step.id}' missing choices`);
        }

        const rawMultiChoices =
          typeof prompt.choices === 'function' ? prompt.choices(this.context) : prompt.choices;

        const multiChoices = Array.isArray(rawMultiChoices)
          ? rawMultiChoices.map(choice =>
              typeof choice === 'string' ? { name: choice, value: choice } : choice
            )
          : [];

        answer = await Prompts.multiSelect({
          message: prompt.message,
          choices: multiChoices,
        });
        break;

      case 'confirm':
        answer = await Prompts.confirm({
          message: prompt.message,
          default: prompt.default,
        });
        break;

      case 'password':
        answer = await Prompts.password({
          message: prompt.message,
          ...(prompt.validate && { validate: prompt.validate }),
        });
        break;

      default:
        throw new CLIError(`Unknown prompt type: ${prompt.type}`);
    }

    // Store answer in context
    this.context.answers[step.id] = answer;
  }

  /**
   * Execute action step
   */
  private async executeActionStep(step: WorkflowStep): Promise<void> {
    if (!step.action) {
      throw new CLIError(`Action step '${step.id}' missing action function`);
    }

    const spinner = Prompts.spinner(`Executing ${step.title}...`);
    spinner.start();

    try {
      await step.action(this.context);
      spinner.stop();
      console.log(Colors.success(`${step.title} completed`));
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }

  /**
   * Execute decision step
   */
  private async executeDecisionStep(step: WorkflowStep): Promise<void> {
    // Decision steps use the next field to determine branching
    // The logic is handled in getNextStep
    console.log(Colors.info(`Decision: ${step.title}`));
  }

  /**
   * Execute completion step
   */
  private async executeCompletionStep(step: WorkflowStep): Promise<void> {
    console.log(Colors.success(step.title));

    if (step.action) {
      await step.action(this.context);
    }

    // Completion steps end the workflow
    this.currentStep = null;
  }

  /**
   * Get next step based on current step configuration
   */
  private getNextStep(step: WorkflowStep): string | null {
    if (!step.next) {
      return null;
    }

    if (typeof step.next === 'string') {
      return step.next;
    }

    if (typeof step.next === 'function') {
      return step.next(this.context);
    }

    return null;
  }

  /**
   * Update workflow context
   */
  updateContext(updates: Partial<WorkflowContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Get current workflow context
   */
  getContext(): WorkflowContext {
    return { ...this.context };
  }

  /**
   * Get workflow progress
   */
  getProgress(): {
    total: number;
    completed: number;
    current: string | null;
    percentage: number;
  } {
    const total = this.steps.size;
    const completed = this.completed.size;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      current: this.currentStep,
      percentage,
    };
  }

  /**
   * Reset workflow state
   */
  reset(): void {
    this.currentStep = null;
    this.completed.clear();
    this.context.answers = {};
  }

  /**
   * Create domain modeling workflow
   */
  static createDomainModelingWorkflow(): WorkflowEngine {
    const workflow = new WorkflowEngine();

    workflow.registerSteps([
      {
        id: 'domain-description',
        title: 'Domain Description',
        description: 'Describe your business domain in natural language',
        type: 'prompt',
        prompt: {
          type: 'input',
          message: 'Describe your business domain',
          validate: input =>
            input.length > 10 || 'Please provide a detailed description (at least 10 characters)',
        },
        next: 'domain-name',
      },
      {
        id: 'domain-name',
        title: 'Domain Name',
        description: 'Choose a name for your domain',
        type: 'prompt',
        prompt: {
          type: 'input',
          message: 'What is the name of your domain?',
          validate: input =>
            /^[A-Za-z][A-Za-z0-9\s]*$/.test(input) ||
            'Domain name must start with a letter and contain only letters, numbers, and spaces',
        },
        next: 'architecture-type',
      },
      {
        id: 'architecture-type',
        title: 'Architecture Type',
        description: 'Select your preferred architecture pattern',
        type: 'prompt',
        prompt: {
          type: 'select',
          message: 'Choose architecture pattern',
          choices: [
            {
              name: 'Clean Architecture',
              value: 'clean-architecture',
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
              name: 'Modular Monolith',
              value: 'modular-monolith',
              description: 'Single deployment with module boundaries',
            },
            {
              name: 'Microservices',
              value: 'microservices',
              description: 'Distributed services architecture',
            },
          ],
          default: 0,
        },
        next: 'framework-selection',
      },
      {
        id: 'framework-selection',
        title: 'Framework Selection',
        description: 'Choose your application framework',
        type: 'prompt',
        prompt: {
          type: 'select',
          message: 'Select application framework',
          choices: [
            {
              name: 'NestJS',
              value: 'nestjs',
              description: 'Enterprise Node.js framework with decorators',
            },
            {
              name: 'Express.js',
              value: 'express',
              description: 'Minimal and flexible Node.js framework',
            },
            {
              name: 'Fastify',
              value: 'fastify',
              description: 'Fast and low overhead web framework',
            },
            {
              name: 'Standalone',
              value: 'standalone',
              description: 'No specific framework, pure TypeScript',
            },
          ],
          default: 0,
        },
        next: 'advanced-patterns',
      },
      {
        id: 'advanced-patterns',
        title: 'Advanced Patterns',
        description: 'Select advanced DDD patterns to include',
        type: 'prompt',
        prompt: {
          type: 'multiselect',
          message: 'Select advanced patterns (optional)',
          choices: [
            {
              name: 'CQRS',
              value: 'cqrs',
              description: 'Command Query Responsibility Segregation',
            },
            {
              name: 'Event Sourcing',
              value: 'event-sourcing',
              description: 'Store events as source of truth',
            },
            {
              name: 'Saga Orchestration',
              value: 'saga',
              description: 'Long-running business processes',
            },
            {
              name: 'Projections',
              value: 'projections',
              description: 'Read model generation from events',
            },
            { name: 'Outbox Pattern', value: 'outbox', description: 'Reliable event publishing' },
            {
              name: 'Anti-Corruption Layer',
              value: 'acl',
              description: 'Legacy system integration',
            },
          ],
        },
        next: 'generate-domain',
      },
      {
        id: 'generate-domain',
        title: 'Generate Domain',
        description: 'Generate the complete domain implementation',
        type: 'action',
        action: async context => {
          // Domain generation logic will be implemented here
          console.log(Colors.info('Generating domain with configuration:'));
          console.log(JSON.stringify(context.answers, null, 2));
        },
        next: 'completion',
      },
      {
        id: 'completion',
        title: '🎉 Domain Generation Complete!',
        description: 'Your domain has been successfully generated',
        type: 'completion',
      },
    ]);

    return workflow;
  }

  /**
   * Create component generation workflow
   */
  static createComponentWorkflow(): WorkflowEngine {
    const workflow = new WorkflowEngine();

    workflow.registerSteps([
      {
        id: 'component-type',
        title: 'Component Type',
        description: 'Select the type of component to generate',
        type: 'prompt',
        prompt: {
          type: 'select',
          message: 'What type of component would you like to generate?',
          choices: [
            {
              name: 'Aggregate',
              value: 'aggregate',
              description: 'Domain aggregate with business logic',
            },
            { name: 'Entity', value: 'entity', description: 'Domain entity with identity' },
            { name: 'Value Object', value: 'value-object', description: 'Immutable value object' },
            {
              name: 'Specification',
              value: 'specification',
              description: 'Business rule specification',
            },
            { name: 'Policy', value: 'policy', description: 'Business policy' },
            { name: 'Command', value: 'command', description: 'CQRS command' },
            { name: 'Query', value: 'query', description: 'CQRS query' },
            { name: 'Event', value: 'event', description: 'Domain event' },
          ],
        },
        next: 'component-name',
      },
      {
        id: 'component-name',
        title: 'Component Name',
        description: 'Enter the name for your component',
        type: 'prompt',
        prompt: {
          type: 'input',
          message: 'Component name (PascalCase)',
          validate: input =>
            /^[A-Z][a-zA-Z0-9]*$/.test(input) ||
            'Name must be in PascalCase (e.g., OrderAggregate)',
        },
        next: 'generate-component',
      },
      {
        id: 'generate-component',
        title: 'Generate Component',
        description: 'Generating your component',
        type: 'action',
        action: async context => {
          // Component generation logic will be implemented here
          const { 'component-type': type, 'component-name': name } = context.answers;
          console.log(Colors.info(`Generating ${type}: ${name}`));
        },
        next: 'completion',
      },
      {
        id: 'completion',
        title: '✅ Component Generated Successfully!',
        description: 'Your component has been created',
        type: 'completion',
      },
    ]);

    return workflow;
  }
}
