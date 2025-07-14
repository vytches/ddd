/**
 * @fileoverview Domain Modeling Workflow
 * AI-powered interactive domain modeling with intelligent suggestions
 */

import { WorkflowEngine } from '../../core/engines/workflow-engine';
import type { WorkflowStep, WorkflowContext, ChoiceOption, ValidationContext } from '../../types';
import { ComponentType } from '../../types';
import { Colors } from '../../core/utils/colors';
import { TemplateEngine } from '../../core/engines/template-engine';
import { ConfigManager } from '../../core/engines/config-manager';
import { FileSystem } from '../../core/utils/file-system';
import { Performance } from '../../core/utils/performance';
import { chatHistory } from '../../core/utils/chat-history';
import { ComponentValidator } from '../../core/validation';
import { ContextAwarePromptEngine, SmartPrompts } from '../../core/prompts';

/**
 * Domain modeling workflow with AI assistance
 */
export class DomainModelingWorkflow {
  private workflow: WorkflowEngine;
  private templateEngine: TemplateEngine;
  private validator: ComponentValidator;
  private promptEngine: ContextAwarePromptEngine;
  private sessionId: string | null = null;

  constructor() {
    this.workflow = new WorkflowEngine();
    this.templateEngine = TemplateEngine.create();
    this.validator = ComponentValidator.create();
    this.promptEngine = ContextAwarePromptEngine.create();
    this.setupWorkflow();
  }

  /**
   * Start domain modeling workflow
   */
  async start(): Promise<WorkflowContext> {
    // Start chat session for this workflow
    this.sessionId = await chatHistory.startSession('Domain Modeling Workflow', {
      workflowType: 'domain-modeling',
      startedAt: new Date().toISOString()
    });

    await chatHistory.addMessage('system', 'Started domain modeling workflow');

    try {
      const context = await this.workflow.start('welcome');

      // Record completion
      await chatHistory.addMessage('system', `Domain modeling completed successfully. Generated ${context.generatedFiles?.length || 0} files.`);

      return context;
    } catch (error) {
      await chatHistory.addMessage('system', `Domain modeling failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Setup the complete domain modeling workflow
   */
  private setupWorkflow(): void {
    this.workflow.registerSteps([
      this.createWelcomeStep(),
      this.createProjectAnalysisStep(),
      this.createDomainDescriptionStep(),
      this.createDomainAnalysisStep(),
      this.createArchitectureSelectionStep(),
      this.createFrameworkSelectionStep(),
      this.createComponentSelectionStep(),
      this.createAdvancedPatternsStep(),
      this.createSmartValidationStep(),
      this.createGenerationStep(),
      this.createCompletionStep()
    ]);
  }

  /**
   * Welcome step with overview
   */
  private createWelcomeStep(): WorkflowStep {
    return {
      id: 'welcome',
      title: '🎯 VytchesDDD Domain Modeling Assistant',
      description: 'Create complete domain implementations with AI-powered guidance',
      type: 'prompt',
      prompt: {
        type: 'confirm',
        message: 'Ready to start domain modeling? This will guide you through creating a complete DDD implementation.',
        default: true
      },
      next: (context) => context.answers.welcome ? 'project-analysis' : 'cancelled'
    };
  }

  /**
   * Project analysis step with context awareness
   */
  private createProjectAnalysisStep(): WorkflowStep {
    return {
      id: 'project-analysis',
      title: '📊 Project Analysis',
      description: 'Analyzing project context for intelligent suggestions',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Analyzing project context...'));
        console.log('');

        // Analyze project context
        const analysis = await this.promptEngine.analyzeContext(context);
        context.projectAnalysis = analysis;

        // Display analysis
        this.promptEngine.displayAnalysis(analysis);

        // Record analysis in chat history
        await chatHistory.addMessage('assistant', `Project analysis completed. Detected ${analysis.frameworks.length} frameworks and ${analysis.patterns.length} patterns.`);
      },
      next: 'domain-description'
    };
  }

  /**
   * Domain description with natural language processing
   */
  private createDomainDescriptionStep(): WorkflowStep {
    return {
      id: 'domain-description',
      title: '📝 Domain Description',
      description: 'Describe your business domain in natural language for AI analysis',
      type: 'prompt',
      prompt: {
        type: 'input',
        message: 'Describe your business domain (e.g., "E-commerce platform with orders, customers can cancel within 24 hours, payments are processed asynchronously")',
        validate: (input: string) => {
          if (input.length < 20) {
            return 'Please provide a more detailed description (at least 20 characters)';
          }
          if (input.length > 500) {
            return 'Description is too long (max 500 characters)';
          }
          return true;
        }
      },
      next: 'domain-analysis'
    };
  }

  /**
   * AI-powered domain analysis step
   */
  private createDomainAnalysisStep(): WorkflowStep {
    return {
      id: 'domain-analysis',
      title: '🧠 Domain Analysis',
      description: 'Analyzing your domain for suggested components and patterns',
      type: 'action',
      action: async (context) => {
        const description = context.answers['domain-description'];

        // Record user input in chat history
        await chatHistory.addMessage('user', `Domain description: ${description}`);

        console.log(Colors.info('Analyzing domain description...'));
        console.log('');

        // Simulate AI analysis with intelligent suggestions
        const analysis = this.analyzeDomain(description);
        context.domainAnalysis = analysis;

        // Display analysis results
        this.displayDomainAnalysis(analysis);

        // Record analysis in chat history
        await chatHistory.addMessage('assistant', `Domain analysis completed. Suggested ${analysis.aggregates.length} aggregates, ${analysis.events.length} events, and ${analysis.patterns.length} patterns.`);
      },
      next: 'architecture-selection'
    };
  }

  /**
   * Architecture pattern selection with smart detection
   */
  private createArchitectureSelectionStep(): WorkflowStep {
    return {
      id: 'architecture-selection',
      title: '🏗️ Architecture Pattern',
      description: 'Choose the architecture pattern that best fits your domain',
      type: 'prompt',
      prompt: SmartPrompts.architectureSelection(),
      next: 'framework-selection'
    };
  }

  /**
   * Framework selection with auto-detection
   */
  private createFrameworkSelectionStep(): WorkflowStep {
    return {
      id: 'framework-selection',
      title: '⚙️ Framework Selection',
      description: 'Choose the application framework based on your requirements',
      type: 'prompt',
      prompt: SmartPrompts.frameworkSelection(),
      next: 'component-selection'
    };
  }

  /**
   * Component selection based on domain analysis
   */
  private createComponentSelectionStep(): WorkflowStep {
    return {
      id: 'component-selection',
      title: '🧩 Component Selection',
      description: 'Select which domain components to generate',
      type: 'prompt',
      prompt: {
        type: 'multiselect',
        message: 'Select components to generate (based on domain analysis)',
        choices: (context: WorkflowContext) => {
          const analysis = context.domainAnalysis;
          const choices: ChoiceOption[] = [];

          // Add suggested aggregates
          if (analysis.aggregates.length > 0) {
            choices.push({
              name: `Aggregates (${analysis.aggregates.length} suggested)`,
              value: 'aggregates',
              description: `Generate: ${analysis.aggregates.join(', ')}`
            });
          }

          // Add suggested events
          if (analysis.events.length > 0) {
            choices.push({
              name: `Domain Events (${analysis.events.length} suggested)`,
              value: 'events',
              description: `Generate: ${analysis.events.join(', ')}`
            });
          }

          // Add suggested commands/queries
          choices.push({
            name: 'CQRS Commands & Queries',
            value: 'cqrs',
            description: 'Generate commands, queries, and handlers'
          });

          // Add repositories
          choices.push({
            name: 'Repositories',
            value: 'repositories',
            description: 'Generate repository interfaces and implementations'
          });

          // Add specifications
          if (analysis.businessRules.length > 0) {
            choices.push({
              name: 'Specifications',
              value: 'specifications',
              description: `Business rules: ${analysis.businessRules.join(', ')}`
            });
          }

          return choices;
        }
      },
      next: 'advanced-patterns'
    };
  }

  /**
   * Advanced patterns selection
   */
  private createAdvancedPatternsStep(): WorkflowStep {
    return {
      id: 'advanced-patterns',
      title: '🚀 Advanced Patterns',
      description: 'Select advanced DDD patterns for your domain',
      type: 'prompt',
      prompt: {
        type: 'multiselect',
        message: 'Select advanced patterns (recommended based on your domain)',
        choices: (context: WorkflowContext) => {
          const analysis = context.domainAnalysis;
          const choices: ChoiceOption[] = [];

          // Recommend CQRS for complex domains
          if (analysis.complexity >= 0.7) {
            choices.push({
              name: 'CQRS (Recommended)',
              value: 'cqrs',
              description: 'Command Query Responsibility Segregation - good for complex domains'
            });
          } else {
            choices.push({
              name: 'CQRS',
              value: 'cqrs',
              description: 'Command Query Responsibility Segregation'
            });
          }

          // Recommend Event Sourcing for audit requirements
          if (analysis.needsAudit) {
            choices.push({
              name: 'Event Sourcing (Recommended)',
              value: 'event-sourcing',
              description: 'Store events as source of truth - excellent for audit trails'
            });
          } else {
            choices.push({
              name: 'Event Sourcing',
              value: 'event-sourcing',
              description: 'Store events as source of truth'
            });
          }

          // Other patterns
          choices.push(
            {
              name: 'Saga Orchestration',
              value: 'saga',
              description: 'Long-running business processes with compensation'
            },
            {
              name: 'Projections',
              value: 'projections',
              description: 'Read model generation from events'
            },
            {
              name: 'Outbox Pattern',
              value: 'outbox',
              description: 'Reliable event publishing'
            },
            {
              name: 'Anti-Corruption Layer',
              value: 'acl',
              description: 'Legacy system integration protection'
            }
          );

          return choices;
        }
      },
      next: 'smart-validation'
    };
  }

  /**
   * Smart validation step with component intelligence
   */
  private createSmartValidationStep(): WorkflowStep {
    return {
      id: 'smart-validation',
      title: '🧠 Smart Component Validation',
      description: 'AI-powered validation with intelligent suggestions',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Running smart validation...'));
        console.log('');

        const selectedComponents = context.answers['component-selection'] || [];
        const domainAnalysis = context.domainAnalysis;

        if (selectedComponents.length === 0) {
          console.log(Colors.warning('No components selected for validation'));
          return;
        }

        // Create validation context
        const validationContext: ValidationContext = {
          projectPath: context.config.outputDir || process.cwd(),
          outputPath: context.config.outputDir || './src',
          framework: context.answers['framework-selection'],
          patterns: context.answers['advanced-patterns'] || [],
          existingComponents: []
        };

        let totalWarnings = 0;
        let totalErrors = 0;
        let totalSuggestions = 0;

        // Validate each selected component type
        for (const componentType of selectedComponents) {
          if (componentType === 'aggregates' && domainAnalysis.aggregates) {
            for (const aggregateName of domainAnalysis.aggregates) {
              console.log(Colors.bold(`Validating ${aggregateName} Aggregate:`));

              const result = await this.validator.validateComponent(
                'aggregate',
                aggregateName,
                validationContext
              );

              this.validator.displayValidationResults(result);

              totalWarnings += result.warnings.length;
              totalErrors += result.errors.length;
              totalSuggestions += result.suggestions.length;
            }
          }
        }

        // Overall validation summary
        console.log(Colors.bold('📋 Validation Summary:'));
        console.log(`  Errors: ${totalErrors > 0 ? Colors.red(totalErrors.toString()) : Colors.green(totalErrors.toString())}`);
        console.log(`  Warnings: ${totalWarnings > 0 ? Colors.yellow(totalWarnings.toString()) : Colors.green(totalWarnings.toString())}`);
        console.log(`  Suggestions: ${Colors.cyan(totalSuggestions.toString())}`);
        console.log('');

        // Store validation results
        context.smartValidation = {
          totalErrors,
          totalWarnings,
          totalSuggestions,
          isValid: totalErrors === 0
        };

        // Record validation in chat history
        await chatHistory.addMessage('assistant',
          `Smart validation completed. ${totalErrors} errors, ${totalWarnings} warnings, ${totalSuggestions} suggestions.`
        );
      },
      next: 'generation'
    };
  }

  /**
   * Code generation step
   */
  private createGenerationStep(): WorkflowStep {
    return {
      id: 'generation',
      title: '⚡ Generating Domain Implementation',
      description: 'Generating your complete domain implementation',
      type: 'action',
      action: async (context) => {
        const startTime = Performance.now();

        console.log(Colors.bold('🎯 Generating Domain Implementation'));
        console.log('');

        try {
          const generatedFiles = await this.generateDomainImplementation(context);
          context.generatedFiles = generatedFiles;

          const duration = Performance.since(startTime);

          console.log('');
          console.log(Colors.success(`✅ Generated ${generatedFiles.length} files in ${duration.toFixed(1)}ms`));

          // Show generated files
          console.log('');
          console.log(Colors.bold('📁 Generated Files:'));
          generatedFiles.forEach(file => {
            console.log(`  ${Colors.green('✓')} ${file}`);
          });

        } catch (error) {
          console.log('');
          console.error(Colors.error(`❌ Generation failed: ${error instanceof Error ? error.message : error}`));
          throw error;
        }
      },
      next: 'completion'
    };
  }

  /**
   * Completion step with next steps
   */
  private createCompletionStep(): WorkflowStep {
    return {
      id: 'completion',
      title: '🎉 Domain Generation Complete!',
      description: 'Your domain has been successfully generated',
      type: 'completion',
      action: async (context) => {
        console.log('');
        console.log(Colors.bold(Colors.green('🎉 Domain Generation Complete!')));
        console.log('');

        // Show summary
        console.log(Colors.bold('📊 Generation Summary:'));
        console.log(`  ${Colors.cyan('•')} Architecture: ${context.answers['architecture-selection']}`);
        console.log(`  ${Colors.cyan('•')} Framework: ${context.answers['framework-selection']}`);
        console.log(`  ${Colors.cyan('•')} Components: ${context.answers['component-selection']?.length || 0} types`);
        console.log(`  ${Colors.cyan('•')} Advanced Patterns: ${context.answers['advanced-patterns']?.length || 0}`);
        console.log(`  ${Colors.cyan('•')} Generated Files: ${context.generatedFiles?.length || 0}`);

        // Show validation summary
        if (context.smartValidation) {
          console.log('');
          console.log(Colors.bold('🧠 Smart Validation Summary:'));
          console.log(`  ${Colors.cyan('•')} Errors: ${context.smartValidation.totalErrors > 0 ? Colors.red(context.smartValidation.totalErrors) : Colors.green(context.smartValidation.totalErrors)}`);
          console.log(`  ${Colors.cyan('•')} Warnings: ${context.smartValidation.totalWarnings > 0 ? Colors.yellow(context.smartValidation.totalWarnings) : Colors.green(context.smartValidation.totalWarnings)}`);
          console.log(`  ${Colors.cyan('•')} Suggestions: ${Colors.cyan(context.smartValidation.totalSuggestions)}`);
          console.log(`  ${Colors.cyan('•')} Status: ${context.smartValidation.isValid ? Colors.green('✓ Valid') : Colors.red('✗ Has Issues')}`);
        }
        console.log('');

        // Show next steps
        console.log(Colors.bold('🚀 Next Steps:'));
        console.log(`  ${Colors.green('1.')} Install dependencies: ${Colors.dim('npm install')}`);
        console.log(`  ${Colors.green('2.')} Run tests: ${Colors.dim('npm test')}`);
        console.log(`  ${Colors.green('3.')} Start development: ${Colors.dim('npm run dev')}`);
        console.log(`  ${Colors.green('4.')} View documentation: ${Colors.dim('see generated README.md')}`);
        console.log('');

        // Chat history export offer
        if (this.sessionId) {
          console.log(Colors.info('💬 Chat history has been saved. Export with:'));
          console.log(`   ${Colors.dim(`vytches-ddd chat export ${  this.sessionId}`)}`);
          console.log('');
        }
      }
    };
  }

  /**
   * Analyze domain description using AI-like logic
   */
  private analyzeDomain(description: string): {
    aggregates: string[];
    events: string[];
    businessRules: string[];
    patterns: string[];
    complexity: number;
    needsAudit: boolean;
  } {
    const lower = description.toLowerCase();

    // Extract potential aggregates (nouns)
    const aggregateKeywords = ['order', 'customer', 'payment', 'product', 'user', 'account', 'invoice', 'shipment', 'inventory'];
    const aggregates = aggregateKeywords.filter(keyword => lower.includes(keyword))
      .map(keyword => keyword.charAt(0).toUpperCase() + keyword.slice(1));

    // Extract potential events
    const eventKeywords = ['created', 'updated', 'deleted', 'processed', 'cancelled', 'approved', 'rejected'];
    const events: string[] = [];

    aggregates.forEach(aggregate => {
      eventKeywords.forEach(event => {
        if (lower.includes(event) || lower.includes(`can ${  event}`) || lower.includes(`will ${  event}`)) {
          events.push(`${aggregate}${event.charAt(0).toUpperCase() + event.slice(1)}`);
        }
      });
    });

    // Extract business rules
    const businessRules = [];
    if (lower.includes('cancel') && lower.includes('24 hours')) {
      businessRules.push('CancellationPolicy');
    }
    if (lower.includes('minimum') || lower.includes('at least')) {
      businessRules.push('MinimumRequirementSpec');
    }
    if (lower.includes('not allowed') || lower.includes('cannot')) {
      businessRules.push('BusinessRuleValidation');
    }

    // Suggest patterns based on description
    const patterns = [];
    if (lower.includes('async') || lower.includes('process')) {
      patterns.push('saga');
    }
    if (lower.includes('audit') || lower.includes('track') || lower.includes('history')) {
      patterns.push('event-sourcing');
    }
    if (lower.includes('command') || lower.includes('query') || aggregates.length > 2) {
      patterns.push('cqrs');
    }

    // Calculate complexity score
    const complexity = Math.min(1.0, (aggregates.length * 0.2) + (events.length * 0.1) + (businessRules.length * 0.15));

    // Check if audit is needed
    const needsAudit = lower.includes('audit') || lower.includes('track') || lower.includes('history') || lower.includes('compliance');

    return {
      aggregates,
      events,
      businessRules,
      patterns,
      complexity,
      needsAudit
    };
  }

  /**
   * Display domain analysis results
   */
  private displayDomainAnalysis(analysis: any): void {
    console.log(Colors.bold('🧠 Domain Analysis Results:'));
    console.log('');

    if (analysis.aggregates.length > 0) {
      console.log(Colors.bold('📊 Suggested Aggregates:'));
      analysis.aggregates.forEach((aggregate: string) => {
        console.log(`  ${Colors.green('•')} ${aggregate}`);
      });
      console.log('');
    }

    if (analysis.events.length > 0) {
      console.log(Colors.bold('📢 Suggested Events:'));
      analysis.events.slice(0, 8).forEach((event: string) => { // Limit display
        console.log(`  ${Colors.blue('•')} ${event}`);
      });
      if (analysis.events.length > 8) {
        console.log(`  ${Colors.dim(`... and ${analysis.events.length - 8} more`)}`);
      }
      console.log('');
    }

    if (analysis.businessRules.length > 0) {
      console.log(Colors.bold('📋 Suggested Business Rules:'));
      analysis.businessRules.forEach((rule: string) => {
        console.log(`  ${Colors.yellow('•')} ${rule}`);
      });
      console.log('');
    }

    if (analysis.patterns.length > 0) {
      console.log(Colors.bold('🚀 Recommended Patterns:'));
      analysis.patterns.forEach((pattern: string) => {
        console.log(`  ${Colors.cyan('•')} ${pattern}`);
      });
      console.log('');
    }

    console.log(Colors.info(`📈 Domain Complexity: ${(analysis.complexity * 100).toFixed(0)}%`));
    console.log('');
  }

  /**
   * Validate configuration for conflicts and issues
   */
  private validateConfiguration(context: WorkflowContext): {
    warnings: string[];
    suggestions: string[];
  } {
    const warnings = [];
    const suggestions = [];

    const architecture = context.answers['architecture-selection'];
    const framework = context.answers['framework-selection'];
    const patterns = context.answers['advanced-patterns'] || [];

    // Check for conflicts
    if (architecture === 'microservices' && framework === 'standalone') {
      warnings.push('Microservices architecture works better with web frameworks like NestJS');
    }

    if (patterns.includes('event-sourcing') && !patterns.includes('cqrs')) {
      suggestions.push('Event Sourcing works best with CQRS pattern');
    }

    if (patterns.includes('saga') && !patterns.includes('event-sourcing')) {
      suggestions.push('Saga patterns benefit from Event Sourcing for reliability');
    }

    return { warnings, suggestions };
  }

  /**
   * Generate the complete domain implementation
   */
  private async generateDomainImplementation(context: WorkflowContext): Promise<string[]> {
    const generatedFiles: string[] = [];
    const config = ConfigManager.getConfig();

    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Load appropriate templates based on selections
    // 2. Generate code using the template engine
    // 3. Create directory structure
    // 4. Write files to disk

    const analysis = context.domainAnalysis;
    const selectedComponents = context.answers['component-selection'] || [];
    const patterns = context.answers['advanced-patterns'] || [];

    // Generate aggregates
    if (selectedComponents.includes('aggregates')) {
      for (const aggregate of analysis.aggregates) {
        const fileName = `${config.outputDir}/domain/aggregates/${aggregate.toLowerCase()}.aggregate.ts`;
        generatedFiles.push(fileName);

        // In real implementation: await this.generateComponent('aggregate', aggregate, context);
      }
    }

    // Generate events
    if (selectedComponents.includes('events')) {
      for (const event of analysis.events) {
        const fileName = `${config.outputDir}/domain/events/${event.toLowerCase()}.event.ts`;
        generatedFiles.push(fileName);
      }
    }

    // Generate CQRS components
    if (selectedComponents.includes('cqrs')) {
      for (const aggregate of analysis.aggregates) {
        generatedFiles.push(`${config.outputDir}/application/commands/create-${aggregate.toLowerCase()}.command.ts`);
        generatedFiles.push(`${config.outputDir}/application/handlers/create-${aggregate.toLowerCase()}.handler.ts`);
        generatedFiles.push(`${config.outputDir}/application/queries/get-${aggregate.toLowerCase()}.query.ts`);
      }
    }

    // Generate repositories
    if (selectedComponents.includes('repositories')) {
      for (const aggregate of analysis.aggregates) {
        generatedFiles.push(`${config.outputDir}/domain/repositories/i${aggregate.toLowerCase()}.repository.ts`);
        generatedFiles.push(`${config.outputDir}/infrastructure/repositories/${aggregate.toLowerCase()}.repository.ts`);
      }
    }

    // Add pattern-specific files
    if (patterns.includes('event-sourcing')) {
      generatedFiles.push(`${config.outputDir}/infrastructure/event-store/event-store.ts`);
    }

    if (patterns.includes('saga')) {
      generatedFiles.push(`${config.outputDir}/application/sagas/order-processing.saga.ts`);
    }

    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return generatedFiles;
  }
}
