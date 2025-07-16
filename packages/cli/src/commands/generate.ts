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
  properties?: PropertyDefinition[];
  methods?: MethodDefinition[];
  events?: EventDefinition[];
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
  ],
  action: async (args: string[], options: GenerateOptions) => {
    const startTime = Performance.now();

    try {
      console.log(Colors.bold(Colors.cyan('🔧 VytchesDDD Component Generator')));
      console.log(Colors.dim('Generating enterprise-grade DDD components'));
      console.log('');

      // Initialize generator
      const generator = new ComponentGenerator(options);

      // Check if this is a domain context generation request
      if (options.domain && options.fullDomain) {
        await generator.runDomainContextMode();
      } else if (options.domain && !options.type) {
        await generator.runDomainSelectionMode();
      } else if (options.interactive || !options.type || !options.name) {
        await generator.runInteractiveMode();
      } else {
        await generator.runDirectMode();
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
}
