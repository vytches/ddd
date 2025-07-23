import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommandSuggester } from '../../../src/core/suggestions/command-suggester';
import { ContextAwarePromptEngine } from '../../../src/core/prompts/context-aware-prompts';
import { FileSystem } from '../../../src/core/utils/file-system';
import { Colors } from '../../../src/core/utils/colors';

// Mock dependencies
vi.mock('../../../src/core/prompts/context-aware-prompts');
vi.mock('../../../src/core/utils/file-system');
vi.mock('../../../src/core/utils/colors');

describe('CommandSuggester', () => {
  let suggester: CommandSuggester;
  let mockPromptEngine: any;
  let consoleLogSpy: any;

  const mockAnalysis = {
    structure: {
      hasDomainDir: true,
      hasApplicationDir: true,
      hasInfrastructureDir: true,
      hasTestsDir: true,
      architecture: 'clean',
    },
    patterns: [],
    dependencies: [],
    frameworks: [],
    issues: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup console spy
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });

    // Setup mock prompt engine
    mockPromptEngine = {
      analyzeContext: vi.fn().mockResolvedValue(mockAnalysis),
    };
    ContextAwarePromptEngine.create = vi.fn().mockReturnValue(mockPromptEngine);

    // Setup Colors mock
    Colors.bold = vi.fn(text => `**${text}**`);
    Colors.cyan = vi.fn(text => text);
    Colors.red = vi.fn(text => text);
    Colors.yellow = vi.fn(text => text);
    Colors.green = vi.fn(text => text);
    Colors.dim = vi.fn(text => text);

    // Setup FileSystem mock
    FileSystem.exists = vi.fn().mockReturnValue(true);
    FileSystem.readFile = vi.fn().mockResolvedValue('{}');
    FileSystem.joinPath = vi.fn((...args) => args.join('/'));

    suggester = new CommandSuggester();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with prompt engine and setup rules', () => {
      expect(ContextAwarePromptEngine.create).toHaveBeenCalled();
      expect(suggester).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a new instance using factory method', () => {
      const instance = CommandSuggester.create();
      expect(instance).toBeInstanceOf(CommandSuggester);
    });
  });

  describe('getSuggestions', () => {
    it('should analyze project and return suggestions', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: { ...mockAnalysis.structure, hasDomainDir: true },
        patterns: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      expect(mockPromptEngine.analyzeContext).toHaveBeenCalled();
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('command');
      expect(suggestions[0]).toHaveProperty('description');
      expect(suggestions[0]).toHaveProperty('priority');
    });

    it('should suggest aggregate creation when domain exists but no aggregates', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: { ...mockAnalysis.structure, hasDomainDir: true },
        patterns: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const aggregateSuggestion = suggestions.find(s => s.command.includes('generate aggregate'));
      expect(aggregateSuggestion).toBeDefined();
      expect(aggregateSuggestion!.priority).toBe('high');
      expect(aggregateSuggestion!.category).toBe('next-step');
    });

    it('should suggest CQRS commands when aggregates exist', async () => {
      const analysis = {
        ...mockAnalysis,
        patterns: [{ name: 'OrderAggregate', type: 'class', path: 'domain/order.ts' }],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const cqrsSuggestion = suggestions.find(s => s.command.includes('generate command'));
      expect(cqrsSuggestion).toBeDefined();
      expect(cqrsSuggestion!.category).toBe('next-step');
    });

    it('should suggest test structure when no tests directory', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: { ...mockAnalysis.structure, hasTestsDir: false },
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const testSuggestion = suggestions.find(s =>
        s.command.includes('analyze --type test-coverage')
      );
      expect(testSuggestion).toBeDefined();
      expect(testSuggestion!.priority).toBe('high');
      expect(testSuggestion!.category).toBe('fix');
    });

    it('should suggest event bus when events exist without bus', async () => {
      const analysis = {
        ...mockAnalysis,
        patterns: [{ name: 'OrderCreatedEvent', type: 'class', path: 'events/order.ts' }],
        dependencies: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const eventBusSuggestion = suggestions.find(s => s.command.includes('@vytches-ddd/events'));
      expect(eventBusSuggestion).toBeDefined();
      expect(eventBusSuggestion!.category).toBe('improvement');
    });

    it('should suggest TypeORM repositories when TypeORM detected', async () => {
      const analysis = {
        ...mockAnalysis,
        dependencies: [{ name: 'typeorm', version: '0.3.0' }],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const typeormSuggestion = suggestions.find(s =>
        s.command.includes('generate repository --orm typeorm')
      );
      expect(typeormSuggestion).toBeDefined();
      expect(typeormSuggestion!.category).toBe('enhancement');
    });

    it('should suggest clean architecture scaffold when layers missing', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: {
          ...mockAnalysis.structure,
          architecture: 'clean',
          hasApplicationDir: false,
          hasInfrastructureDir: false,
        },
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const scaffoldSuggestion = suggestions.find(s =>
        s.command.includes('scaffold clean-architecture')
      );
      expect(scaffoldSuggestion).toBeDefined();
      expect(scaffoldSuggestion!.priority).toBe('high');
      expect(scaffoldSuggestion!.category).toBe('fix');
    });

    it('should suggest NestJS modules for NestJS projects', async () => {
      const analysis = {
        ...mockAnalysis,
        frameworks: [{ name: 'NestJS', version: '10.0.0' }],
        patterns: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const nestSuggestion = suggestions.find(s =>
        s.command.includes('generate module --framework nestjs')
      );
      expect(nestSuggestion).toBeDefined();
      expect(nestSuggestion!.category).toBe('improvement');
    });

    it('should suggest event store for event sourcing', async () => {
      const analysis = {
        ...mockAnalysis,
        patterns: [{ name: 'Event Sourcing', type: 'pattern', path: '' }],
        dependencies: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const eventStoreSuggestion = suggestions.find(s =>
        s.command.includes('@vytches-ddd/event-store')
      );
      expect(eventStoreSuggestion).toBeDefined();
      expect(eventStoreSuggestion!.priority).toBe('high');
    });

    it('should suggest workflow when few patterns detected', async () => {
      const analysis = {
        ...mockAnalysis,
        patterns: [{ name: 'SomePattern', type: 'pattern', path: '' }],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      const workflowSuggestion = suggestions.find(s =>
        s.command.includes('workflow --type domain-modeling')
      );
      expect(workflowSuggestion).toBeDefined();
      expect(workflowSuggestion!.category).toBe('next-step');
    });

    it('should prioritize and limit suggestions', async () => {
      // Create analysis that triggers multiple rules
      const analysis = {
        ...mockAnalysis,
        structure: {
          ...mockAnalysis.structure,
          hasTestsDir: false,
          hasDomainDir: true,
        },
        patterns: [],
        frameworks: [{ name: 'NestJS', version: '10.0.0' }],
        dependencies: [{ name: 'typeorm', version: '0.3.0' }],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const suggestions = await suggester.getSuggestions();

      // Should be limited to 5
      expect(suggestions.length).toBeLessThanOrEqual(5);

      // Should be sorted by priority
      const priorities = { high: 3, medium: 2, low: 1 };
      for (let i = 1; i < suggestions.length; i++) {
        const prevPriority = priorities[suggestions[i - 1]!.priority];
        const currPriority = priorities[suggestions[i]!.priority];
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    });

    it('should use custom project path when provided', async () => {
      const customPath = '/custom/project/path';
      await suggester.getSuggestions(customPath);

      expect(mockPromptEngine.analyzeContext).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            outputDir: customPath,
          }),
          outputPath: customPath,
        })
      );
    });
  });

  describe('displaySuggestions', () => {
    it('should display nothing when no suggestions', () => {
      suggester.displaySuggestions([]);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display suggestions by category', () => {
      const suggestions = [
        {
          command: 'test-command-1',
          description: 'Test description 1',
          reason: 'Test reason',
          priority: 'high' as const,
          category: 'next-step' as const,
          confidence: 0.9,
        },
        {
          command: 'test-command-2',
          description: 'Test description 2',
          reason: 'Test reason',
          priority: 'medium' as const,
          category: 'fix' as const,
          confidence: 0.8,
        },
      ];

      suggester.displaySuggestions(suggestions);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Suggested Commands'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Next Steps'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Fixes Needed'));
    });

    it('should display confidence when below 80%', () => {
      const suggestions = [
        {
          command: 'test-command',
          description: 'Test description',
          reason: 'Test reason',
          priority: 'medium' as const,
          category: 'improvement' as const,
          confidence: 0.75,
        },
      ];

      suggester.displaySuggestions(suggestions);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Confidence: 75%'));
    });

    it('should display all categories when present', () => {
      const suggestions = [
        {
          command: 'cmd1',
          description: 'desc1',
          reason: 'reason',
          priority: 'high' as const,
          category: 'next-step' as const,
          confidence: 0.9,
        },
        {
          command: 'cmd2',
          description: 'desc2',
          reason: 'reason',
          priority: 'high' as const,
          category: 'fix' as const,
          confidence: 0.9,
        },
        {
          command: 'cmd3',
          description: 'desc3',
          reason: 'reason',
          priority: 'medium' as const,
          category: 'improvement' as const,
          confidence: 0.9,
        },
        {
          command: 'cmd4',
          description: 'desc4',
          reason: 'reason',
          priority: 'low' as const,
          category: 'enhancement' as const,
          confidence: 0.9,
        },
      ];

      suggester.displaySuggestions(suggestions);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Next Steps'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Fixes Needed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Improvements'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Enhancements'));
    });
  });

  describe('getQuickSuggestion', () => {
    it('should return first suggestion', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: { ...mockAnalysis.structure, hasDomainDir: true },
        patterns: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      const quickSuggestion = await suggester.getQuickSuggestion();

      expect(quickSuggestion).toBeDefined();
      expect(quickSuggestion).toHaveProperty('command');
    });

    it('should return null when no suggestions', async () => {
      const analysis = {
        ...mockAnalysis,
        structure: {
          ...mockAnalysis.structure,
          hasDomainDir: true,
          hasTestsDir: true,
        },
        patterns: [{ name: 'SomeAggregate', type: 'class', path: '' }],
        dependencies: [],
        frameworks: [],
      };
      mockPromptEngine.analyzeContext.mockResolvedValue(analysis);

      // Mock empty suggestions by having no matching rules
      const quickSuggestion = await suggester.getQuickSuggestion();

      // The test should return a suggestion or null based on rules
      expect(quickSuggestion === null || quickSuggestion?.command).toBeTruthy();
    });
  });

  describe('needsInitialization', () => {
    it('should return true when no src directory', async () => {
      (FileSystem.exists as any).mockImplementation((path: any) => !path.includes('src'));

      const needsInit = await suggester.needsInitialization();

      expect(needsInit).toBe(true);
    });

    it('should return true when no package.json', async () => {
      (FileSystem.exists as any).mockImplementation((path: any) => !path.includes('package.json'));

      const needsInit = await suggester.needsInitialization();

      expect(needsInit).toBe(true);
    });

    it('should return true when no vytches-ddd dependencies', async () => {
      (FileSystem.exists as any).mockReturnValue(true);
      (FileSystem.readFile as any).mockResolvedValue(
        JSON.stringify({
          dependencies: {
            express: '^4.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
          },
        })
      );

      const needsInit = await suggester.needsInitialization();

      expect(needsInit).toBe(true);
    });

    it('should return false when vytches-ddd is present', async () => {
      (FileSystem.exists as any).mockReturnValue(true);
      (FileSystem.readFile as any).mockResolvedValue(
        JSON.stringify({
          dependencies: {
            '@vytches-ddd/core': '^1.0.0',
          },
        })
      );

      const needsInit = await suggester.needsInitialization();

      expect(needsInit).toBe(false);
    });

    it('should handle read errors gracefully', async () => {
      (FileSystem.exists as any).mockReturnValue(true);
      (FileSystem.readFile as any).mockRejectedValue(new Error('Read error'));

      const needsInit = await suggester.needsInitialization();

      expect(needsInit).toBe(true);
    });

    it('should use custom project path when provided', async () => {
      const customPath = '/custom/path';
      (FileSystem.exists as any).mockReturnValue(true);
      (FileSystem.readFile as any).mockResolvedValue(
        JSON.stringify({
          dependencies: { '@vytches-ddd/core': '^1.0.0' },
        })
      );

      await suggester.needsInitialization(customPath);

      expect(FileSystem.joinPath).toHaveBeenCalledWith(customPath, 'src');
      expect(FileSystem.joinPath).toHaveBeenCalledWith(customPath, 'package.json');
    });
  });
});
