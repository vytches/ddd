import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { suggestCommand } from '../../src/commands/suggest';
import { CommandSuggester } from '../../src/core/suggestions/command-suggester';
import { ContextAwarePromptEngine } from '../../src/core/prompts/context-aware-prompts';

// Mock all dependencies
vi.mock('../../src/core/suggestions/command-suggester');
vi.mock('../../src/core/prompts/context-aware-prompts');
vi.mock('../../src/core/utils/colors', () => ({
  Colors: {
    bold: vi.fn(text => text),
    cyan: vi.fn(text => text),
    error: vi.fn(text => text),
    green: vi.fn(text => text),
    yellow: vi.fn(text => text),
    red: vi.fn(text => text),
    dim: vi.fn(text => text),
    warning: vi.fn(text => text),
  },
}));

// Mock types
const mockCommandSuggester = CommandSuggester as any;
const mockContextAwarePromptEngine = ContextAwarePromptEngine as any;

describe('suggestCommand', () => {
  let mockSuggesterInstance: {
    needsInitialization: ReturnType<typeof vi.fn>;
    getQuickSuggestion: ReturnType<typeof vi.fn>;
    getSuggestions: ReturnType<typeof vi.fn>;
    displaySuggestions: ReturnType<typeof vi.fn>;
  };

  let mockPromptEngineInstance: {
    analyzeContext: ReturnType<typeof vi.fn>;
    displayAnalysis: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock suggester instance
    mockSuggesterInstance = {
      needsInitialization: vi.fn().mockResolvedValue(false),
      getQuickSuggestion: vi.fn().mockResolvedValue({
        command: 'vytches-ddd generate aggregate Order',
        description: 'Create an Order aggregate',
        reason: 'Your domain would benefit from a central Order aggregate',
        priority: 'high' as const,
        category: 'next-step' as const,
        confidence: 0.9,
      }),
      getSuggestions: vi.fn().mockResolvedValue([
        {
          command: 'vytches-ddd generate aggregate Order',
          description: 'Create an Order aggregate',
          reason: 'Your domain would benefit from a central Order aggregate',
          priority: 'high' as const,
          category: 'next-step' as const,
          confidence: 0.9,
        },
        {
          command: 'vytches-ddd test',
          description: 'Run test suite',
          reason: 'Ensure code quality with automated testing',
          priority: 'medium' as const,
          category: 'improvement' as const,
          confidence: 0.8,
        },
      ]),
      displaySuggestions: vi.fn(),
    };

    mockCommandSuggester.create = vi.fn().mockReturnValue(mockSuggesterInstance);

    // Mock prompt engine instance
    mockPromptEngineInstance = {
      analyzeContext: vi.fn().mockResolvedValue({
        projectType: 'domain-driven',
        patterns: ['cqrs', 'event-sourcing'],
        coverage: 85,
        recommendations: ['Add more tests', 'Implement monitoring'],
      }),
      displayAnalysis: vi.fn(),
    };

    mockContextAwarePromptEngine.create = vi.fn().mockReturnValue(mockPromptEngineInstance);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });

    // Mock process.exit and process.cwd
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/project');
  });

  describe('command configuration', () => {
    it('should have correct name and description', () => {
      expect(suggestCommand.name).toBe('suggest');
      expect(suggestCommand.description).toBe(
        'Get intelligent command suggestions based on your project state'
      );
      expect(suggestCommand.aliases).toEqual(['s', 'hint', 'next']);
    });

    it('should have required options', () => {
      const options: any[] = suggestCommand.options || [];
      expect(options).toBeDefined();
      expect(options.length).toBeGreaterThan(0);

      // Check for key options
      const quickOption = options.find((opt: any) => opt.flags.includes('--quick'));
      const categoryOption = options.find((opt: any) => opt.flags.includes('--category'));
      const analysisOption = options.find((opt: any) => opt.flags.includes('--analysis'));
      const pathOption = options.find((opt: any) => opt.flags.includes('--path'));

      expect(quickOption).toBeDefined();
      expect(categoryOption).toBeDefined();
      expect(categoryOption.choices).toEqual(['next-step', 'improvement', 'fix', 'enhancement']);
      expect(analysisOption).toBeDefined();
      expect(pathOption).toBeDefined();
    });

    it('should have examples', () => {
      expect(suggestCommand.examples).toBeDefined();
      expect(((suggestCommand.examples as any[]) || []).length).toBeGreaterThan(0);
    });
  });

  describe('initialization suggestions', () => {
    it('should show initialization suggestions when project needs setup', async () => {
      mockSuggesterInstance.needsInitialization.mockResolvedValue(true);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.needsInitialization).toHaveBeenCalledWith('/mock/project');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Getting Started with VytchesDDD')
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('vytches-ddd init'));
    });

    it('should use custom path when provided', async () => {
      mockSuggesterInstance.needsInitialization.mockResolvedValue(true);

      const args: string[] = [];
      const options = { path: '/custom/path' };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.needsInitialization).toHaveBeenCalledWith('/custom/path');
    });
  });

  describe('project analysis', () => {
    it('should show project analysis when requested', async () => {
      const args: string[] = [];
      const options = { analysis: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockContextAwarePromptEngine.create).toHaveBeenCalled();
      expect(mockPromptEngineInstance.analyzeContext).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowType: 'analysis',
          step: 1,
          totalSteps: 1,
        })
      );
      expect(mockPromptEngineInstance.displayAnalysis).toHaveBeenCalled();
    });

    it('should handle analysis errors gracefully', async () => {
      mockPromptEngineInstance.analyzeContext.mockRejectedValue(new Error('Analysis failed'));

      const args: string[] = [];
      const options = { analysis: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unable to perform detailed analysis')
      );
    });
  });

  describe('quick suggestions', () => {
    it('should show quick suggestion when available', async () => {
      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.getQuickSuggestion).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Quick Suggestion'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd generate aggregate Order')
      );
    });

    it('should show well-structured message when no quick suggestion', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue(null);

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Great! Your project looks well structured')
      );
    });

    it('should show confidence when below threshold', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue({
        command: 'vytches-ddd test',
        description: 'Run tests',
        reason: 'Low test coverage detected',
        priority: 'medium' as const,
        category: 'improvement' as const,
        confidence: 0.7, // Below 0.8 threshold
      });

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Confidence: 70%'));
    });

    it('should not show confidence when above threshold', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue({
        command: 'vytches-ddd generate aggregate Order',
        description: 'Create an Order aggregate',
        reason: 'Your domain would benefit from a central Order aggregate',
        priority: 'high' as const,
        category: 'next-step' as const,
        confidence: 0.9, // Above 0.8 threshold
      });

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      // Should not contain confidence info
      const logCalls = (console.log as any).mock.calls;
      const hasConfidence = logCalls.some((call: any[]) =>
        call.some((arg: string) => typeof arg === 'string' && arg.includes('Confidence:'))
      );
      expect(hasConfidence).toBe(false);
    });
  });

  describe('all suggestions', () => {
    it('should show all suggestions when not in quick mode', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.getSuggestions).toHaveBeenCalledWith('/mock/project');
      expect(mockSuggesterInstance.displaySuggestions).toHaveBeenCalledWith([
        expect.objectContaining({
          command: 'vytches-ddd generate aggregate Order',
          priority: 'high',
        }),
        expect.objectContaining({
          command: 'vytches-ddd test',
          priority: 'medium',
        }),
      ]);
    });

    it('should filter suggestions by category', async () => {
      const args: string[] = [];
      const options = { category: 'next-step' };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.displaySuggestions).toHaveBeenCalledWith([
        expect.objectContaining({
          category: 'next-step',
        }),
      ]);
    });

    it('should handle no suggestions found', async () => {
      mockSuggesterInstance.getSuggestions.mockResolvedValue([]);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Great! Your project looks well structured')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd analyze --type architecture')
      );
    });

    it('should handle no suggestions in specific category', async () => {
      mockSuggesterInstance.getSuggestions.mockResolvedValue([
        {
          command: 'vytches-ddd test',
          description: 'Run tests',
          reason: 'Testing needed',
          priority: 'medium' as const,
          category: 'improvement' as const,
          confidence: 0.8,
        },
      ]);

      const args: string[] = [];
      const options = { category: 'fix' }; // No suggestions in 'fix' category

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No suggestions found in category: fix')
      );
    });

    it('should show helpful footer with tips', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tips:'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd suggest --quick')
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('vytches-ddd workflow'));
    });
  });

  describe('priority colors', () => {
    it('should display suggestions with priority-based colors', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue({
        command: 'vytches-ddd fix-critical-issue',
        description: 'Fix critical security vulnerability',
        reason: 'Security issue detected',
        priority: 'high' as const,
        category: 'fix' as const,
        confidence: 0.95,
      });

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      // Verify that the command is displayed (priority color handling is in the UI layer)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd fix-critical-issue')
      );
    });

    it('should handle medium priority suggestions', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue({
        command: 'vytches-ddd improve-performance',
        description: 'Optimize performance',
        reason: 'Performance could be improved',
        priority: 'medium' as const,
        category: 'improvement' as const,
        confidence: 0.75,
      });

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd improve-performance')
      );
    });

    it('should handle low priority suggestions', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockResolvedValue({
        command: 'vytches-ddd add-documentation',
        description: 'Add more documentation',
        reason: 'Documentation could be enhanced',
        priority: 'low' as const,
        category: 'enhancement' as const,
        confidence: 0.6,
      });

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('vytches-ddd add-documentation')
      );
    });
  });

  describe('error handling', () => {
    it('should handle suggester creation errors', async () => {
      mockCommandSuggester.create.mockImplementation(() => {
        throw new Error('Suggester creation failed');
      });

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate suggestions: Suggester creation failed')
      );
    });

    it('should handle suggestion retrieval errors', async () => {
      mockSuggesterInstance.getSuggestions.mockRejectedValue(new Error('Network error'));

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate suggestions: Network error')
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockSuggesterInstance.getQuickSuggestion.mockRejectedValue('String error');

      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate suggestions: String error')
      );
    });

    it('should handle initialization check errors', async () => {
      mockSuggesterInstance.needsInitialization.mockRejectedValue(new Error('File system error'));

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate suggestions: File system error')
      );
    });
  });

  describe('complex scenarios', () => {
    it('should combine analysis and quick suggestion', async () => {
      const args: string[] = [];
      const options = { analysis: true, quick: true };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockPromptEngineInstance.analyzeContext).toHaveBeenCalled();
      expect(mockSuggesterInstance.getQuickSuggestion).toHaveBeenCalled();
    });

    it('should handle filtered suggestions with analysis', async () => {
      const args: string[] = [];
      const options = {
        analysis: true,
        category: 'improvement',
        path: '/custom/analysis/path',
      };

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockPromptEngineInstance.analyzeContext).toHaveBeenCalledWith(
        expect.objectContaining({
          outputPath: '/custom/analysis/path',
        })
      );
      expect(mockSuggesterInstance.getSuggestions).toHaveBeenCalledWith('/custom/analysis/path');
    });

    it('should handle empty project path gracefully', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue('');

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await suggestCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockSuggesterInstance.needsInitialization).toHaveBeenCalledWith('');
    });
  });
});
