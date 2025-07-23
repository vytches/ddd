/**
 * @fileoverview Generate Command - DDD Component Generation
 * Generates all VytchesDDD components with intelligent templates
 */

import type { Command } from '../types';
import { Colors } from '../core/utils/colors';
import { TemplateEngine } from '../core/engines/template-engine';
import { PatternRegistry } from '../core/engines/pattern-registry';
import { FileSystem } from '../core/utils/file-system';
import { Performance } from '../core/utils/performance';
import { chatHistory } from '../core/utils/chat-history';
import { ValidationError } from '../types';
import { promptForInput, promptForChoice, promptForConfirmation } from '../core/utils/prompts';
import { UnifiedExampleParser } from '../parsers/unified-parser';
import { DocumentationGenerator } from '../generators/documentation-generator';
import { globalDocumentationRegistry } from '../core/documentation-registry';

/**
 * Domain context generation options
 */
interface DomainContextOptions {
  domainName: string;
  aggregateName: string;
  entityNames: string[];
  valueObjects: string[];
  events: string[];
  commands: string[];
  queries: string[];
  includeRepository: boolean;
  includeACL: boolean;
  includeDomainService: boolean;
  includeSpecs: boolean;
}

/**
 * Property definition
 */
interface PropertyDefinition {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Method definition
 */
interface MethodDefinition {
  name: string;
  description: string;
}

/**
 * Event definition
 */
interface EventDefinition {
  name: string;
  description: string;
}

/**
 * Component generation options
 */
interface GenerateOptions {
  type?: string;
  name?: string;
  output?: string;
  framework?: string;
  interactive?: boolean;
  withTests?: boolean;
  dryRun?: boolean;
  domain?: string;
  fullDomain?: boolean;
  example?: string;
  only?: string[];
  exclude?: string[];
  properties?: PropertyDefinition[];
  methods?: MethodDefinition[];
  events?: EventDefinition[];
  // Documentation generation options
  complexity?: string;
  sections?: string;
  llmOptimized?: boolean;
  llm?: boolean;
  showRelated?: boolean;
  maxExamples?: number;
  noRandomize?: boolean;
  seed?: string;
  diOnly?: boolean;
  packages?: string;
  fix?: boolean;
  verbose?: boolean;
  [key: string]: unknown;
}

/**
 * @llm-summary generateCommand constant
 * @llm-domain Infrastructure
 *
 * @description
 * generateCommand constant implementing infrastructure service for generate command operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(generateCommand);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const generateCommand: Command = {
  name: 'generate',
  description: 'Generate DDD components, patterns, and complete domains',
  aliases: ['g'],
  options: [
    {
      flags: '-t, --type <type>',
      description: 'Component type to generate',
      choices: [
        'aggregate',
        'entity',
        'value-object',
        'specification',
        'policy',
        'command',
        'query',
        'event',
        'repository',
        'domain-service',
      ],
    },
    {
      flags: '-n, --name <name>',
      description: 'Component name',
    },
    {
      flags: '-o, --output, --output-path <path>',
      description: 'Output directory path',
      defaultValue: './src',
    },
    {
      flags: '-f, --framework <framework>',
      description: 'Target framework',
      choices: ['nestjs', 'express', 'fastify', 'standalone'],
      defaultValue: 'standalone',
    },
    {
      flags: '--interactive',
      description: 'Use interactive mode',
      defaultValue: false,
    },
    {
      flags: '--with-tests',
      description: 'Generate tests',
      defaultValue: true,
    },
    {
      flags: '--dry-run',
      description: 'Preview changes without creating files',
      defaultValue: false,
    },
    {
      flags: '--domain <domain>',
      description: 'Domain name for the component',
    },
    {
      flags: '--full-domain',
      description: 'Generate complete domain context with all components',
      defaultValue: false,
    },
    {
      flags: '--example <example>',
      description: 'Generate from existing example',
    },
    {
      flags: '--only <components>',
      description: 'Generate only specific components (comma-separated)',
    },
    {
      flags: '--exclude <components>',
      description: 'Exclude specific components (comma-separated)',
    },
    {
      flags: '--complexity <level>',
      description: 'Generate documentation with complexity level (basic, intermediate, advanced)',
    },
    {
      flags: '--llm-optimized',
      description: 'Generate LLM-optimized documentation',
      defaultValue: false,
    },
    {
      flags: '--max-examples <n>',
      description: 'Maximum number of examples to include in documentation',
    },
    {
      flags: '--show-related',
      description: 'Include related examples from other packages',
      defaultValue: false,
    },
  ],
  examples: [
    'vytches-ddd generate --type aggregate --name Order',
    'vytches-ddd g -t entity -n Customer --framework nestjs',
    'vytches-ddd generate --interactive',
    'vytches-ddd generate --type value-object --name Email --with-tests',
    'vytches-ddd generate --type specification --name OrderCanBeShipped',
    'vytches-ddd generate --domain ecommerce                 # Bulk component selection',
    'vytches-ddd generate --domain ecommerce --full-domain   # Complete domain context',
    'vytches-ddd generate --type aggregate --name Order --output ./modules/order/src   # Custom output path',
    'vytches-ddd generate --example order --name CustomerOrder --framework nestjs',
    'vytches-ddd generate --example order --name CustomerOrder --only service,controller',
    'vytches-ddd generate --example order --name CustomerOrder --exclude repository',
    'vytches-ddd generate domain-services --complexity intermediate',
    'vytches-ddd generate policies --framework nestjs --llm-optimized',
    'vytches-ddd generate di --max-examples 5 --show-related',
  ],
  action: async (args: string[], options: GenerateOptions) => {
    const startTime = Performance.now();

    try {
      console.log(Colors.bold(Colors.cyan('🔧 VytchesDDD Component Generator')));
      console.log(Colors.dim('Generating enterprise-grade DDD components'));
      console.log('');

      // Check if this is documentation generation (package name as first arg, no type)
      const firstArg = args[0];
      const isDocumentationGeneration =
        firstArg && !options.type && !options.name && !options.example && !options.domain;

      if (isDocumentationGeneration) {
        // Documentation generation mode
        await generateDocumentationForPackage(firstArg, options);
      } else {
        // Component generation mode
        const generator = new ComponentGenerator(options);

        // Check if this is an example-based generation
        if (options.example) {
          await generator.runExampleMode();
        } else if (options.domain && options.fullDomain) {
          await generator.runDomainContextMode();
        } else if (options.domain && !options.type) {
          await generator.runDomainSelectionMode();
        } else if (options.interactive || !options.type || !options.name) {
          await generator.runInteractiveMode();
        } else {
          await generator.runDirectMode();
        }
      }

      // Show completion summary
      const duration = Performance.since(startTime);
      console.log('');
      console.log(Colors.success(`✅ Generation completed in ${duration.toFixed(1)}ms`));
    } catch (error) {
      console.error('');
      console.error(
        Colors.error(`❌ Generation failed: ${error instanceof Error ? error.message : error}`)
      );

      if (error instanceof ValidationError) {
        console.error(Colors.dim('Validation errors:'));
        error.details.forEach(detail => {
          console.error(`  ${Colors.error('•')} ${detail}`);
        });
      }

      process.exit(1);
    }
  },
};

/**
 * Component generator with intelligent templates
 */
class ComponentGenerator {
  private templateEngine: TemplateEngine;
  private patternRegistry: PatternRegistry;
  private sessionId: string | null = null;
  private options: GenerateOptions;

  constructor(options: GenerateOptions) {
    this.options = options;
    this.templateEngine = TemplateEngine.create();
    this.patternRegistry = PatternRegistry.create();
  }

  /**
   * Run example-based generation mode
   */
  async runExampleMode(): Promise<void> {
    console.log(Colors.info('🎯 Example-based Component Generation'));
    console.log(Colors.dim(`Example: ${this.options.example}`));
    console.log('');

    // Load all examples
    await globalDocumentationRegistry.loadAll();

    // Find the example
    const example = globalDocumentationRegistry.findById(this.options.example!);
    if (!example) {
      console.error(Colors.error(`❌ Example '${this.options.example}' not found.`));

      // Suggest similar examples
      const allExamples = globalDocumentationRegistry.query({});
      const suggestions = allExamples
        .filter(
          ex =>
            ex.id.includes(this.options.example!) ||
            ex.name.toLowerCase().includes(this.options.example!.toLowerCase())
        )
        .slice(0, 3);

      if (suggestions.length > 0) {
        console.log('\n💡 Did you mean:');
        suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion.id} (${suggestion.name})`);
        });
      }

      return;
    }

    // Get component name if not provided
    if (!this.options.name) {
      this.options.name = await promptForInput('Enter component name:', {
        validate: (input: string) => {
          if (!input.trim()) return 'Component name is required';
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(input)) return 'Name must be valid identifier';
          return true;
        },
      });
    }

    // Check framework availability and prompt if needed
    const availableFrameworks = globalDocumentationRegistry.getAvailableFrameworks(
      this.options.example!
    );

    if (!this.options.framework || this.options.framework === 'standalone') {
      if (availableFrameworks.length > 0) {
        this.options.framework = await promptForChoice('Select framework:', [
          { name: 'Base only (no framework)', value: 'standalone' },
          ...availableFrameworks.map(fw => ({ name: fw.toUpperCase(), value: fw })),
        ]);
      } else {
        this.options.framework = 'standalone';
      }
    }

    // Validate framework availability
    if (
      this.options.framework !== 'standalone' &&
      this.options.framework &&
      !availableFrameworks.includes(this.options.framework)
    ) {
      console.error(
        Colors.error(
          `❌ Framework '${this.options.framework}' not available for example '${this.options.example}'.`
        )
      );
      if (availableFrameworks.length > 0) {
        console.log(`💡 Available frameworks: ${availableFrameworks.join(', ')}`);
      } else {
        console.log(`💡 This example only has base implementation.`);
      }
      return;
    }

    // Parse component filters
    if (this.options.only) {
      if (typeof this.options.only === 'string') {
        this.options.only = (this.options.only as string).split(',').map((s: string) => s.trim());
      }
    }

    if (this.options.exclude) {
      if (typeof this.options.exclude === 'string') {
        this.options.exclude = (this.options.exclude as string)
          .split(',')
          .map((s: string) => s.trim());
      }
    }

    // Show component filtering options if framework is selected
    if (this.options.framework !== 'standalone') {
      const availableComponents = globalDocumentationRegistry.getAvailableComponents(
        this.options.example!,
        this.options.framework!
      );

      if (availableComponents.length > 0 && !this.options.only && !this.options.exclude) {
        const showComponents = await promptForConfirmation(
          'Show available components for filtering?',
          false
        );

        if (showComponents) {
          console.log(`\n🧩 Available components for ${this.options.framework!.toUpperCase()}:`);
          availableComponents.forEach(comp => console.log(`   - ${comp}`));
          console.log('');

          const filterChoice = await promptForChoice('Component filtering:', [
            { name: 'Generate all components', value: 'all' },
            { name: 'Select specific components only', value: 'only' },
            { name: 'Exclude specific components', value: 'exclude' },
          ]);

          if (filterChoice === 'only') {
            const selectedComponents = await promptForInput(
              'Enter components to include (comma-separated):',
              {
                validate: (input: string) =>
                  input.trim() ? true : 'At least one component is required',
              }
            );
            this.options.only = selectedComponents.split(',').map(s => s.trim());
          } else if (filterChoice === 'exclude') {
            const excludedComponents = await promptForInput(
              'Enter components to exclude (comma-separated):',
              {
                required: false,
              }
            );
            if (excludedComponents) {
              this.options.exclude = excludedComponents.split(',').map(s => s.trim());
            }
          }
        }
      }
    }

    // Ask for output directory
    if (!this.options.output) {
      const outputPath = await promptForInput('Enter output directory path (default: ./src):', {
        required: false,
        defaultValue: './src',
      });
      this.options.output = outputPath || './src';
    }

    // Show generation summary
    console.log('');
    console.log(Colors.bold('📋 Example Generation Summary'));
    console.log('');
    console.log(`  ${Colors.cyan('Example:')} ${example.name} (${this.options.example})`);
    console.log(`  ${Colors.cyan('Component Name:')} ${this.options.name}`);
    console.log(`  ${Colors.cyan('Framework:')} ${this.options.framework}`);
    console.log(`  ${Colors.cyan('Output Path:')} ${this.options.output}`);

    if (this.options.only?.length) {
      console.log(`  ${Colors.cyan('Include Only:')} ${this.options.only.join(', ')}`);
    }

    if (this.options.exclude?.length) {
      console.log(`  ${Colors.cyan('Exclude:')} ${this.options.exclude.join(', ')}`);
    }

    console.log(`  ${Colors.cyan('Description:')} ${example.description}`);
    console.log(`  ${Colors.cyan('Complexity:')} ${example.complexity}`);
    console.log(`  ${Colors.cyan('Patterns:')} ${example.patterns?.join(', ') || 'none'}`);
    console.log('');

    const proceed = await promptForConfirmation('Generate component from example?', true);

    if (!proceed) {
      console.log(Colors.yellow('Generation cancelled'));
      return;
    }

    // Generate from example
    await this.generateFromExample();
  }

  /**
   * Run interactive mode for component generation
   */
  async runInteractiveMode(): Promise<void> {
    // Start chat session
    this.sessionId = await chatHistory.startSession('Component Generation', {
      mode: 'interactive',
      startedAt: new Date().toISOString(),
    });

    console.log(Colors.info('🎯 Interactive Component Generation'));
    console.log('');

    // Get component type
    if (!this.options.type) {
      this.options.type = await promptForChoice('Select component type:', [
        {
          name: 'Aggregate Root',
          value: 'aggregate',
          description: 'Core domain aggregate with business rules',
        },
        { name: 'Entity', value: 'entity', description: 'Domain entity with identity' },
        { name: 'Value Object', value: 'value-object', description: 'Immutable value object' },
        {
          name: 'Specification',
          value: 'specification',
          description: 'Business rule specification',
        },
        { name: 'Policy', value: 'policy', description: 'Business policy with rules' },
        { name: 'Command', value: 'command', description: 'CQRS command with handler' },
        { name: 'Query', value: 'query', description: 'CQRS query with handler' },
        { name: 'Domain Event', value: 'event', description: 'Domain event for side effects' },
        {
          name: 'Repository',
          value: 'repository',
          description: 'Repository pattern implementation',
        },
        {
          name: 'Domain Service',
          value: 'domain-service',
          description: 'Domain service for complex logic',
        },
      ]);
    }

    // Get component name
    if (!this.options.name) {
      this.options.name = await promptForInput(`Enter ${this.options.type} name:`, {
        validate: (input: string) => {
          if (!input.trim()) return 'Component name is required';
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(input)) return 'Name must be valid identifier';
          return true;
        },
      });
    }

    // Get domain (optional)
    if (!this.options.domain) {
      this.options.domain = await promptForInput('Enter domain name (optional):', {
        required: false,
      });
    }

    // Component-specific questions
    await this.askComponentSpecificQuestions();

    // Ask for output directory
    const outputPath = await promptForInput('Enter output directory path (default: ./src):', {
      required: false,
      defaultValue: this.options.output || './src',
    });

    // Update output path
    this.options.output = outputPath || './src';

    // Use default framework if not specified
    if (!this.options.framework || this.options.framework === 'standalone') {
      this.options.framework = 'standalone';
    }

    // Default to generating tests
    this.options.withTests = this.options.withTests !== false;

    // Show summary and confirm
    await this.showGenerationSummary();
    const proceed = await promptForConfirmation('Generate component?', true);

    if (!proceed) {
      console.log(Colors.yellow('Generation cancelled'));
      return;
    }

    // Generate component
    await this.generateComponent();
  }

  /**
   * Run direct mode for component generation
   */
  async runDirectMode(): Promise<void> {
    console.log(Colors.info(`🎯 Generating ${this.options.type}: ${this.options.name}`));
    console.log('');

    // Validate options
    this.validateOptions();

    // Generate component
    await this.generateComponent();
  }

  /**
   * Run domain selection mode (bulk component selection)
   */
  async runDomainSelectionMode(): Promise<void> {
    console.log(Colors.info('🎯 Domain Component Selection'));
    console.log(Colors.dim(`Domain: ${this.options.domain}`));
    console.log('');

    // Aggregate name is required
    const aggregateName = await promptForInput('Enter aggregate root name:', { required: true });

    // Ask for output directory
    const outputPath = await promptForInput('Enter output directory path (default: ./src):', {
      required: false,
      defaultValue: this.options.output || './src',
    });

    // Update output path
    this.options.output = outputPath || './src';

    // Show component selection
    console.log(Colors.info('Select components to generate (comma-separated numbers):'));
    console.log('  1. Entity');
    console.log('  2. Value Object');
    console.log('  3. Specification');
    console.log('  4. Policy');
    console.log('  5. Command');
    console.log('  6. Query');
    console.log('  7. Domain Event');
    console.log('  8. Repository');
    console.log('  9. Domain Service');
    console.log('  10. ACL Components');
    console.log('');
    console.log(Colors.dim('Examples: 1,2,5,8 or 1-5 or all'));

    const selection = await promptForInput('Your selection:', { required: true });

    const componentTypes = this.parseComponentSelection(selection);

    console.log('');
    console.log(Colors.info(`Selected: ${componentTypes.join(', ')}`));
    console.log('');

    const domainOptions = await this.buildDomainOptionsFromSelection(
      this.options.domain || 'Default',
      aggregateName,
      componentTypes
    );

    // Show summary and generate
    await this.showSelectionSummary(domainOptions);
    const proceed = await promptForConfirmation('Generate selected components?', true);

    if (proceed) {
      await this.generateDomainContext(domainOptions);
    } else {
      console.log(Colors.yellow('Generation cancelled'));
    }
  }

  /**
   * Parse component selection string (1,2,5 or 1-5 or all)
   */
  private parseComponentSelection(selection: string): string[] {
    const componentMap: Record<number, string> = {
      1: 'Entity',
      2: 'Value Object',
      3: 'Specification',
      4: 'Policy',
      5: 'Command',
      6: 'Query',
      7: 'Domain Event',
      8: 'Repository',
      9: 'Domain Service',
      10: 'ACL Components',
    };

    if (selection.toLowerCase() === 'all') {
      return Object.values(componentMap);
    }

    const selected: string[] = [];
    const parts = selection.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        // Range like 1-5
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr?.trim() || '0');
        const end = parseInt(endStr?.trim() || '0');
        for (let i = start; i <= end; i++) {
          const component = componentMap[i];
          if (component) {
            selected.push(component);
          }
        }
      } else {
        // Single number
        const num = parseInt(part);
        const component = componentMap[num];
        if (component) {
          selected.push(component);
        }
      }
    }

    return [...new Set(selected)]; // Remove duplicates
  }

  /**
   * Build domain options from component selection
   */
  private async buildDomainOptionsFromSelection(
    domainName: string,
    aggregateName: string,
    componentTypes: string[]
  ): Promise<DomainContextOptions> {
    const options: DomainContextOptions = {
      domainName,
      aggregateName,
      entityNames: [],
      valueObjects: [],
      events: [],
      commands: [],
      queries: [],
      includeRepository: componentTypes.includes('Repository'),
      includeACL: componentTypes.includes('ACL Components'),
      includeDomainService: componentTypes.includes('Domain Service'),
      includeSpecs: componentTypes.includes('Specification'),
    };

    // Auto-generate names based on aggregate for selected components
    const baseName = aggregateName;

    if (componentTypes.includes('Entity')) {
      options.entityNames = [`${baseName}Item`, `${baseName}Detail`];
    }

    if (componentTypes.includes('Value Object')) {
      options.valueObjects = [`${baseName}Id`, `${baseName}Status`];
    }

    if (componentTypes.includes('Domain Event')) {
      options.events = [`${baseName}Created`, `${baseName}Updated`, `${baseName}Deleted`];
    }

    if (componentTypes.includes('Command')) {
      options.commands = [`Create${baseName}`, `Update${baseName}`, `Delete${baseName}`];
    }

    if (componentTypes.includes('Query')) {
      options.queries = [`Get${baseName}`, `List${baseName}s`, `Find${baseName}ById`];
    }

    return options;
  }

  /**
   * Show selection summary
   */
  private async showSelectionSummary(options: DomainContextOptions): Promise<void> {
    console.log(Colors.bold('📋 Component Generation Summary'));
    console.log('');
    console.log(`  ${Colors.cyan('Domain:')} ${options.domainName}`);
    console.log(`  ${Colors.cyan('Aggregate:')} ${options.aggregateName}`);
    console.log(`  ${Colors.cyan('Output Path:')} ${this.options.output}`);

    if (options.entityNames.length > 0) {
      console.log(`  ${Colors.cyan('Entities:')} ${options.entityNames.join(', ')}`);
    }
    if (options.valueObjects.length > 0) {
      console.log(`  ${Colors.cyan('Value Objects:')} ${options.valueObjects.join(', ')}`);
    }
    if (options.events.length > 0) {
      console.log(`  ${Colors.cyan('Events:')} ${options.events.join(', ')}`);
    }
    if (options.commands.length > 0) {
      console.log(`  ${Colors.cyan('Commands:')} ${options.commands.join(', ')}`);
    }
    if (options.queries.length > 0) {
      console.log(`  ${Colors.cyan('Queries:')} ${options.queries.join(', ')}`);
    }
    if (options.includeRepository) {
      console.log(`  ${Colors.cyan('Repository:')} ${options.aggregateName}Repository`);
    }
    if (options.includeDomainService) {
      console.log(`  ${Colors.cyan('Domain Service:')} ${options.domainName}Service`);
    }
    if (options.includeSpecs) {
      console.log(`  ${Colors.cyan('Specifications:')} Auto-generated for entities`);
    }
    if (options.includeACL) {
      console.log(`  ${Colors.cyan('ACL:')} ${options.domainName}ACLAdapter`);
    }
    console.log('');
  }

  /**
   * Run domain context generation mode
   */
  async runDomainContextMode(): Promise<void> {
    console.log(Colors.info('🏗️  Complete Domain Context Generation'));
    console.log('');

    const domainName = this.options.domain || 'Default';

    // Interactive prompts for domain context
    const aggregateName = await promptForInput('Enter aggregate root name:', { required: true });

    // Ask for output directory
    const outputPath = await promptForInput('Enter output directory path (default: ./src):', {
      required: false,
      defaultValue: this.options.output || './src',
    });

    // Update output path
    this.options.output = outputPath || './src';

    const entityNames: string[] = [];
    console.log(Colors.info('Define entities (press Enter with empty name to finish):'));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const entityName = await promptForInput('Entity name:', { required: false });
      if (!entityName) break;
      entityNames.push(entityName);
    }

    const valueObjects: string[] = [];
    console.log(Colors.info('Define value objects (press Enter with empty name to finish):'));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const voName = await promptForInput('Value Object name:', { required: false });
      if (!voName) break;
      valueObjects.push(voName);
    }

    const events: string[] = [];
    console.log(Colors.info('Define domain events (press Enter with empty name to finish):'));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const eventName = await promptForInput('Event name:', { required: false });
      if (!eventName) break;
      events.push(eventName);
    }

    const commands: string[] = [];
    console.log(Colors.info('Define commands (press Enter with empty name to finish):'));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const commandName = await promptForInput('Command name:', { required: false });
      if (!commandName) break;
      commands.push(commandName);
    }

    const queries: string[] = [];
    console.log(Colors.info('Define queries (press Enter with empty name to finish):'));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queryName = await promptForInput('Query name:', { required: false });
      if (!queryName) break;
      queries.push(queryName);
    }

    const includeRepository = await promptForConfirmation('Include Repository?', true);
    const includeDomainService = await promptForConfirmation('Include Domain Service?', true);
    const includeSpecs = await promptForConfirmation('Include Specifications?', true);
    const includeACL = await promptForConfirmation('Include ACL components?', false);

    const domainOptions: DomainContextOptions = {
      domainName,
      aggregateName,
      entityNames,
      valueObjects,
      events,
      commands,
      queries,
      includeRepository,
      includeACL,
      includeDomainService,
      includeSpecs,
    };

    // Show summary
    console.log('');
    console.log(Colors.bold('📋 Domain Context Summary'));
    console.log('');
    console.log(`  ${Colors.cyan('Domain:')} ${domainName}`);
    console.log(`  ${Colors.cyan('Aggregate:')} ${aggregateName}`);
    console.log(
      `  ${Colors.cyan('Entities:')} ${entityNames.length > 0 ? entityNames.join(', ') : 'None'}`
    );
    console.log(
      `  ${Colors.cyan('Value Objects:')} ${valueObjects.length > 0 ? valueObjects.join(', ') : 'None'}`
    );
    console.log(`  ${Colors.cyan('Events:')} ${events.length > 0 ? events.join(', ') : 'None'}`);
    console.log(
      `  ${Colors.cyan('Commands:')} ${commands.length > 0 ? commands.join(', ') : 'None'}`
    );
    console.log(`  ${Colors.cyan('Queries:')} ${queries.length > 0 ? queries.join(', ') : 'None'}`);
    console.log(`  ${Colors.cyan('Repository:')} ${includeRepository ? 'Yes' : 'No'}`);
    console.log(`  ${Colors.cyan('Domain Service:')} ${includeDomainService ? 'Yes' : 'No'}`);
    console.log(`  ${Colors.cyan('Specifications:')} ${includeSpecs ? 'Yes' : 'No'}`);
    console.log(`  ${Colors.cyan('ACL:')} ${includeACL ? 'Yes' : 'No'}`);
    console.log('');

    const proceed = await promptForConfirmation('Generate complete domain context?', true);

    if (!proceed) {
      console.log(Colors.yellow('Domain context generation cancelled'));
      return;
    }

    // Generate domain context
    await this.generateDomainContext(domainOptions);
  }

  /**
   * Ask component-specific questions
   */
  private async askComponentSpecificQuestions(): Promise<void> {
    switch (this.options.type) {
      case 'aggregate':
        await this.askAggregateQuestions();
        break;
      case 'entity':
        await this.askEntityQuestions();
        break;
      case 'value-object':
        await this.askValueObjectQuestions();
        break;
      case 'specification':
        await this.askSpecificationQuestions();
        break;
      case 'policy':
        await this.askPolicyQuestions();
        break;
      case 'command':
      case 'query':
        await this.askCqrsQuestions();
        break;
      case 'event':
        await this.askEventQuestions();
        break;
      case 'repository':
        await this.askRepositoryQuestions();
        break;
      case 'domain-service':
        await this.askDomainServiceQuestions();
        break;
    }
  }

  /**
   * Ask aggregate-specific questions (simplified)
   */
  private async askAggregateQuestions(): Promise<void> {
    console.log(Colors.info('📊 Aggregate Configuration'));

    // Properties
    const properties = await this.collectProperties();
    this.options.properties = properties;

    // Business methods
    const methods = await this.collectMethods();
    this.options.methods = methods;

    // Domain events
    const events = await this.collectEvents();
    this.options.events = events;

    // Default to including specifications
    this.options.hasSpecifications = true;
  }

  /**
   * Ask entity-specific questions
   */
  private async askEntityQuestions(): Promise<void> {
    console.log(Colors.info('🏢 Entity Configuration'));

    const properties = await this.collectProperties();
    this.options.properties = properties;

    const methods = await this.collectMethods();
    this.options.methods = methods;
  }

  /**
   * Ask value object-specific questions (simplified)
   */
  private async askValueObjectQuestions(): Promise<void> {
    console.log(Colors.info('💎 Value Object Configuration'));

    const properties = await this.collectProperties();
    this.options.properties = properties;

    // Default to including common value object features
    this.options.hasValidation = true;
    this.options.hasComparison = true;
  }

  /**
   * Ask specification-specific questions (simplified)
   */
  private async askSpecificationQuestions(): Promise<void> {
    console.log(Colors.info('📋 Specification Configuration'));

    const description = await promptForInput('Description (optional):', { required: false });
    this.options.description = description || '';

    // Default to synchronous specification
    this.options.isAsync = false;
  }

  /**
   * Ask policy-specific questions
   */
  private async askPolicyQuestions(): Promise<void> {
    console.log(Colors.info('📜 Policy Configuration'));

    const description = await promptForInput('Enter policy description:');
    this.options.description = description;

    const rules = await this.collectRules();
    this.options.rules = rules;
  }

  /**
   * Ask CQRS-specific questions (simplified)
   */
  private async askCqrsQuestions(): Promise<void> {
    console.log(Colors.info(`⚡ ${this.options.type?.toUpperCase()} Configuration`));

    const description = await promptForInput(`Description (optional):`, { required: false });
    this.options.description = description || '';

    const properties = await this.collectProperties();
    this.options.properties = properties;

    // Defaults for common options
    this.options.hasValidation = true;
    this.options.hasResult = this.options.type === 'command';
  }

  /**
   * Ask event-specific questions
   */
  private async askEventQuestions(): Promise<void> {
    console.log(Colors.info('⚡ Event Configuration'));

    const description = await promptForInput('Enter event description:');
    this.options.description = description;

    const properties = await this.collectProperties();
    this.options.properties = properties;

    const eventType = await promptForChoice('Event type:', [
      { name: 'Domain Event', value: 'domain' },
      { name: 'Integration Event', value: 'integration' },
      { name: 'Application Event', value: 'application' },
    ]);
    this.options.eventType = eventType;
  }

  /**
   * Ask repository-specific questions
   */
  private async askRepositoryQuestions(): Promise<void> {
    console.log(Colors.info('🏪 Repository Configuration'));

    const entityName = await promptForInput('Enter entity name this repository manages:');
    this.options.entityName = entityName;

    const hasUnitOfWork = await promptForConfirmation('Include Unit of Work pattern?', true);
    this.options.hasUnitOfWork = hasUnitOfWork;

    const hasSpecification = await promptForConfirmation('Include specification pattern?', true);
    this.options.hasSpecification = hasSpecification;
  }

  /**
   * Ask domain service-specific questions
   */
  private async askDomainServiceQuestions(): Promise<void> {
    console.log(Colors.info('🔧 Domain Service Configuration'));

    const description = await promptForInput('Enter service description:');
    this.options.description = description;

    const methods = await this.collectMethods();
    this.options.methods = methods;

    const hasDependencies = await promptForConfirmation('Has dependencies?');
    this.options.hasDependencies = hasDependencies;
  }

  /**
   * Collect properties from user (simplified)
   */
  private async collectProperties(): Promise<PropertyDefinition[]> {
    const properties: PropertyDefinition[] = [];

    console.log(Colors.info('Define properties (press Enter with empty name to finish):'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const name = await promptForInput('Property name:', { required: false });
      if (!name) break;

      const type = await promptForInput('Type (optional):', {
        required: false,
        defaultValue: 'string',
      });

      properties.push({
        name,
        type: type || 'string',
        optional: false, // Default to required
      });
    }

    return properties;
  }

  /**
   * Collect methods from user (simplified)
   */
  private async collectMethods(): Promise<MethodDefinition[]> {
    const methods: MethodDefinition[] = [];

    console.log(Colors.info('Define methods (press Enter with empty name to finish):'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const name = await promptForInput('Method name:', { required: false });
      if (!name) break;

      const description = await promptForInput('Description (optional):', { required: false });

      methods.push({
        name,
        description: description || '',
      });
    }

    return methods;
  }

  /**
   * Collect events from user (simplified)
   */
  private async collectEvents(): Promise<EventDefinition[]> {
    const events: EventDefinition[] = [];

    console.log(Colors.info('Define domain events (press Enter with empty name to finish):'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const name = await promptForInput('Event name:', { required: false });
      if (!name) break;

      const description = await promptForInput('Description (optional):', { required: false });

      events.push({ name, description: description || '' });
    }

    return events;
  }

  /**
   * Collect rules from user (simplified)
   */
  private async collectRules(): Promise<Array<{ name: string; description: string }>> {
    const rules: Array<{ name: string; description: string }> = [];

    console.log(Colors.info('Define business rules (press Enter with empty name to finish):'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const name = await promptForInput('Rule name:', { required: false });
      if (!name) break;

      const description = await promptForInput('Description (optional):', { required: false });

      rules.push({
        name,
        description: description || '',
      });
    }

    return rules;
  }

  /**
   * Show generation summary
   */
  private async showGenerationSummary(): Promise<void> {
    console.log('');
    console.log(Colors.bold('📋 Generation Summary'));
    console.log('');

    console.log(`  ${Colors.cyan('Type:')} ${this.options.type}`);
    console.log(`  ${Colors.cyan('Name:')} ${this.options.name}`);
    console.log(`  ${Colors.cyan('Domain:')} ${this.options.domain || 'Default'}`);
    console.log(`  ${Colors.cyan('Framework:')} ${this.options.framework}`);
    console.log(`  ${Colors.cyan('Output Path:')} ${this.options.output}`);
    console.log(`  ${Colors.cyan('Tests:')} ${this.options.withTests ? 'Yes' : 'No'}`);

    if (this.options.properties?.length) {
      console.log(`  ${Colors.cyan('Properties:')} ${this.options.properties.length}`);
    }

    if (this.options.methods?.length) {
      console.log(`  ${Colors.cyan('Methods:')} ${this.options.methods.length}`);
    }

    if (this.options.events?.length) {
      console.log(`  ${Colors.cyan('Events:')} ${this.options.events.length}`);
    }

    console.log('');
  }

  /**
   * Validate options
   */
  private validateOptions(): void {
    const errors: string[] = [];

    if (!this.options.type) {
      errors.push('Component type is required');
    }

    if (!this.options.name) {
      errors.push('Component name is required');
    }

    if (this.options.name && !/^[A-Za-z][A-Za-z0-9]*$/.test(this.options.name)) {
      errors.push('Component name must be a valid identifier');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid options', errors);
    }
  }

  /**
   * Generate component
   */
  private async generateComponent(): Promise<void> {
    console.log(Colors.info(`🔨 Generating ${this.options.type}...`));

    // Load appropriate template
    await this.loadTemplates();

    // Prepare template context
    const context = this.prepareTemplateContext();

    // Generate files
    const files = await this.generateFiles(context);

    if (this.options.dryRun) {
      console.log(Colors.yellow('🔍 Dry run mode - files that would be generated:'));
      files.forEach(file => {
        console.log(`  ${Colors.cyan('•')} ${file.path}`);
      });
    } else {
      // Write files
      for (const file of files) {
        await this.writeFile(file);
      }

      console.log(Colors.success(`✅ Generated ${files.length} files`));

      // Show next steps
      this.showNextSteps();
    }
  }

  /**
   * Load templates
   */
  private async loadTemplates(): Promise<void> {
    // For ES modules, we need to use import.meta.url to get the current file path
    const currentFile = new URL(import.meta.url).pathname;
    const currentDir = FileSystem.getDirectoryName(currentFile);

    // Find templates directory - check multiple possible locations
    const possibleTemplateDirs = [
      FileSystem.joinPath(currentDir, '../templates'), // Source: src/commands/../templates
      FileSystem.joinPath(currentDir, '../../templates'), // Dist: dist/commands/../../templates
      FileSystem.joinPath(process.cwd(), 'templates'), // Current working directory
      FileSystem.joinPath(process.cwd(), 'node_modules/@vytches-ddd/cli/templates'),
      FileSystem.joinPath(process.cwd(), 'node_modules/@vytches-ddd/cli/dist/templates'),
    ];

    let templatesDir: string | null = null;
    for (const dir of possibleTemplateDirs) {
      if (FileSystem.exists(dir) && FileSystem.isDirectory(dir)) {
        templatesDir = dir;
        break;
      }
    }

    if (!templatesDir) {
      throw new Error(
        `Templates directory not found. Searched paths: ${possibleTemplateDirs.join(', ')}`
      );
    }

    try {
      await this.templateEngine.loadTemplatesFromDirectory(templatesDir);
    } catch (error) {
      throw new Error(
        `Failed to load templates from ${templatesDir}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Prepare template context
   */
  private prepareTemplateContext(): Record<string, unknown> {
    const name = this.options.name || 'DefaultName';
    const domain = this.options.domain || 'Default';
    const type = this.options.type || 'entity';

    // Base context for all components
    const baseContext = {
      name,
      domain,
      description: this.options.description || `${name} ${type}`,
      fileName: this.toKebabCase(name),
      className: this.getFormattedClassName(name, type),
      camelName: this.toCamelCase(name),
      type,
      framework: this.options.framework || 'standalone',
      timestamp: new Date().toISOString(),
      author: 'VytchesDDD CLI',
      version: '1.0.0',
      // Common imports based on type
      imports: this.getImportsForType(type),
    };

    // Type-specific context enhancement
    return {
      ...baseContext,
      ...this.getTypeSpecificContext(type, name, baseContext),
    };
  }

  /**
   * Get imports needed for specific component type
   */
  private getImportsForType(type: string): string[] {
    const importMap: Record<string, string[]> = {
      specification: ['ISpecification'],
      aggregate: ['AggregateRoot', 'EntityId', 'DomainEvent'],
      entity: ['Entity', 'EntityId'],
      'value-object': ['ValueObject'],
      policy: ['Policy', 'PolicyBuilder'],
      command: ['ICommand', 'ICommandHandler'],
      query: ['IQuery', 'IQueryHandler'],
      event: ['DomainEvent', 'IExtendedDomainEvent'],
      repository: ['IRepository', 'IBaseRepository'],
      'domain-service': ['DomainService'],
    };

    return importMap[type] || [];
  }

  /**
   * Get type-specific context properties
   */
  private getTypeSpecificContext(
    type: string,
    name: string,
    _baseContext: Record<string, unknown>
  ): Record<string, unknown> {
    switch (type) {
      case 'specification':
        return this.getSpecificationContext(name);
      case 'aggregate':
        return this.getAggregateContext();
      case 'entity':
        return this.getEntityContext();
      case 'value-object':
        return this.getValueObjectContext();
      case 'policy':
        return this.getPolicyContext();
      case 'command':
      case 'query':
        return this.getCqrsContext(type);
      case 'event':
        return this.getEventContext();
      case 'repository':
        return this.getRepositoryContext();
      case 'domain-service':
        return this.getDomainServiceContext();
      default:
        return {};
    }
  }

  /**
   * Specification-specific context
   */
  private getSpecificationContext(name: string): Record<string, unknown> {
    // Try to infer entity type from specification name
    const entityType = this.inferEntityTypeFromName(name);

    return {
      entityType,
      isAsync: this.options.isAsync || false,
      hasComplexLogic: false,
      validationRules:
        this.options.properties?.map((p: unknown) => {
          const prop = p as { name?: string; type?: string } | string;
          const name = typeof prop === 'string' ? prop : prop.name || '';
          const type = typeof prop === 'string' ? 'string' : prop.type || 'string';
          return {
            property: name,
            rule: `validate ${name}`,
            type,
          };
        }) || [],
    };
  }

  /**
   * Aggregate-specific context
   */
  private getAggregateContext(): Record<string, unknown> {
    return {
      entityType: this.options.entityType || this.toPascalCase(this.options.name || 'DefaultName'),
      properties: this.options.properties || [],
      methods: this.options.methods || [],
      events: this.options.events || [],
      hasInvariants: true,
      hasBusinessRules: true,
      identityType: 'EntityId',
      rootEntityName: this.toPascalCase(this.options.name || 'DefaultName'),
    };
  }

  /**
   * Entity-specific context
   */
  private getEntityContext(): Record<string, unknown> {
    return {
      properties: this.options.properties || [],
      methods: this.options.methods || [],
      identityType: 'EntityId',
      hasValidation: this.options.hasValidation !== false,
      hasBusinessLogic: true,
    };
  }

  /**
   * Value Object-specific context
   */
  private getValueObjectContext(): Record<string, unknown> {
    return {
      properties: this.options.properties || [],
      hasValidation: true,
      hasComparison: true,
      isImmutable: true,
      hasEquality: true,
      hasHashCode: true,
    };
  }

  /**
   * Policy-specific context
   */
  private getPolicyContext(): Record<string, unknown> {
    return {
      rules: this.options.rules || [],
      hasConditions: true,
      hasActions: true,
      severity: 'ERROR',
      entityType: this.options.entityType || 'unknown',
    };
  }

  /**
   * CQRS-specific context
   */
  private getCqrsContext(type: string): Record<string, unknown> {
    return {
      properties: this.options.properties || [],
      hasValidation: this.options.hasValidation !== false,
      hasResult: type === 'command',
      returnType: type === 'command' ? 'void' : 'unknown',
      isAsync: true,
    };
  }

  /**
   * Event-specific context
   */
  private getEventContext(): Record<string, unknown> {
    return {
      properties: this.options.properties || [],
      eventType: this.options.eventType || 'domain',
      aggregateId: `${this.toPascalCase(this.options.name || 'DefaultName')}Id`,
      occurredOn: true,
      version: 1,
    };
  }

  /**
   * Repository-specific context
   */
  private getRepositoryContext(): Record<string, unknown> {
    const entityName =
      this.options.entityName || (this.options.name || 'DefaultName').replace(/Repository$/, '');
    return {
      entityName: this.toPascalCase(String(entityName)),
      entityType: this.toPascalCase(String(entityName)),
      hasUnitOfWork: this.options.hasUnitOfWork !== false,
      hasSpecification: this.options.hasSpecification !== false,
      identityType: 'EntityId',
    };
  }

  /**
   * Domain Service-specific context
   */
  private getDomainServiceContext(): Record<string, unknown> {
    return {
      methods: this.options.methods || [],
      hasDependencies: this.options.hasDependencies !== false,
      isStateless: true,
      hasBusinessLogic: true,
    };
  }

  /**
   * Infer entity type from specification name
   */
  private inferEntityTypeFromName(name: string): string {
    // Remove common specification suffixes and convert to entity name
    const entityName = name
      .replace(/Specification$/i, '')
      .replace(/Spec$/i, '')
      .replace(/Validation$/i, '')
      .replace(/Rule$/i, '');

    return entityName || 'T';
  }

  /**
   * Generate files
   */
  private async generateFiles(
    context: Record<string, unknown>
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];
    const type = this.options.type || 'entity';

    // Validate template existence
    const mainTemplateName = `${type}.ts`;
    if (!this.templateEngine.hasTemplate(mainTemplateName)) {
      const availableTemplates = this.templateEngine.getTemplateNames().join(', ');
      throw new Error(
        `Template not found: ${mainTemplateName}. Available templates: ${availableTemplates}`
      );
    }

    // Main component file
    const mainFile = {
      path: this.getMainFilePath(context),
      content: this.templateEngine.render(mainTemplateName, context),
    };
    files.push(mainFile);

    // Test file
    if (this.options.withTests) {
      const testTemplateName = `${type}.test.ts`;
      if (this.templateEngine.hasTemplate(testTemplateName)) {
        const testFile = {
          path: this.getTestFilePath(context),
          content: this.templateEngine.render(testTemplateName, context),
        };
        files.push(testFile);
      } else {
        console.log(
          Colors.yellow(
            `⚠️  Test template not found: ${testTemplateName}. Skipping test generation.`
          )
        );
      }
    }

    // Framework-specific files
    if (this.options.framework !== 'standalone') {
      const frameworkFiles = await this.generateFrameworkFiles(context);
      files.push(...frameworkFiles);
    }

    return files;
  }

  /**
   * Get main file path with proper naming conventions
   */
  private getMainFilePath(context: Record<string, unknown>): string {
    const type = this.options.type || 'entity';
    const output = this.options.output || './src';

    const typeFolder = this.getTypeFolder(type);
    const fileName = this.getFormattedFileName(String(context.fileName), type);

    return FileSystem.joinPath(output, typeFolder, fileName);
  }

  /**
   * Get test file path with proper naming conventions
   */
  private getTestFilePath(context: Record<string, unknown>): string {
    const type = this.options.type || 'entity';
    const output = this.options.output || './src';

    const typeFolder = this.getTypeFolder(type);
    const fileName = this.getFormattedFileName(String(context.fileName), type, true);

    return FileSystem.joinPath(output, '../tests', typeFolder, fileName);
  }

  /**
   * Get type folder
   */
  private getTypeFolder(type: string): string {
    const folderMap: Record<string, string> = {
      aggregate: 'domain/aggregates',
      entity: 'domain/entities',
      'value-object': 'domain/value-objects',
      specification: 'domain/specifications',
      policy: 'domain/policies',
      command: 'application/commands',
      query: 'application/queries',
      event: 'domain/events',
      repository: 'infrastructure/repositories',
      'domain-service': 'domain/services',
    };

    return folderMap[type] || 'domain';
  }

  /**
   * Get formatted file name with enterprise naming conventions
   */
  private getFormattedFileName(baseName: string, type: string, isTest = false): string {
    // Enterprise naming conventions:
    // - Aggregates: customer.aggregate.ts
    // - Entities: customer.entity.ts
    // - Value Objects: email-address.value-object.ts
    // - Specifications: customer.specification.ts
    // - Policies: customer.policy.ts
    // - Commands: create-customer.command.ts
    // - Queries: get-customer.query.ts
    // - Events: customer-created.event.ts
    // - Repositories: customer.repository.ts
    // - Domain Services: customer.service.ts
    // - Tests: customer.aggregate.test.ts

    const typeMap: Record<string, string> = {
      aggregate: 'aggregate',
      entity: 'entity',
      'value-object': 'value-object',
      specification: 'specification',
      policy: 'policy',
      command: 'command',
      query: 'query',
      event: 'event',
      repository: 'repository',
      'domain-service': 'service',
    };

    const typeSuffix = typeMap[type] || type;
    const testSuffix = isTest ? '.test' : '';

    return `${baseName}.${typeSuffix}${testSuffix}.ts`;
  }

  /**
   * Get file extension with proper naming conventions
   */
  private getFileExtension(_type: string): string {
    // All TypeScript files use .ts extension
    return 'ts';
  }

  /**
   * Generate framework-specific files
   */
  private async generateFrameworkFiles(
    context: Record<string, unknown>
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    // NestJS-specific files
    if (this.options.framework === 'nestjs') {
      if (this.options.type === 'command' || this.options.type === 'query') {
        const handlerFile = {
          path: this.getHandlerFilePath(context),
          content: this.templateEngine.render(
            `${this.options.type}-handler.nestjs.template`,
            context
          ),
        };
        files.push(handlerFile);
      }

      if (this.options.type === 'repository') {
        const moduleFile = {
          path: this.getModuleFilePath(context),
          content: this.templateEngine.render('repository.module.nestjs.template', context),
        };
        files.push(moduleFile);
      }
    }

    return files;
  }

  /**
   * Get handler file path
   */
  private getHandlerFilePath(context: Record<string, unknown>): string {
    const output = this.options.output || './src';
    const fileName = `${context.fileName}.handler.ts`;

    return FileSystem.joinPath(output, 'application/handlers', fileName);
  }

  /**
   * Get module file path
   */
  private getModuleFilePath(context: Record<string, unknown>): string {
    const output = this.options.output || './src';
    const fileName = `${context.fileName}.module.ts`;

    return FileSystem.joinPath(output, 'infrastructure/modules', fileName);
  }

  /**
   * Write file
   */
  private async writeFile(file: { path: string; content: string }): Promise<void> {
    const dir = FileSystem.getDirectoryName(file.path);
    await FileSystem.createDirectory(dir);
    await FileSystem.writeFile(file.path, file.content);

    console.log(`  ${Colors.green('✓')} ${file.path}`);
  }

  /**
   * Show next steps
   */
  private showNextSteps(): void {
    console.log('');
    console.log(Colors.bold('🚀 Next Steps:'));
    console.log(`  ${Colors.green('1.')} Review generated files`);
    console.log(`  ${Colors.green('2.')} Update imports and dependencies`);
    console.log(`  ${Colors.green('3.')} Run tests: ${Colors.dim('pnpm test')}`);
    console.log(`  ${Colors.green('4.')} Build project: ${Colors.dim('pnpm build')}`);
    console.log('');
    console.log(Colors.info('💡 Use "vytches-ddd analyze" to verify DDD compliance'));
  }

  // Helper methods for string transformations
  private toCamelCase(str: string): string {
    return str.replace(/[_-\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
  }

  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
      .replace(/[_\s]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get formatted class name with proper DDD suffixes
   */
  private getFormattedClassName(name: string, type: string): string {
    const baseName = this.toPascalCase(name);

    // Enterprise DDD naming conventions for class names
    const classSuffixMap: Record<string, string> = {
      aggregate: '', // CustomerAggregate -> Customer (extends AggregateRoot)
      entity: '', // CustomerEntity -> Customer (extends Entity)
      'value-object': '', // EmailAddress -> EmailAddress (extends ValueObject)
      specification: 'Specification', // CustomerSpecification -> CustomerSpecification
      policy: 'Policy', // CustomerPolicy -> CustomerPolicy
      command: 'Command', // CreateCustomer -> CreateCustomerCommand
      query: 'Query', // GetCustomer -> GetCustomerQuery
      event: 'Event', // CustomerCreated -> CustomerCreatedEvent
      repository: 'Repository', // CustomerRepository -> CustomerRepository
      'domain-service': 'Service', // CustomerService -> CustomerService
    };

    const suffix = classSuffixMap[type];

    // Handle special cases where the name already contains the suffix
    if (suffix && !baseName.endsWith(suffix)) {
      return `${baseName}${suffix}`;
    }

    return baseName;
  }

  /**
   * Generate complete domain context (aggregate + all related components)
   */
  async generateDomainContext(domainOptions: DomainContextOptions): Promise<void> {
    console.log(Colors.info(`🏗️  Generating complete domain context: ${domainOptions.domainName}`));
    console.log('');

    const files: Array<{ path: string; content: string }> = [];

    // Set domain context for all components
    this.options.domain = domainOptions.domainName;
    this.options.output = this.options.output || './src';

    try {
      // Load templates first
      await this.loadTemplates();

      // 1. Generate Aggregate Root
      console.log(Colors.info('📊 Generating Aggregate Root...'));
      this.options.type = 'aggregate';
      this.options.name = domainOptions.aggregateName;
      files.push(...(await this.generateFiles(this.prepareTemplateContext())));

      // 2. Generate Entities
      for (const entityName of domainOptions.entityNames) {
        console.log(Colors.info(`🏢 Generating Entity: ${entityName}...`));
        this.options.type = 'entity';
        this.options.name = entityName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 3. Generate Value Objects
      for (const voName of domainOptions.valueObjects) {
        console.log(Colors.info(`💎 Generating Value Object: ${voName}...`));
        this.options.type = 'value-object';
        this.options.name = voName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 4. Generate Domain Events
      for (const eventName of domainOptions.events) {
        console.log(Colors.info(`⚡ Generating Domain Event: ${eventName}...`));
        this.options.type = 'event';
        this.options.name = eventName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 5. Generate Commands
      for (const commandName of domainOptions.commands) {
        console.log(Colors.info(`⚡ Generating Command: ${commandName}...`));
        this.options.type = 'command';
        this.options.name = commandName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 6. Generate Queries
      for (const queryName of domainOptions.queries) {
        console.log(Colors.info(`🔍 Generating Query: ${queryName}...`));
        this.options.type = 'query';
        this.options.name = queryName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 7. Generate Repository (if requested)
      if (domainOptions.includeRepository) {
        console.log(Colors.info(`🏪 Generating Repository...`));
        this.options.type = 'repository';
        this.options.name = `${domainOptions.aggregateName}Repository`;
        this.options.entityName = domainOptions.aggregateName;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 8. Generate Domain Service (if requested)
      if (domainOptions.includeDomainService) {
        console.log(Colors.info(`🔧 Generating Domain Service...`));
        this.options.type = 'domain-service';
        this.options.name = `${domainOptions.domainName}Service`;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // 9. Generate Specifications (if requested)
      if (domainOptions.includeSpecs) {
        console.log(Colors.info(`📋 Generating Specifications...`));
        // Generate specs for aggregate and entities
        const componentsToSpec = [domainOptions.aggregateName, ...domainOptions.entityNames];
        for (const componentName of componentsToSpec) {
          this.options.type = 'specification';
          this.options.name = `${componentName}Specification`;
          files.push(...(await this.generateFiles(this.prepareTemplateContext())));
        }
      }

      // 10. Generate ACL components (if requested)
      if (domainOptions.includeACL) {
        console.log(Colors.info(`🛡️  Generating ACL components...`));
        // ACL Adapter
        this.options.type = 'domain-service'; // Use domain service template for ACL
        this.options.name = `${domainOptions.domainName}ACLAdapter`;
        files.push(...(await this.generateFiles(this.prepareTemplateContext())));
      }

      // Write all files
      if (!this.options.dryRun) {
        console.log('');
        console.log(Colors.info('📝 Writing files...'));
        for (const file of files) {
          await this.writeFile(file);
        }
      }

      // Summary
      console.log('');
      console.log(
        Colors.success(`✅ Generated complete domain context: ${domainOptions.domainName}`)
      );
      console.log(Colors.info(`📊 Total files: ${files.length}`));
      console.log('');

      // Show structure
      this.showDomainStructure(domainOptions, files);
    } catch (error) {
      console.error('');
      console.error(
        Colors.error(
          `❌ Domain context generation failed: ${error instanceof Error ? error.message : error}`
        )
      );
      throw error;
    }
  }

  /**
   * Show generated domain structure
   */
  private showDomainStructure(
    domainOptions: DomainContextOptions,
    _files: Array<{ path: string; content: string }>
  ): void {
    console.log(Colors.bold('🏗️  Generated Domain Structure:'));
    console.log('');
    console.log(`📁 ${domainOptions.domainName}/`);
    console.log(`├── 📊 ${domainOptions.aggregateName}Aggregate`);

    domainOptions.entityNames.forEach(entity => {
      console.log(`├── 🏢 ${entity}Entity`);
    });

    domainOptions.valueObjects.forEach(vo => {
      console.log(`├── 💎 ${vo}ValueObject`);
    });

    domainOptions.events.forEach(event => {
      console.log(`├── ⚡ ${event}Event`);
    });

    domainOptions.commands.forEach(cmd => {
      console.log(`├── ⚡ ${cmd}Command`);
    });

    domainOptions.queries.forEach(query => {
      console.log(`├── 🔍 ${query}Query`);
    });

    if (domainOptions.includeRepository) {
      console.log(`├── 🏪 ${domainOptions.aggregateName}Repository`);
    }

    if (domainOptions.includeDomainService) {
      console.log(`├── 🔧 ${domainOptions.domainName}Service`);
    }

    if (domainOptions.includeSpecs) {
      console.log(`└── 📋 Specifications`);
    }

    console.log('');
    console.log(Colors.info('💡 All components are interconnected and ready for DDD development!'));
  }

  /**
   * Generate component from example
   */
  private async generateFromExample(): Promise<void> {
    console.log(Colors.info(`🔨 Generating from example: ${this.options.example}...`));

    try {
      // Parse the example
      const parser = new UnifiedExampleParser();
      const parsedExample = await parser.parseExample({
        exampleId: this.options.example!,
        framework:
          this.options.framework === 'standalone' ? undefined : (this.options.framework as any),
      });

      // Prepare context from parsed example
      const context = this.prepareExampleContext(parsedExample);

      // Generate files based on example
      const files = await this.generateFilesFromExample(context, parsedExample);

      if (this.options.dryRun) {
        console.log(Colors.yellow('🔍 Dry run mode - files that would be generated:'));
        files.forEach(file => {
          console.log(`  ${Colors.cyan('•')} ${file.path}`);
        });
      } else {
        // Write files
        for (const file of files) {
          await this.writeFile(file);
        }

        console.log(Colors.success(`✅ Generated ${files.length} files from example`));

        // Show usage instructions
        console.log('');
        console.log(Colors.bold('🚀 Generated from Example:'));
        console.log(`  ${Colors.cyan('Example:')} ${parsedExample.base.metadata.name}`);
        console.log(`  ${Colors.cyan('Component:')} ${this.options.name}`);
        console.log(`  ${Colors.cyan('Framework:')} ${this.options.framework}`);

        if (this.options.only?.length) {
          console.log(`  ${Colors.cyan('Components:')} ${this.options.only.join(', ')}`);
        }

        if (parsedExample.framework) {
          console.log(
            `  ${Colors.cyan('Framework Components:')} ${Array.from(parsedExample.framework.components.keys()).join(', ')}`
          );
        }

        this.showNextSteps();
      }
    } catch (error) {
      console.error('');
      console.error(
        Colors.error(
          `❌ Failed to generate from example: ${error instanceof Error ? error.message : error}`
        )
      );
      throw error;
    }
  }

  /**
   * Prepare context from parsed example
   */
  private prepareExampleContext(parsedExample: any): Record<string, unknown> {
    const name = this.options.name || 'DefaultName';
    const example = parsedExample.base.metadata;

    return {
      name,
      fileName: this.toKebabCase(name),
      className: this.toPascalCase(name),
      camelName: this.toCamelCase(name),
      description: example.description,
      domain: example.domain,
      framework: this.options.framework || 'standalone',
      timestamp: new Date().toISOString(),
      author: 'VytchesDDD CLI',
      version: '1.0.0',
      // Example-specific context
      example: {
        id: example.id,
        name: example.name,
        complexity: example.complexity,
        patterns: example.patterns || [],
        version: '1.0.0',
      },
      // Base example content
      baseContent: parsedExample.base.content,
      // Framework content if available
      frameworkContent: parsedExample.framework,
      // Available components
      availableComponents: parsedExample.merged.availableComponents,
    };
  }

  /**
   * Generate files from example
   */
  private async generateFilesFromExample(
    context: Record<string, unknown>,
    parsedExample: any
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    // Generate base component file
    const baseFile = {
      path: this.getMainFilePathFromExample(context),
      content: this.renderBaseExampleContent(context, parsedExample),
    };
    files.push(baseFile);

    // Generate framework-specific files if available
    if (parsedExample.framework && this.options.framework !== 'standalone') {
      const frameworkFiles = await this.generateFrameworkFilesFromExample(context, parsedExample);
      files.push(...frameworkFiles);
    }

    // Generate test file if requested
    if (this.options.withTests && parsedExample.base.content.testExample) {
      const testFile = {
        path: this.getTestFilePathFromExample(context),
        content: this.renderTestExampleContent(context, parsedExample),
      };
      files.push(testFile);
    }

    return files;
  }

  /**
   * Render base example content
   */
  private renderBaseExampleContent(context: Record<string, unknown>, parsedExample: any): string {
    const baseContent = parsedExample.base.content;

    // Replace placeholders in example code
    let content = baseContent.codeExample;

    // Replace example names with actual component name
    const exampleName = parsedExample.base.metadata.name;
    const componentName = context.className as string;

    content = content.replace(new RegExp(exampleName, 'g'), componentName);
    content = content.replace(
      new RegExp(this.toKebabCase(exampleName), 'g'),
      context.fileName as string
    );

    // Add supporting types
    if (baseContent.supportingTypes) {
      content += `\n\n${baseContent.supportingTypes}`;
    }

    return content;
  }

  /**
   * Generate framework files from example
   */
  private async generateFrameworkFilesFromExample(
    context: Record<string, unknown>,
    parsedExample: any
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    if (!parsedExample.framework) {
      return files;
    }

    // Filter components based on only/exclude options
    const parser = new UnifiedExampleParser();
    const filteredComponents = parser.filterComponents(parsedExample.framework.components, {
      only: this.options.only as any,
      exclude: this.options.exclude as any,
    });

    // Generate file for each component
    for (const [componentType, componentCode] of filteredComponents.entries()) {
      const file = {
        path: this.getFrameworkFilePathFromExample(context, componentType),
        content: this.renderFrameworkComponentContent(context, componentCode, componentType),
      };
      files.push(file);
    }

    return files;
  }

  /**
   * Render framework component content
   */
  private renderFrameworkComponentContent(
    context: Record<string, unknown>,
    componentCode: string,
    componentType: string
  ): string {
    const componentName = context.className as string;
    const fileName = context.fileName as string;

    // Replace placeholders in component code
    let content = componentCode;

    // Replace generic names with actual component name
    content = content.replace(/Order/g, componentName);
    content = content.replace(/order/g, fileName);
    content = content.replace(/ORDER/g, componentName.toUpperCase());

    return content;
  }

  /**
   * Render test example content
   */
  private renderTestExampleContent(context: Record<string, unknown>, parsedExample: any): string {
    const testContent = parsedExample.base.content.testExample;
    const componentName = context.className as string;
    const fileName = context.fileName as string;

    // Replace placeholders in test code
    let content = testContent;

    // Replace example names with actual component name
    content = content.replace(/Order/g, componentName);
    content = content.replace(/order/g, fileName);

    return content;
  }

  /**
   * Get main file path from example
   */
  private getMainFilePathFromExample(context: Record<string, unknown>): string {
    const output = this.options.output || './src';
    const fileName = `${context.fileName}.ts`;

    return FileSystem.joinPath(output, 'domain', fileName);
  }

  /**
   * Get framework file path from example
   */
  private getFrameworkFilePathFromExample(
    context: Record<string, unknown>,
    componentType: string
  ): string {
    const output = this.options.output || './src';
    const fileName = `${context.fileName}.${componentType}.ts`;

    const pathMap: Record<string, string> = {
      module: 'modules',
      service: 'services',
      controller: 'controllers',
      repository: 'repositories',
      dto: 'dto',
      config: 'config',
      middleware: 'middleware',
      guard: 'guards',
      interceptor: 'interceptors',
    };

    const folder = pathMap[componentType] || componentType;
    return FileSystem.joinPath(output, folder, fileName);
  }

  /**
   * Get test file path from example
   */
  private getTestFilePathFromExample(context: Record<string, unknown>): string {
    const output = this.options.output || './src';
    const fileName = `${context.fileName}.test.ts`;

    return FileSystem.joinPath(output, '../tests', fileName);
  }
}

/**
 * Generate documentation for a package
 */
async function generateDocumentationForPackage(
  packageName: string,
  options: GenerateOptions
): Promise<void> {
  try {
    console.log(Colors.cyan(`📚 Generating documentation for package: ${packageName}`));
    console.log('');

    const generator = new DocumentationGenerator();

    // Parse complexity levels
    const complexityLevels = options.complexity
      ? options.complexity.split(',').map(c => c.trim())
      : undefined;

    // Generate documentation
    const result = await generator.generate({
      packageName,
      ...(complexityLevels && { complexityLevels }),
      ...(options.framework && { framework: options.framework }),
      ...(options.llmOptimized && { llmOptimized: options.llmOptimized }),
      ...(options.llm && { llmOptimized: options.llm }),
      ...(options.showRelated && { showRelated: options.showRelated }),
      ...(options.maxExamples && { maxExamples: options.maxExamples }),
      randomize: !options.noRandomize,
      ...(options.seed && { seed: options.seed }),
      ...(options.diOnly && { diOnly: options.diOnly }),
      ...(options.output && { outputPath: options.output }),
    });

    console.log(Colors.green(`✅ Documentation generated: ${result.outputPath}`));

    if (options.llmOptimized || options.llm) {
      console.log(Colors.cyan('💡 Tip: Use this file with LLM prompts for code generation'));
    }

    if (result.randomizedExamples && result.randomizedExamples.length > 0) {
      console.log(
        Colors.yellow('🎲 Examples were randomized. Run again to see different examples')
      );
    }
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Failed to generate documentation: ${error instanceof Error ? error.message : error}`
      )
    );
    process.exit(1);
  }
}
