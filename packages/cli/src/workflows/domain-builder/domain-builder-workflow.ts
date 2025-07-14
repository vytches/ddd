/**
 * @fileoverview Complete Domain Builder Workflow
 * Enterprise-grade domain generation with AI assistance, bounded contexts, and pattern detection
 */

import { WorkflowEngine } from '../../core/engines/workflow-engine';
import type { WorkflowStep, WorkflowContext, ChoiceOption } from '../../types';
import { Colors } from '../../core/utils/colors';
import { Performance } from '../../core/utils/performance';
import { chatHistory } from '../../core/utils/chat-history';
import { DomainAnalyzer } from './domain-analyzer';
import { BoundedContextMapper } from './bounded-context-mapper';
import { PatternOrchestrator } from './pattern-orchestrator';
import { NaturalLanguageProcessor } from './natural-language-processor';
import { FileSystem } from '../../core/utils/file-system';

/**
 * Domain builder configuration
 */
export interface DomainBuilderConfig {
  domainName: string | undefined;
  structure: string;
  framework: string;
  guided: boolean;
  patterns: string[];
  boundedContexts: string[];
  compliance: string[];
  security: string[];
  monitoring: boolean;
  dryRun: boolean;
}

/**
 * Domain builder result
 */
export interface DomainBuilderResult {
  generatedFiles: string[];
  plannedFiles: string[];
  boundedContexts: string[];
  patterns: string[];
  hasDatabase: boolean;
  hasMonitoring: boolean;
  claudeCodeIntegration?: {
    projectPath: string;
    entryPoints: string[];
    documentation: string[];
    setupInstructions: string[];
  };
}

/**
 * Complete domain builder workflow with AI assistance
 */
export class DomainBuilderWorkflow {
  private workflow: WorkflowEngine;
  private analyzer: DomainAnalyzer;
  private contextMapper: BoundedContextMapper;
  private patternOrchestrator: PatternOrchestrator;
  private nlpProcessor: NaturalLanguageProcessor;
  private sessionId: string | null = null;
  private config: DomainBuilderConfig;

  constructor(config: DomainBuilderConfig) {
    this.config = config;
    this.workflow = new WorkflowEngine();
    this.analyzer = new DomainAnalyzer();
    this.contextMapper = new BoundedContextMapper();
    this.patternOrchestrator = new PatternOrchestrator();
    this.nlpProcessor = new NaturalLanguageProcessor();
    this.setupWorkflow();
  }

  /**
   * Execute the complete domain building workflow
   */
  async execute(): Promise<DomainBuilderResult> {
    // Start chat session for this workflow
    this.sessionId = await chatHistory.startSession('Complete Domain Builder', {
      workflowType: 'domain-builder',
      config: this.config,
      startedAt: new Date().toISOString()
    });

    await chatHistory.addMessage('system', `Started domain building for: ${this.config.domainName || 'Unknown Domain'}`);

    try {
      const context = await this.workflow.start('initialization');

      // Extract result
      const result: DomainBuilderResult = {
        generatedFiles: context.generatedFiles || [],
        plannedFiles: context.plannedFiles || [],
        boundedContexts: context.boundedContexts || [],
        patterns: context.patterns || [],
        hasDatabase: context.hasDatabase || false,
        hasMonitoring: context.hasMonitoring || false,
        claudeCodeIntegration: context.claudeCodeIntegration
      };

      // Record completion
      await chatHistory.addMessage('system',
        `Domain building completed. Generated ${result.generatedFiles.length} files across ${result.boundedContexts.length} bounded contexts.`
      );

      return result;
    } catch (error) {
      await chatHistory.addMessage('system', `Domain building failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Setup the complete domain building workflow
   */
  private setupWorkflow(): void {
    this.workflow.registerSteps([
      this.createInitializationStep(),
      this.createDomainAnalysisStep(),
      this.createNaturalLanguageProcessingStep(),
      this.createBoundedContextMappingStep(),
      this.createArchitectureSelectionStep(),
      this.createPatternOrchestrationStep(),
      this.createFrameworkIntegrationStep(),
      this.createSecurityComplianceStep(),
      this.createGenerationPlanStep(),
      this.createFileGenerationStep(),
      this.createClaudeCodeIntegrationStep(),
      this.createCompletionStep()
    ]);
  }

  /**
   * Initialization step with configuration
   */
  private createInitializationStep(): WorkflowStep {
    return {
      id: 'initialization',
      title: '🎯 Domain Builder Initialization',
      description: 'Setting up domain generation environment',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Initializing domain builder...'));
        console.log('');

        // Setup context with configuration
        context.config = this.config as any;
        context.startTime = Performance.now();

        // Initialize analyzers
        context.analyzer = this.analyzer;
        context.contextMapper = this.contextMapper;
        context.patternOrchestrator = this.patternOrchestrator;
        context.nlpProcessor = this.nlpProcessor;

        // Record configuration in chat history
        await chatHistory.addMessage('assistant',
          `Initializing domain builder with structure: ${this.config.structure}, framework: ${this.config.framework}`
        );

        console.log(Colors.success('✅ Domain builder initialized'));
      },
      next: this.config.guided ? 'domain-analysis' : 'nlp-processing'
    };
  }

  /**
   * AI-powered domain analysis step
   */
  private createDomainAnalysisStep(): WorkflowStep {
    return {
      id: 'domain-analysis',
      title: '🧠 AI-Powered Domain Analysis',
      description: 'Analyzing domain requirements with intelligent assistance',
      type: 'prompt',
      prompt: {
        type: 'input',
        message: this.config.domainName
          ? `Describe your business domain for "${this.config.domainName}" in detail:`
          : 'Describe your business domain in detail (e.g., "E-commerce platform with orders, customers can cancel within 24 hours, payments are processed asynchronously"):',
        validate: (input: string) => {
          if (input.length < 50) {
            return 'Please provide a more detailed description (at least 50 characters) for better AI analysis';
          }
          if (input.length > 1000) {
            return 'Description is too long (max 1000 characters). Focus on key business concepts.';
          }
          return true;
        }
      },
      next: 'nlp-processing'
    };
  }

  /**
   * Natural Language Processing step for domain understanding
   */
  private createNaturalLanguageProcessingStep(): WorkflowStep {
    return {
      id: 'nlp-processing',
      title: '🔍 Natural Language Processing',
      description: 'AI analysis of domain description for intelligent component suggestion',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Analyzing domain description with AI...'));
        console.log('');

        const description = context.answers['domain-analysis'] || this.config.domainName || 'Generic Business Domain';

        // Record user input
        await chatHistory.addMessage('user', `Domain description: ${description}`);

        // Perform NLP analysis
        const nlpAnalysis = await this.nlpProcessor.analyzeDescription(description);
        context.nlpAnalysis = nlpAnalysis;

        // Display analysis results
        this.displayNLPAnalysis(nlpAnalysis);

        // Record analysis in chat history
        await chatHistory.addMessage('assistant',
          `NLP analysis completed. Identified ${nlpAnalysis.entities.length} entities, ${nlpAnalysis.processes.length} processes, and ${nlpAnalysis.relationships.length} relationships.`
        );
      },
      next: 'bounded-context-mapping'
    };
  }

  /**
   * Bounded context mapping with AI assistance
   */
  private createBoundedContextMappingStep(): WorkflowStep {
    return {
      id: 'bounded-context-mapping',
      title: '🗺️ Bounded Context Mapping',
      description: 'Intelligent bounded context identification and relationship mapping',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Mapping bounded contexts...'));
        console.log('');

        const nlpAnalysis = context.nlpAnalysis;

        // Generate bounded contexts from NLP analysis or config
        let boundedContexts;
        if (this.config.boundedContexts.length > 0) {
          boundedContexts = await this.contextMapper.validateContexts(this.config.boundedContexts, nlpAnalysis);
        } else {
          boundedContexts = await this.contextMapper.generateContexts(nlpAnalysis);
        }

        context.boundedContexts = boundedContexts;

        // Display context map
        this.displayBoundedContextMap(boundedContexts);

        // Record context mapping
        await chatHistory.addMessage('assistant',
          `Bounded context mapping completed. Identified ${boundedContexts.contexts.length} contexts with ${boundedContexts.relationships.length} relationships.`
        );
      },
      next: this.config.guided ? 'architecture-selection' : 'pattern-orchestration'
    };
  }

  /**
   * Architecture pattern selection step
   */
  private createArchitectureSelectionStep(): WorkflowStep {
    return {
      id: 'architecture-selection',
      title: '🏗️ Architecture Pattern Selection',
      description: 'Choose architecture pattern based on domain complexity',
      type: 'prompt',
      prompt: {
        type: 'select',
        message: 'Select architecture pattern (AI recommendation based on your domain):',
        choices: (context: WorkflowContext) => {
          const nlpAnalysis = context.nlpAnalysis;
          const choices: ChoiceOption[] = [];

          // AI recommendations based on complexity
          if (nlpAnalysis.complexity >= 0.8) {
            choices.push({
              name: 'Clean Architecture (AI Recommended)',
              value: 'clean-architecture',
              description: 'Best for complex domains with clear separation of concerns'
            });
          } else {
            choices.push({
              name: 'Clean Architecture',
              value: 'clean-architecture',
              description: 'Clear separation with domain/application/infrastructure layers'
            });
          }

          if (nlpAnalysis.entities.length > 10) {
            choices.push({
              name: 'Modular Monolith (AI Recommended)',
              value: 'modular-monolith',
              description: 'Good for large domains with clear module boundaries'
            });
          } else {
            choices.push({
              name: 'Modular Monolith',
              value: 'modular-monolith',
              description: 'Module-based organization within single deployable unit'
            });
          }

          if (context.boundedContexts.contexts.length >= 3) {
            choices.push({
              name: 'Microservices (AI Recommended)',
              value: 'microservices',
              description: 'Suitable for multiple bounded contexts with clear boundaries'
            });
          } else {
            choices.push({
              name: 'Microservices',
              value: 'microservices',
              description: 'Distributed architecture with service-per-bounded-context'
            });
          }

          choices.push(
            {
              name: 'Hexagonal Architecture',
              value: 'hexagonal',
              description: 'Ports and adapters pattern for external integration focus'
            },
            {
              name: 'Onion Architecture',
              value: 'onion',
              description: 'Concentric layers with domain at the center'
            }
          );

          return choices;
        }
      },
      next: 'pattern-orchestration'
    };
  }

  /**
   * Pattern orchestration with complete VytchesDDD support
   */
  private createPatternOrchestrationStep(): WorkflowStep {
    return {
      id: 'pattern-orchestration',
      title: '🚀 Advanced Pattern Orchestration',
      description: 'AI-powered selection of DDD patterns and enterprise features',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Orchestrating DDD patterns...'));
        console.log('');

        const nlpAnalysis = context.nlpAnalysis;
        const boundedContexts = context.boundedContexts;

        // Generate pattern recommendations
        const patternRecommendations = await this.patternOrchestrator.recommendPatterns(
          nlpAnalysis,
          boundedContexts,
          this.config.patterns
        );

        context.patternRecommendations = patternRecommendations;

        // Display pattern orchestration
        this.displayPatternOrchestration(patternRecommendations);

        // Record pattern selection
        await chatHistory.addMessage('assistant',
          `Pattern orchestration completed. Selected ${patternRecommendations.core.length} core patterns and ${patternRecommendations.advanced.length} advanced patterns.`
        );
      },
      next: 'framework-integration'
    };
  }

  /**
   * Framework integration step
   */
  private createFrameworkIntegrationStep(): WorkflowStep {
    return {
      id: 'framework-integration',
      title: '⚙️ Framework Integration',
      description: 'Setting up framework-specific integrations and configurations',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info(`Setting up ${this.config.framework} integration...`));
        console.log('');

        // Framework-specific setup
        const frameworkConfig = await this.setupFrameworkIntegration(context);
        context.frameworkConfig = frameworkConfig;

        console.log(Colors.success(`✅ ${this.config.framework} integration configured`));
      },
      next: this.config.compliance.length > 0 || this.config.security.length > 0
        ? 'security-compliance'
        : 'generation-plan'
    };
  }

  /**
   * Security and compliance step
   */
  private createSecurityComplianceStep(): WorkflowStep {
    return {
      id: 'security-compliance',
      title: '🔒 Security & Compliance',
      description: 'Implementing security features and compliance standards',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Setting up security and compliance features...'));
        console.log('');

        // Setup security features
        if (this.config.security.length > 0) {
          console.log(Colors.cyan('🛡️ Security Features:'));
          this.config.security.forEach(feature => {
            console.log(`  ${Colors.green('✓')} ${feature.toUpperCase()}`);
          });
          console.log('');
        }

        // Setup compliance standards
        if (this.config.compliance.length > 0) {
          console.log(Colors.cyan('📋 Compliance Standards:'));
          this.config.compliance.forEach(standard => {
            console.log(`  ${Colors.green('✓')} ${standard.toUpperCase()}`);
          });
          console.log('');
        }

        context.securityConfig = {
          features: this.config.security,
          compliance: this.config.compliance
        };
      },
      next: 'generation-plan'
    };
  }

  /**
   * Generation plan step
   */
  private createGenerationPlanStep(): WorkflowStep {
    return {
      id: 'generation-plan',
      title: '📋 Generation Plan',
      description: 'Creating comprehensive file generation plan',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Creating generation plan...'));
        console.log('');

        // Generate complete file plan
        const generationPlan = await this.createGenerationPlan(context);
        context.generationPlan = generationPlan;

        // Display plan summary
        console.log(Colors.bold('📊 Generation Plan Summary:'));
        console.log(`  Files to generate: ${Colors.cyan(generationPlan.files.length.toString())}`);
        console.log(`  Bounded contexts: ${Colors.cyan(context.boundedContexts.contexts.length.toString())}`);
        console.log(`  Patterns: ${Colors.cyan(context.patternRecommendations.core.length + context.patternRecommendations.advanced.length)}`);
        console.log(`  Framework: ${Colors.cyan(this.config.framework)}`);
        console.log(`  Structure: ${Colors.cyan(this.config.structure)}`);
        console.log('');

        if (this.config.dryRun) {
          context.plannedFiles = generationPlan.files.map((f: any) => f.path);
          console.log(Colors.yellow('🔍 Dry run mode - files will not be created'));
          console.log('');
        }
      },
      next: this.config.dryRun ? 'completion' : 'file-generation'
    };
  }

  /**
   * File generation step
   */
  private createFileGenerationStep(): WorkflowStep {
    return {
      id: 'file-generation',
      title: '⚡ File Generation',
      description: 'Generating complete domain implementation',
      type: 'action',
      action: async (context) => {
        console.log(Colors.bold('🎯 Generating Domain Implementation'));
        console.log('');

        const generationPlan = context.generationPlan;
        const generatedFiles: string[] = [];

        // Progress tracking
        let completed = 0;
        const total = generationPlan.files.length;

        for (const fileSpec of generationPlan.files) {
          try {
            // Generate file content
            const content = await this.generateFileContent(fileSpec, context);

            // Ensure directory exists
            const dir = FileSystem.getDirectoryName(fileSpec.path);
            await FileSystem.createDirectory(dir);

            // Write file
            await FileSystem.writeFile(fileSpec.path, content);
            generatedFiles.push(fileSpec.path);

            completed++;

            // Show progress
            const progress = Math.round((completed / total) * 100);
            process.stdout.write(`\r  Progress: ${Colors.cyan(`${progress}%`)} (${completed}/${total})`);

          } catch (error) {
            console.error(`\n  ${Colors.error(`Failed to generate ${fileSpec.path}: ${error}`)}`);
          }
        }

        console.log('\n');
        context.generatedFiles = generatedFiles;

        console.log(Colors.success(`✅ Generated ${generatedFiles.length} files successfully`));
      },
      next: 'claude-code-integration'
    };
  }

  /**
   * Claude Code integration step
   */
  private createClaudeCodeIntegrationStep(): WorkflowStep {
    return {
      id: 'claude-code-integration',
      title: '🤖 Claude Code Integration',
      description: 'Setting up Claude Code integration for enhanced development experience',
      type: 'action',
      action: async (context) => {
        console.log(Colors.info('Setting up Claude Code integration...'));
        console.log('');

        const projectPath = process.cwd();

        // Create Claude-friendly project structure info
        const claudeIntegration = {
          projectPath,
          entryPoints: this.getEntryPoints(context),
          documentation: this.generateDocumentation(context),
          setupInstructions: this.generateSetupInstructions(context)
        };

        // Create CLAUDE.md file for optimal Claude Code experience
        const claudeMdContent = this.generateClaudeMdContent(context, claudeIntegration);
        const claudeMdPath = FileSystem.joinPath(projectPath, 'CLAUDE.md');

        try {
          await FileSystem.writeFile(claudeMdPath, claudeMdContent);
          console.log(Colors.success('✅ Created CLAUDE.md for optimal Claude Code integration'));
        } catch (error) {
          console.log(Colors.warning('⚠️ Could not create CLAUDE.md file'));
        }

        // Create .cursorrules for Cursor IDE integration
        const cursorRulesContent = this.generateCursorRules(context);
        const cursorRulesPath = FileSystem.joinPath(projectPath, '.cursorrules');

        try {
          await FileSystem.writeFile(cursorRulesPath, cursorRulesContent);
          console.log(Colors.success('✅ Created .cursorrules for Cursor IDE integration'));
        } catch (error) {
          console.log(Colors.warning('⚠️ Could not create .cursorrules file'));
        }

        context.claudeCodeIntegration = claudeIntegration;
        console.log('');
      },
      next: 'completion'
    };
  }

  /**
   * Completion step with comprehensive summary
   */
  private createCompletionStep(): WorkflowStep {
    return {
      id: 'completion',
      title: '🎉 Domain Generation Complete!',
      description: 'Your enterprise domain has been successfully generated',
      type: 'completion',
      action: async (context) => {
        console.log('');
        console.log(Colors.bold(Colors.green('🎉 Complete Domain Generated Successfully!')));
        console.log('');

        // Show comprehensive summary
        console.log(Colors.bold('📊 Final Summary:'));
        console.log(`  ${Colors.cyan('•')} Domain: ${this.config.domainName || 'Generated Domain'}`);
        console.log(`  ${Colors.cyan('•')} Architecture: ${context.answers['architecture-selection'] || this.config.structure}`);
        console.log(`  ${Colors.cyan('•')} Framework: ${this.config.framework}`);
        console.log(`  ${Colors.cyan('•')} Bounded Contexts: ${context.boundedContexts?.contexts.length || 0}`);
        console.log(`  ${Colors.cyan('•')} Core Patterns: ${context.patternRecommendations?.core.length || 0}`);
        console.log(`  ${Colors.cyan('•')} Advanced Patterns: ${context.patternRecommendations?.advanced.length || 0}`);

        if (!this.config.dryRun) {
          console.log(`  ${Colors.cyan('•')} Generated Files: ${context.generatedFiles?.length || 0}`);
          console.log(`  ${Colors.cyan('•')} Claude Code Integration: ${Colors.green('✓ Ready')}`);
        }

        console.log('');

        // Show AI insights
        if (context.nlpAnalysis) {
          console.log(Colors.bold('🧠 AI Insights:'));
          console.log(`  ${Colors.cyan('•')} Domain Complexity: ${Math.round(context.nlpAnalysis.complexity * 100)}%`);
          console.log(`  ${Colors.cyan('•')} Entities Identified: ${context.nlpAnalysis.entities.length}`);
          console.log(`  ${Colors.cyan('•')} Business Processes: ${context.nlpAnalysis.processes.length}`);
          console.log(`  ${Colors.cyan('•')} Relationships Mapped: ${context.nlpAnalysis.relationships.length}`);
          console.log('');
        }

        // Show development workflow with Claude Code
        console.log(Colors.bold('🚀 Development Workflow:'));
        console.log(`  ${Colors.green('1.')} Open in Claude Code: ${Colors.dim('claude-code .')}`);
        console.log(`  ${Colors.green('2.')} Review CLAUDE.md: ${Colors.dim('Generated project documentation')}`);
        console.log(`  ${Colors.green('3.')} Install dependencies: ${Colors.dim('pnpm install')}`);
        console.log(`  ${Colors.green('4.')} Start development: ${Colors.dim('pnpm dev')}`);
        console.log(`  ${Colors.green('5.')} Run tests: ${Colors.dim('pnpm test')}`);
        console.log('');

        // Claude Code specific tips
        console.log(Colors.bold('🤖 Claude Code Tips:'));
        console.log(`  ${Colors.cyan('•')} Use ${Colors.dim('"Analyze domain model"')} to understand the architecture`);
        console.log(`  ${Colors.cyan('•')} Use ${Colors.dim('"Add new aggregate"')} to extend the domain`);
        console.log(`  ${Colors.cyan('•')} Use ${Colors.dim('"Review bounded contexts"')} to understand module boundaries`);
        console.log(`  ${Colors.cyan('•')} Use ${Colors.dim('"Generate tests for [component]"')} to add test coverage`);
        console.log('');

        // Chat history export offer
        if (this.sessionId) {
          console.log(Colors.info('💬 Complete workflow history saved. Export with:'));
          console.log(`   ${Colors.dim(`vytches-ddd chat export ${this.sessionId}`)}`);
          console.log('');
        }
      }
    };
  }

  // Helper methods (simplified implementations)
  private displayNLPAnalysis(analysis: any): void {
    console.log(Colors.bold('🧠 NLP Analysis Results:'));
    console.log('');

    if (analysis.entities.length > 0) {
      console.log(Colors.bold('📊 Identified Entities:'));
      analysis.entities.slice(0, 8).forEach((entity: string) => {
        console.log(`  ${Colors.green('•')} ${entity}`);
      });
      console.log('');
    }

    if (analysis.processes.length > 0) {
      console.log(Colors.bold('⚡ Business Processes:'));
      analysis.processes.slice(0, 5).forEach((process: string) => {
        console.log(`  ${Colors.blue('•')} ${process}`);
      });
      console.log('');
    }

    console.log(Colors.info(`📈 Domain Complexity: ${(analysis.complexity * 100).toFixed(0)}%`));
    console.log('');
  }

  private displayBoundedContextMap(contexts: any): void {
    console.log(Colors.bold('🗺️ Bounded Context Map:'));
    console.log('');

    contexts.contexts.forEach((context: any) => {
      console.log(`${Colors.cyan('●')} ${Colors.bold(context.name)}`);
      console.log(`   ${Colors.dim(context.description)}`);
      if (context.entities.length > 0) {
        console.log(`   Entities: ${context.entities.join(', ')}`);
      }
      console.log('');
    });
  }

  private displayPatternOrchestration(patterns: any): void {
    console.log(Colors.bold('🚀 Pattern Orchestration:'));
    console.log('');

    if (patterns.core.length > 0) {
      console.log(Colors.bold('Core Patterns:'));
      patterns.core.forEach((pattern: string) => {
        console.log(`  ${Colors.green('✓')} ${pattern}`);
      });
      console.log('');
    }

    if (patterns.advanced.length > 0) {
      console.log(Colors.bold('Advanced Patterns:'));
      patterns.advanced.forEach((pattern: string) => {
        console.log(`  ${Colors.cyan('✓')} ${pattern}`);
      });
      console.log('');
    }
  }

  private async setupFrameworkIntegration(context: WorkflowContext): Promise<any> {
    // Framework-specific integration logic
    return {
      framework: this.config.framework,
      dependencies: [],
      configuration: {}
    };
  }

  private async createGenerationPlan(context: WorkflowContext): Promise<any> {
    // Create comprehensive generation plan
    const files: any[] = [];

    // Add basic files based on pattern
    files.push(
      { path: 'src/domain/index.ts', type: 'domain-exports' },
      { path: 'src/application/index.ts', type: 'application-exports' },
      { path: 'src/infrastructure/index.ts', type: 'infrastructure-exports' },
      { path: 'package.json', type: 'package-config' },
      { path: 'README.md', type: 'documentation' },
      { path: 'docker-compose.yml', type: 'infrastructure' }
    );

    return { files };
  }

  private async generateFileContent(fileSpec: any, context: WorkflowContext): Promise<string> {
    // Generate file content based on type and context
    switch (fileSpec.type) {
      case 'domain-exports':
        return `// Domain layer exports\n// Generated by VytchesDDD CLI\n\nexport * from './aggregates';\nexport * from './entities';\nexport * from './events';\n`;
      case 'package-config':
        return JSON.stringify({
          name: this.config.domainName?.toLowerCase().replace(/\s+/g, '-') || 'domain-project',
          version: '1.0.0',
          dependencies: {
            '@vytches-ddd/core': '^1.0.0'
          }
        }, null, 2);
      default:
        return `// ${fileSpec.type} - Generated by VytchesDDD CLI\n`;
    }
  }

  private getEntryPoints(context: WorkflowContext): string[] {
    return [
      'src/domain/index.ts',
      'src/application/index.ts',
      'src/infrastructure/index.ts'
    ];
  }

  private generateDocumentation(context: WorkflowContext): string[] {
    return [
      'README.md',
      'docs/architecture.md',
      'docs/domain-model.md',
      'docs/getting-started.md'
    ];
  }

  private generateSetupInstructions(context: WorkflowContext): string[] {
    return [
      'pnpm install',
      'pnpm build',
      'pnpm test',
      'pnpm dev'
    ];
  }

  private generateClaudeMdContent(context: WorkflowContext, integration: any): string {
    return `# ${this.config.domainName || 'Domain Project'} - Claude Code Integration

## 🎯 Project Overview

This is an enterprise-grade domain implementation generated by VytchesDDD CLI with complete Domain-Driven Design patterns.

### Architecture: ${context.answers?.['architecture-selection'] || this.config.structure}
### Framework: ${this.config.framework}
### Bounded Contexts: ${context.boundedContexts?.contexts.length || 0}

## 🏗️ Project Structure

\`\`\`
src/
├── domain/           # Core domain logic (aggregates, entities, events)
├── application/      # Application services and use cases
├── infrastructure/   # Infrastructure adapters and implementations
└── presentation/     # Controllers and API interfaces (framework-specific)
\`\`\`

## 🚀 Getting Started

1. Install dependencies: \`pnpm install\`
2. Build the project: \`pnpm build\`
3. Run tests: \`pnpm test\`
4. Start development: \`pnpm dev\`

## 🤖 Claude Code Workflow Tips

- **"Analyze the domain model"** - Understand the bounded contexts and aggregates
- **"Add new aggregate [Name]"** - Extend the domain with new aggregates
- **"Review business rules"** - Examine domain specifications and policies
- **"Generate tests for [component]"** - Add comprehensive test coverage
- **"Optimize performance"** - Review and improve domain performance

## 📚 Key Components

### Bounded Contexts
${context.boundedContexts?.contexts.map((ctx: any) => `- **${ctx.name}**: ${ctx.description}`).join('\n') || 'No bounded contexts defined'}

### Core Patterns
${context.patternRecommendations?.core.map((pattern: string) => `- ${pattern}`).join('\n') || 'Basic DDD patterns'}

### Advanced Patterns
${context.patternRecommendations?.advanced.map((pattern: string) => `- ${pattern}`).join('\n') || 'No advanced patterns'}

## 🔧 Development Commands

- \`pnpm dev\` - Start development server
- \`pnpm test\` - Run all tests
- \`pnpm test:watch\` - Run tests in watch mode
- \`pnpm build\` - Build for production
- \`pnpm lint\` - Run code linting
- \`pnpm type-check\` - Run TypeScript type checking

## 📖 Documentation

- \`README.md\` - Project overview and setup
- \`docs/architecture.md\` - Architecture decision records
- \`docs/domain-model.md\` - Domain model documentation
- \`docs/getting-started.md\` - Developer onboarding guide

Generated by VytchesDDD CLI v2.0 with Claude Code integration.
`;
  }

  private generateCursorRules(context: WorkflowContext): string {
    return `# VytchesDDD Domain Project - Cursor IDE Rules

## Project Context
This is a Domain-Driven Design project using VytchesDDD library with ${this.config.framework} framework.

## Code Style
- Use TypeScript strict mode
- Follow Domain-Driven Design principles
- Use proper separation of concerns (Domain/Application/Infrastructure)
- Implement proper error handling with Result patterns
- Use safeRun for error testing (never use .toThrow())

## Domain Layer Rules
- Keep domain pure (no external dependencies)
- Use aggregates for consistency boundaries
- Implement proper business rules and invariants
- Use domain events for side effects
- Value objects should be immutable

## Testing Patterns
- Use safeRun from @vytches-ddd/utils for error testing
- Place test files in tests/ directory, not src/
- Follow AAA pattern (Arrange, Act, Assert)
- Test business rules and invariants thoroughly
- Use test builders for complex object creation

## File Organization
- Domain: aggregates, entities, value objects, specifications
- Application: use cases, command/query handlers, services
- Infrastructure: repositories, adapters, external integrations
- Tests: comprehensive test suites outside src/

## VytchesDDD Patterns
- Use @vytches-ddd/core for meta-package imports
- Implement specifications for business rules
- Use policies for complex business logic
- Apply resilience patterns for external calls
- Use sagas for long-running processes

Generated by VytchesDDD CLI - Keep these rules for optimal development experience.
`;
  }
}
