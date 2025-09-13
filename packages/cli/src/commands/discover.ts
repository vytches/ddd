/**
 * DX-005: AI-Powered Interface Discovery Command
 *
 * Provides intelligent discovery of DDD patterns and APIs through natural language queries
 */

import { Colors } from '../core/utils/colors';
import { DiscoveryEngine } from '../engines/discovery-engine';

interface DiscoverOptions {
  help?: boolean;
  framework?: string;
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  pattern?: string;
  scenario?: string;
  format?: 'quick' | 'guided' | 'detailed';
  verbose?: boolean;
  validate?: boolean;
}

export const discoverCommand = {
  name: 'discover',
  description: 'AI-powered discovery of DDD patterns and APIs',

  async action(args: string[], options: DiscoverOptions): Promise<void> {
    if (options.help) {
      showHelp();
      return;
    }

    try {
      // Initialize discovery engine
      const discoveryEngine = new DiscoveryEngine();

      // Get query from args or interactive prompt
      const query = args.join(' ') || (await promptForQuery());

      if (!query.trim()) {
        console.error(Colors.red('❌ Please provide a discovery query'));
        console.log('Example: vytches-ddd discover "event-driven architecture"');
        return;
      }

      // Perform discovery
      console.log(Colors.cyan(`🔍 Discovering patterns for: "${query}"`));
      console.log('');

      const result = await discoveryEngine.discover(query, {
        framework: options.framework,
        complexity: options.complexity || 'beginner',
        format: options.format || 'quick',
        validate: options.validate || false,
      });

      // Display results
      await displayDiscoveryResult(result, options);
    } catch (error) {
      console.error(
        Colors.red('❌ Discovery failed:'),
        error instanceof Error ? error.message : error
      );

      if (options.verbose) {
        console.log('');
        console.log(Colors.dim('💡 Try:'));
        console.log(Colors.dim('  - Simpler keywords: "aggregates", "events", "cqrs"'));
        console.log(Colors.dim('  - Specific patterns: "event sourcing", "domain validation"'));
        console.log(Colors.dim('  - Framework context: --framework nestjs'));
      }

      process.exit(1);
    }
  },
};

function showHelp(): void {
  console.log(Colors.yellow('🔍 VytchesDDD AI-Powered Discovery'));
  console.log('');
  console.log(
    'Discover DDD patterns, APIs, and implementation guidance through natural language queries.'
  );
  console.log('');
  console.log('Usage: discover <query> [options]');
  console.log('       discover [options]  # Interactive mode');
  console.log('');
  console.log('Examples:');
  console.log('  discover "event-driven architecture"');
  console.log('  discover "How do I create aggregates?"');
  console.log('  discover "validation with business rules"');
  console.log('  discover "NestJS integration" --framework nestjs');
  console.log('  discover "CQRS setup" --complexity intermediate --format guided');
  console.log('');
  console.log('Query Types:');
  console.log('  • Pattern Discovery: "event sourcing", "cqrs", "domain validation"');
  console.log('  • Use Case Queries: "I need event-driven app", "How to validate business rules?"');
  console.log('  • Integration Help: "NestJS setup", "Express integration"');
  console.log('  • Learning Paths: "DDD fundamentals", "advanced patterns"');
  console.log('');
  console.log('Options:');
  console.log('  --framework <name>      Framework context (nestjs, express, fastify)');
  console.log('  --complexity <level>    Complexity level (beginner, intermediate, advanced)');
  console.log('  --format <type>         Output format (quick, guided, detailed)');
  console.log('  --pattern <name>        Specific pattern to focus on');
  console.log('  --scenario <name>       Predefined scenario exploration');
  console.log('  --validate              Validate recommendations against current codebase');
  console.log('  --verbose               Show detailed discovery process');
  console.log('  --help                  Show this help message');
  console.log('');
  console.log('Output Formats:');
  console.log('  quick     📋 Package recommendations + quick imports (30 seconds)');
  console.log('  guided    🚀 Step-by-step implementation guide (5 minutes)');
  console.log('  detailed  📚 Complete learning path with examples (15 minutes)');
  console.log('');
  console.log('Features:');
  console.log('  🤖 Natural language understanding');
  console.log('  📦 Smart package recommendations');
  console.log('  🎯 Context-aware guidance');
  console.log('  ⚡ Always current with actual codebase');
  console.log('  🏗️ Framework-specific integration patterns');
}

async function promptForQuery(): Promise<string> {
  console.log(Colors.cyan('🔍 AI-Powered Discovery Mode'));
  console.log('');
  console.log('What would you like to discover about VytchesDDD?');
  console.log('');
  console.log(Colors.dim('Examples:'));
  console.log(Colors.dim('  • "How do I create aggregates with events?"'));
  console.log(Colors.dim('  • "Event-driven architecture setup"'));
  console.log(Colors.dim('  • "Business rule validation patterns"'));
  console.log(Colors.dim('  • "NestJS integration with CQRS"'));
  console.log('');

  // Simple prompt for now - could be enhanced with interactive CLI later
  console.log(Colors.yellow('💡 For now, please specify your query as an argument:'));
  console.log(Colors.yellow('   vytches-ddd discover "your query here"'));

  return '';
}

async function displayDiscoveryResult(result: any, options: DiscoverOptions): Promise<void> {
  const format = options.format || 'quick';

  switch (format) {
    case 'quick':
      await displayQuickResult(result);
      break;
    case 'guided':
      await displayGuidedResult(result);
      break;
    case 'detailed':
      await displayDetailedResult(result);
      break;
    default:
      await displayQuickResult(result);
  }

  // Show next steps
  console.log('');
  console.log(Colors.cyan('🔧 Next steps:'));
  console.log('  discover --format guided     # Get step-by-step implementation guide');
  console.log('  examples generate <package>  # Generate working examples');
  console.log('  quick-start --generate       # Create project-specific quick start');
}

async function displayQuickResult(result: any): Promise<void> {
  console.log(Colors.green('📦 Package Recommendations:'));

  if (result.packages && result.packages.length > 0) {
    result.packages.forEach((pkg: any, index: number) => {
      console.log(`  ${index + 1}. ${Colors.yellow(pkg.name)} - ${pkg.description}`);
      if (pkg.quickStart) {
        console.log(Colors.dim(`     ${pkg.quickStart}`));
      }
    });
  } else {
    console.log(Colors.yellow('  No specific packages found. Try a more specific query.'));
  }

  if (result.imports) {
    console.log('');
    console.log(Colors.green('⚡ Quick Start:'));
    console.log(Colors.dim(result.imports));
  }
}

async function displayGuidedResult(result: any): Promise<void> {
  console.log(Colors.green('🚀 Step-by-Step Implementation Guide:'));

  if (result.steps && result.steps.length > 0) {
    result.steps.forEach((step: any, index: number) => {
      console.log(`\n${Colors.yellow(`Step ${index + 1}:`)} ${step.title}`);
      console.log(Colors.dim(`⏱️  ${step.estimatedTime}`));
      console.log(step.description);

      if (step.code) {
        console.log('');
        console.log(Colors.dim(step.code));
      }
    });
  }
}

async function displayDetailedResult(result: any): Promise<void> {
  console.log(Colors.green('📚 Complete Learning Path:'));

  if (result.learningPath) {
    console.log(`⏱️  Estimated time: ${result.learningPath.estimatedTime}`);
    console.log(`🎯 Target: ${result.learningPath.target}`);
    console.log('');

    if (result.learningPath.concepts) {
      console.log(Colors.yellow('Core Concepts:'));
      result.learningPath.concepts.forEach((concept: string) => {
        console.log(`  • ${concept}`);
      });
      console.log('');
    }
  }

  await displayGuidedResult(result);
}
