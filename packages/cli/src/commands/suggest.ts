/**
 * @fileoverview Suggest Command
 * Smart command suggestions based on project state and context
 */

import type { Command } from '../types';
import { Colors } from '../core/utils/colors';
import { CommandSuggester } from '../core/suggestions/command-suggester';
import { ContextAwarePromptEngine } from '../core/prompts/context-aware-prompts';

/**
 * Suggest command implementation
 */
export const suggestCommand: Command = {
  name: 'suggest',
  description: 'Get intelligent command suggestions based on your project state',
  aliases: ['s', 'hint', 'next'],
  options: [
    {
      flags: '--quick',
      description: 'Show only the top suggestion'
    },
    {
      flags: '--category <type>',
      description: 'Filter by suggestion category',
      choices: ['next-step', 'improvement', 'fix', 'enhancement']
    },
    {
      flags: '--analysis',
      description: 'Show detailed project analysis before suggestions'
    },
    {
      flags: '--path <path>',
      description: 'Path to analyze (default: current directory)'
    }
  ],
  examples: [
    'vytches-ddd suggest',
    'vytches-ddd suggest --quick',
    'vytches-ddd suggest --category next-step',
    'vytches-ddd suggest --analysis'
  ],
  action: async (_args: string[], options: Record<string, unknown>) => {
    try {
      const suggester = CommandSuggester.create();
      const path = (options.path as string) || process.cwd();

      // Check if project needs initialization
      if (await suggester.needsInitialization(path)) {
        showInitializationSuggestions();
        return;
      }

      // Show project analysis if requested
      if (options.analysis) {
        await showProjectAnalysis(path);
      }

      // Get suggestions
      if (options.quick) {
        await showQuickSuggestion(suggester, path);
      } else {
        await showAllSuggestions(suggester, path, options.category as string);
      }

    } catch (error) {
      console.error(Colors.error(`Failed to generate suggestions: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  }
};

/**
 * Show initialization suggestions for new projects
 */
function showInitializationSuggestions(): void {
  console.log(Colors.bold(Colors.cyan('🚀 Getting Started with VytchesDDD')));
  console.log('');

  console.log(Colors.yellow('Your project needs initialization. Here are the next steps:'));
  console.log('');

  console.log(Colors.green('1. Initialize project structure:'));
  console.log(`   ${Colors.cyan('vytches-ddd init')}`);
  console.log('');

  console.log(Colors.green('2. Start interactive domain modeling:'));
  console.log(`   ${Colors.cyan('vytches-ddd workflow --type domain-modeling')}`);
  console.log('');

  console.log(Colors.green('3. Add DDD packages:'));
  console.log(`   ${Colors.cyan('pnpm add @vytches-ddd/core @vytches-ddd/events')}`);
  console.log('');

  console.log(Colors.dim('💡 Use "vytches-ddd suggest" again after initialization for more specific suggestions.'));
}

/**
 * Show detailed project analysis
 */
async function showProjectAnalysis(path: string): Promise<void> {
  const promptEngine = ContextAwarePromptEngine.create();

  try {
    const analysis = await promptEngine.analyzeContext({
      config: {
        outputDir: path,
        debug: false,
        templateDir: '',
        projectStructure: 'clean-architecture',
        framework: 'nestjs',
        patterns: [],
        plugins: []
      },
      answers: {},
      outputPath: path
    });

    promptEngine.displayAnalysis(analysis);
  } catch (error) {
    console.log(Colors.warning('Unable to perform detailed analysis.'));
  }
}

/**
 * Show quick suggestion
 */
async function showQuickSuggestion(suggester: CommandSuggester, path: string): Promise<void> {
  const suggestion = await suggester.getQuickSuggestion();

  if (!suggestion) {
    console.log(Colors.green('🎉 Great! Your project looks well structured.'));
    console.log(Colors.dim('Use "vytches-ddd suggest" (without --quick) for enhancement suggestions.'));
    return;
  }

  console.log(Colors.bold('💡 Quick Suggestion:'));
  console.log('');

  const priorityColor = {
    high: Colors.red,
    medium: Colors.yellow,
    low: Colors.green
  };

  console.log(`${priorityColor[suggestion.priority]('▶')} ${Colors.bold(suggestion.command)}`);
  console.log(`   ${suggestion.description}`);
  console.log(`   ${Colors.dim(suggestion.reason)}`);

  if (suggestion.confidence < 0.8) {
    console.log(`   ${Colors.dim(`Confidence: ${Math.round(suggestion.confidence * 100)}%`)}`);
  }
}

/**
 * Show all suggestions with filtering
 */
async function showAllSuggestions(
  suggester: CommandSuggester,
  path: string,
  category?: string
): Promise<void> {
  let suggestions = await suggester.getSuggestions(path);

  // Filter by category if specified
  if (category) {
    suggestions = suggestions.filter(s => s.category === category);
  }

  if (suggestions.length === 0) {
    if (category) {
      console.log(Colors.yellow(`No suggestions found in category: ${category}`));
    } else {
      console.log(Colors.green('🎉 Great! Your project looks well structured.'));
      console.log(Colors.dim('Your project follows DDD best practices. Consider running analysis for deeper insights:'));
      console.log(Colors.dim('vytches-ddd analyze --type architecture'));
    }
    return;
  }

  suggester.displaySuggestions(suggestions);

  // Show helpful footer
  console.log('');
  console.log(Colors.dim('💡 Tips:'));
  console.log(Colors.dim('• Use "vytches-ddd suggest --quick" for the most important suggestion'));
  console.log(Colors.dim('• Use "vytches-ddd suggest --analysis" to see detailed project analysis'));
  console.log(Colors.dim('• Use "vytches-ddd workflow" for interactive guided development'));
}
