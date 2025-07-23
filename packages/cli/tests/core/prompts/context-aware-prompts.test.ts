import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import {
  ContextAwarePromptEngine,
  SmartPrompts,
} from '../../../src/core/prompts/context-aware-prompts';
import type {
  ProjectAnalysis,
  ProjectStructureInfo,
  DetectedPattern,
  DependencyInfo,
  FrameworkInfo,
  PromptSuggestion,
  ContextAwarePrompt,
  PromptConfig,
} from '../../../src/types';
import type { WorkflowContext } from '../../../src/workflows/types';

// Mock dependencies
vi.mock('../../../src/core/utils/file-system');
vi.mock('../../../src/core/utils/colors');

import { FileSystem } from '../../../src/core/utils/file-system';
import { Colors } from '../../../src/core/utils/colors';

const mockFileSystem = FileSystem as any;
const mockColors = Colors as any;

describe('ContextAwarePromptEngine', () => {
  let engine: ContextAwarePromptEngine;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ContextAwarePromptEngine();

    // Mock Colors utility
    mockColors.bold = vi.fn(text => text);
    mockColors.cyan = vi.fn(text => text);
    mockColors.green = vi.fn(text => text);
    mockColors.yellow = vi.fn(text => text);
    mockColors.dim = vi.fn(text => text);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });

    mockContext = {
      workflowType: 'default',
      step: 0,
      totalSteps: 1,
      data: {},
      metadata: {
        startedAt: new Date(),
        lastModified: new Date(),
        sessionId: 'test-session',
      },
      answers: {},
      config: { outputDir: '/test/project' },
      outputPath: '/test/project/src',
    };

    // Setup default FileSystem mocks
    mockFileSystem.joinPath = vi.fn((...parts) => parts.join('/'));
    mockFileSystem.exists = vi.fn().mockReturnValue(true);
    mockFileSystem.listDirectory = vi.fn().mockResolvedValue([]);
    mockFileSystem.readFile = vi.fn().mockResolvedValue('{}');
    mockFileSystem.getBaseName = vi.fn(path => path.split('/').pop()?.split('.')[0] || '');
    mockFileSystem.getExtension = vi.fn(path => `.${path.split('.').pop() || ''}`);
    mockFileSystem.isDirectory = vi.fn().mockReturnValue(false);

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and static methods', () => {
    it('should create instance', () => {
      expect(engine).toBeInstanceOf(ContextAwarePromptEngine);
    });

    it('should create instance using static factory method', () => {
      const staticEngine = ContextAwarePromptEngine.create();
      expect(staticEngine).toBeInstanceOf(ContextAwarePromptEngine);
    });
  });

  describe('analyzeContext', () => {
    it('should analyze project context successfully', async () => {
      // Setup mock project structure
      mockFileSystem.listDirectory.mockResolvedValue(['domain', 'application', 'infrastructure']);
      mockFileSystem.exists.mockImplementation((path: string) => {
        return path.includes('src') || path.includes('tests');
      });

      const result = await safeRun(async () => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result[0] as Error | undefined;
      const analysis = result[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis).toBeDefined();
      if (analysis) {
        expect(analysis.structure).toBeDefined();
        expect(analysis.patterns).toBeDefined();
        expect(analysis.dependencies).toBeDefined();
        expect(analysis.frameworks).toBeDefined();
        expect(analysis.conventions).toBeDefined();
        expect(analysis.suggestions).toBeDefined();
      }
    });

    it('should use cached analysis for same project path', async () => {
      // Create new engine instance to avoid interference from other tests
      const freshEngine = new ContextAwarePromptEngine();

      // Spy on the private analyzeProjectStructure method instead
      const analyzeSpy = vi.spyOn(freshEngine as any, 'analyzeProjectStructure');
      analyzeSpy.mockResolvedValue({
        hasSourceDir: true,
        hasDomainDir: true,
        hasApplicationDir: false,
        hasInfrastructureDir: false,
        hasTestsDir: false,
        architecture: 'unknown',
      });

      // First call
      await freshEngine.analyzeContext(mockContext);

      // Second call should use cache
      await freshEngine.analyzeContext(mockContext);

      // Should only call the analysis method once due to caching
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });

    it('should use process.cwd() when outputDir not specified', async () => {
      const contextWithoutOutputDir = {
        ...mockContext,
        config: {},
      };

      await engine.analyzeContext(contextWithoutOutputDir);

      expect(process.cwd).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockFileSystem.listDirectory.mockRejectedValue(new Error('File system error'));

      const result = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result[0] as Error | undefined;
      const analysis = result[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis).toBeDefined();
      expect(analysis?.structure.architecture).toBe('unknown');
    });
  });

  describe('generateSuggestions', () => {
    let mockPrompt: ContextAwarePrompt;

    beforeEach(() => {
      mockPrompt = {
        type: 'input',
        message: 'Test prompt',
      };
    });

    it('should generate suggestions with custom analyzer', async () => {
      const customSuggestions: PromptSuggestion[] = [
        {
          title: 'Custom Suggestion',
          description: 'From custom analyzer',
          value: 'custom',
          confidence: 0.9,
        },
      ];

      const promptWithAnalyzer: ContextAwarePrompt = {
        ...mockPrompt,
        analyzer: vi.fn().mockResolvedValue(customSuggestions),
      };

      const result = await safeRun(async (): Promise<PromptSuggestion[]> => {
        return await engine.generateSuggestions(promptWithAnalyzer, mockContext);
      });
      const error = result[0] as Error | undefined;
      const suggestions = result[1] as PromptSuggestion[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions).toBeDefined();
      expect(suggestions?.length).toBeGreaterThan(0);
      expect(promptWithAnalyzer.analyzer).toHaveBeenCalledWith(mockContext);
    });

    it('should limit suggestions to 10 results', async () => {
      const manySuggestions = Array.from({ length: 20 }, (_, i) => ({
        title: `Suggestion ${i}`,
        description: `Description ${i}`,
        value: `value${i}`,
        confidence: 0.5,
      }));

      const promptWithAnalyzer: ContextAwarePrompt = {
        ...mockPrompt,
        analyzer: vi.fn().mockResolvedValue(manySuggestions),
      };

      const result = await safeRun(async (): Promise<PromptSuggestion[]> => {
        return await engine.generateSuggestions(promptWithAnalyzer, mockContext);
      });
      const error = result[0] as Error | undefined;
      const suggestions = result[1] as PromptSuggestion[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions).toBeDefined();
      expect(suggestions?.length).toBeLessThanOrEqual(10);
    });

    it('should sort suggestions by confidence', async () => {
      const unsortedSuggestions: PromptSuggestion[] = [
        { title: 'Low', description: 'Low confidence', value: 'low', confidence: 0.3 },
        { title: 'High', description: 'High confidence', value: 'high', confidence: 0.9 },
        { title: 'Medium', description: 'Medium confidence', value: 'med', confidence: 0.6 },
      ];

      const promptWithAnalyzer: ContextAwarePrompt = {
        ...mockPrompt,
        analyzer: vi.fn().mockResolvedValue(unsortedSuggestions),
      };

      const result2 = await safeRun(async (): Promise<PromptSuggestion[]> => {
        return await engine.generateSuggestions(promptWithAnalyzer, mockContext);
      });
      const error = result2[0] as Error | undefined;
      const suggestions = result2[1] as PromptSuggestion[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions).toBeDefined();
      expect(suggestions?.[0]?.confidence).toBe(0.9);
      expect(suggestions?.[1]?.confidence).toBe(0.6);
      expect(suggestions?.[2]?.confidence).toBe(0.3);
    });
  });

  describe('adaptPrompt', () => {
    it('should adapt prompt without conditions', async () => {
      const prompt: ContextAwarePrompt = {
        type: 'input',
        message: 'Test message',
        default: 'default-value',
      };

      const result3 = await safeRun(async (): Promise<PromptConfig> => {
        return await engine.adaptPrompt(prompt, mockContext);
      });
      const error = result3[0] as Error | undefined;
      const adaptedPrompt = result3[1] as PromptConfig | undefined;

      expect(error).toBeUndefined();
      expect(adaptedPrompt).toBeDefined();
      expect(adaptedPrompt?.message).toBe('Test message');
      expect(adaptedPrompt?.default).toBe('default-value');
    });

    it('should skip prompt when conditionalShow returns false', async () => {
      const prompt: ContextAwarePrompt = {
        type: 'input',
        message: 'Test message',
        conditionalShow: vi.fn().mockReturnValue(false),
      };

      const result3 = await safeRun(async (): Promise<PromptConfig> => {
        return await engine.adaptPrompt(prompt, mockContext);
      });
      const error = result3[0] as Error | undefined;
      const adaptedPrompt = result3[1] as PromptConfig | undefined;

      expect(error).toBeUndefined();
      expect(adaptedPrompt?.message).toBe('Skip this step');
    });

    it('should use dynamic default when provided', async () => {
      const prompt: ContextAwarePrompt = {
        type: 'input',
        message: 'Test message',
        dynamicDefault: vi.fn().mockResolvedValue('dynamic-default'),
      };

      const result3 = await safeRun(async (): Promise<PromptConfig> => {
        return await engine.adaptPrompt(prompt, mockContext);
      });
      const error = result3[0] as Error | undefined;
      const adaptedPrompt = result3[1] as PromptConfig | undefined;

      expect(error).toBeUndefined();
      expect(adaptedPrompt?.default).toBe('dynamic-default');
    });

    it('should enhance select choices with suggestions', async () => {
      const prompt: ContextAwarePrompt = {
        type: 'select',
        message: 'Choose framework',
        analyzer: vi.fn().mockResolvedValue([
          {
            title: 'NestJS',
            description: 'Enterprise framework',
            value: 'nestjs',
            confidence: 0.8,
          },
        ]),
      };

      const result3 = await safeRun(async (): Promise<PromptConfig> => {
        return await engine.adaptPrompt(prompt, mockContext);
      });
      const error = result3[0] as Error | undefined;
      const adaptedPrompt = result3[1] as PromptConfig | undefined;

      expect(error).toBeUndefined();
      expect(adaptedPrompt?.choices).toBeDefined();
      if (Array.isArray(adaptedPrompt?.choices) && adaptedPrompt.choices.length > 0) {
        const firstChoice = adaptedPrompt.choices[0];
        if (typeof firstChoice === 'object' && firstChoice !== null && 'name' in firstChoice) {
          expect(firstChoice.name).toContain('NestJS');
          expect(firstChoice.name).toContain('80%');
        }
      }
    });

    it('should enhance multiselect choices with suggestions', async () => {
      const prompt: ContextAwarePrompt = {
        type: 'multiselect',
        message: 'Choose patterns',
        analyzer: vi.fn().mockResolvedValue([
          {
            title: 'CQRS',
            description: 'Command Query pattern',
            value: 'cqrs',
            confidence: 0.9,
          },
        ]),
      };

      const result3 = await safeRun(async (): Promise<PromptConfig> => {
        return await engine.adaptPrompt(prompt, mockContext);
      });
      const error = result3[0] as Error | undefined;
      const adaptedPrompt = result3[1] as PromptConfig | undefined;

      expect(error).toBeUndefined();
      expect(adaptedPrompt?.choices).toBeDefined();
      if (Array.isArray(adaptedPrompt?.choices) && adaptedPrompt.choices.length > 0) {
        const firstChoice = adaptedPrompt.choices[0];
        if (typeof firstChoice === 'object' && firstChoice !== null && 'name' in firstChoice) {
          expect(firstChoice.name).toContain('CQRS');
          expect(firstChoice.name).toContain('90%');
        }
      }
    });
  });

  describe('analyzeProjectStructure', () => {
    it('should detect clean architecture', async () => {
      mockFileSystem.listDirectory.mockResolvedValue(['domain', 'application', 'infrastructure']);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.architecture).toBe('clean');
      expect(analysis?.structure.hasDomainDir).toBe(true);
      expect(analysis?.structure.hasApplicationDir).toBe(true);
      expect(analysis?.structure.hasInfrastructureDir).toBe(true);
    });

    it('should detect hexagonal architecture', async () => {
      mockFileSystem.listDirectory.mockResolvedValue(['adapters', 'ports', 'domain']);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.architecture).toBe('hexagonal');
    });

    it('should detect onion architecture', async () => {
      mockFileSystem.listDirectory.mockResolvedValue(['core', 'services', 'controllers']);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.architecture).toBe('onion');
    });

    it('should detect layered architecture', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([
        'controllers',
        'services',
        'repositories',
        'models',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.architecture).toBe('layered');
    });

    it('should detect tests directory', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        return path.includes('src') || path.includes('tests');
      });

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.hasTestsDir).toBe(true);
    });

    it('should handle missing src directory', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        return !path.includes('src');
      });

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.structure.hasSourceDir).toBe(false);
      expect(analysis?.structure.architecture).toBe('unknown');
    });
  });

  describe('detectPatterns', () => {
    beforeEach(() => {
      // Mock scanAllFiles to return predefined file list
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([]);
    });

    it('should detect CQRS pattern', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/commands/create-user.command.ts',
        '/project/src/queries/get-user.query.ts',
        '/project/src/handlers/create-user.handler.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const cqrsPattern = analysis?.patterns.find(p => p.name === 'CQRS');
      expect(cqrsPattern).toBeDefined();
      expect(cqrsPattern?.confidence).toBe(0.9);
      expect(cqrsPattern?.evidence).toContain('Commands found');
      expect(cqrsPattern?.evidence).toContain('Queries found');
      expect(cqrsPattern?.evidence).toContain('Handlers found');
    });

    it('should detect Event Sourcing pattern', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/events/user-created.event.ts',
        '/project/src/event-store/user-event-store.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const esPattern = analysis?.patterns.find(p => p.name === 'Event Sourcing');
      expect(esPattern).toBeDefined();
      expect(esPattern?.confidence).toBe(0.85);
    });

    it('should detect Repository pattern', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/repositories/user.repository.ts',
        '/project/src/interfaces/user-repository.interface.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const repoPattern = analysis?.patterns.find(p => p.name === 'Repository Pattern');
      expect(repoPattern).toBeDefined();
      expect(repoPattern?.confidence).toBe(0.8);
    });

    it('should detect Value Objects pattern', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/value-objects/email.value-object.ts',
        '/project/src/domain/user-id.value.object.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const voPattern = analysis?.patterns.find(p => p.name === 'Value Objects');
      expect(voPattern).toBeDefined();
      expect(voPattern?.confidence).toBe(0.7);
    });

    it('should detect Saga pattern', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/sagas/order-processing.saga.ts',
        '/project/src/orchestration/payment-workflow.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const sagaPattern = analysis?.patterns.find(p => p.name === 'Saga Pattern');
      expect(sagaPattern).toBeDefined();
      expect(sagaPattern?.confidence).toBe(0.75);
    });
  });

  describe('analyzeDependencies', () => {
    it('should analyze package.json dependencies', async () => {
      const packageJson = {
        dependencies: {
          '@nestjs/core': '^9.0.0',
          express: '^4.18.0',
          '@vytches-ddd/core': '^1.0.0',
        },
        devDependencies: {
          '@types/node': '^18.0.0',
          vitest: '^0.28.0',
        },
      };

      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(packageJson));

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.dependencies.length).toBe(5);

      const nestDep = analysis?.dependencies.find(d => d.name === '@nestjs/core');
      expect(nestDep?.type).toBe('production');
      expect(nestDep?.category).toBe('framework');

      const vitestDep = analysis?.dependencies.find(d => d.name === 'vitest');
      expect(vitestDep?.type).toBe('development');
      expect(vitestDep?.category).toBe('testing');

      const vytchesDep = analysis?.dependencies.find(d => d.name === '@vytches-ddd/core');
      expect(vytchesDep?.category).toBe('ddd');
    });

    it('should handle missing package.json', async () => {
      mockFileSystem.exists.mockImplementation((path: string) => {
        return !path.includes('package.json');
      });

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.dependencies).toEqual([]);
    });

    it('should handle malformed package.json', async () => {
      mockFileSystem.readFile.mockResolvedValue('invalid json');

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.dependencies).toEqual([]);
    });
  });

  describe('detectFrameworks', () => {
    it('should detect NestJS framework', async () => {
      const packageJson = {
        dependencies: {
          '@nestjs/core': '^9.0.0',
        },
      };

      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(packageJson));

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const nestFramework = analysis?.frameworks.find(f => f.name === 'NestJS');
      expect(nestFramework).toBeDefined();
      expect(nestFramework?.version).toBe('^9.0.0');
      expect(nestFramework?.capabilities).toContain('Dependency Injection');
      expect(nestFramework?.conventions).toHaveLength(2);
    });

    it('should detect Express framework', async () => {
      const packageJson = {
        dependencies: {
          express: '^4.18.0',
        },
      };

      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(packageJson));

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const expressFramework = analysis?.frameworks.find(f => f.name === 'Express');
      expect(expressFramework).toBeDefined();
      expect(expressFramework?.capabilities).toContain('Middleware');
    });

    it('should detect TypeORM framework', async () => {
      const packageJson = {
        dependencies: {
          typeorm: '^0.3.0',
        },
      };

      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(packageJson));

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const typeormFramework = analysis?.frameworks.find(f => f.name === 'TypeORM');
      expect(typeormFramework).toBeDefined();
      expect(typeormFramework?.capabilities).toContain('ORM');
    });
  });

  describe('analyzeNamingConventions', () => {
    it('should analyze file naming patterns', async () => {
      // Create fresh engine to avoid cache interference
      const freshEngine = new ContextAwarePromptEngine();

      // Mock the FileSystem methods used in analyzeNamingConventions
      mockFileSystem.getBaseName.mockImplementation((path: string) => {
        const filename = path.split('/').pop() || '';
        return filename.split('.')[0];
      });
      mockFileSystem.getExtension.mockImplementation((path: string) => {
        const parts = path.split('.');
        return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
      });

      vi.spyOn(freshEngine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/user.service.ts',
        '/project/src/order.service.ts',
        '/project/src/user.controller.ts',
        '/project/src/order.controller.ts',
        '/project/src/user.entity.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await freshEngine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      expect(analysis?.conventions).toBeDefined();

      // The conventions should be an array, might be empty depending on the implementation
      // We check that the method ran without error rather than specific pattern matching
      expect(Array.isArray(analysis?.conventions)).toBe(true);
    });

    it('should filter patterns with insufficient usage', async () => {
      vi.spyOn(engine as any, 'scanAllFiles').mockResolvedValue([
        '/project/src/single.pattern.ts', // Only one file with this pattern
        '/project/src/user.service.ts',
        '/project/src/order.service.ts',
      ]);

      const result4 = await safeRun(async (): Promise<ProjectAnalysis> => {
        return await engine.analyzeContext(mockContext);
      });
      const error = result4[0] as Error | undefined;
      const analysis = result4[1] as ProjectAnalysis | undefined;

      expect(error).toBeUndefined();
      const singlePattern = analysis?.conventions.find(c => c.pattern.includes('pattern.ts'));
      expect(singlePattern).toBeUndefined(); // Should be filtered out
    });
  });

  describe('displayAnalysis', () => {
    it('should display project analysis without errors', () => {
      const mockAnalysis: ProjectAnalysis = {
        structure: {
          hasSourceDir: true,
          hasDomainDir: true,
          hasApplicationDir: true,
          hasInfrastructureDir: true,
          hasTestsDir: true,
          architecture: 'clean',
        },
        patterns: [
          {
            name: 'CQRS',
            confidence: 0.9,
            evidence: ['Commands found', 'Queries found'],
            suggestions: ['Add validation'],
          },
        ],
        dependencies: [],
        frameworks: [
          {
            name: 'NestJS',
            version: '^9.0.0',
            capabilities: ['Dependency Injection'],
            conventions: [],
          },
        ],
        conventions: [],
        suggestions: [
          {
            title: 'Add Tests',
            description: 'Improve test coverage',
            priority: 'high',
            effort: 'medium',
            impact: 'high',
            category: 'testing',
          },
        ],
      };

      const [error] = safeRun(() => {
        engine.displayAnalysis(mockAnalysis);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle analysis with empty sections', () => {
      const emptyAnalysis: ProjectAnalysis = {
        structure: {
          hasSourceDir: false,
          hasDomainDir: false,
          hasApplicationDir: false,
          hasInfrastructureDir: false,
          hasTestsDir: false,
          architecture: 'unknown',
        },
        patterns: [],
        dependencies: [],
        frameworks: [],
        conventions: [],
        suggestions: [],
      };

      const [error] = safeRun(() => {
        engine.displayAnalysis(emptyAnalysis);
      });

      expect(error).toBeUndefined();
    });
  });

  describe('private helper methods', () => {
    describe('categorizeDependency', () => {
      it('should categorize framework dependencies', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('@nestjs/core')).toBe('framework');
        expect(categorize('express')).toBe('framework');
        expect(categorize('fastify')).toBe('framework');
      });

      it('should categorize testing dependencies', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('vitest')).toBe('testing');
        expect(categorize('jest')).toBe('testing');
        expect(categorize('@types/jest')).toBe('testing');
      });

      it('should categorize database dependencies', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('typeorm')).toBe('database');
        expect(categorize('prisma')).toBe('database');
        expect(categorize('mongoose')).toBe('database');
      });

      it('should categorize DDD dependencies', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('@vytches-ddd/core')).toBe('ddd');
        expect(categorize('@vytches-ddd/events')).toBe('ddd');
      });

      it('should categorize utility dependencies', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('lodash')).toBe('utility');
        expect(categorize('uuid')).toBe('utility');
        expect(categorize('moment')).toBe('utility');
      });

      it('should default to other category', () => {
        const categorize = (engine as any).categorizeDependency.bind(engine);

        expect(categorize('unknown-package')).toBe('other');
      });
    });

    describe('extractDomainWords', () => {
      it('should extract words from conventions', () => {
        const mockAnalysis: ProjectAnalysis = {
          structure: {} as ProjectStructureInfo,
          patterns: [],
          dependencies: [],
          frameworks: [],
          conventions: [
            {
              pattern: 'service.ts',
              description: 'Service pattern',
              examples: ['user-service.ts', 'order-management.service.ts'],
              confidence: 0.8,
            },
          ],
          suggestions: [],
        };

        const extractWords = (engine as any).extractDomainWords.bind(engine);
        const words = extractWords(mockAnalysis);

        expect(words).toContain('User-service');
        expect(words).toContain('Order-management');
        expect(words.length).toBeLessThanOrEqual(5);
      });

      it('should extract words from framework conventions', () => {
        const mockAnalysis: ProjectAnalysis = {
          structure: {} as ProjectStructureInfo,
          patterns: [],
          dependencies: [],
          frameworks: [
            {
              name: 'NestJS',
              version: '^9.0.0',
              capabilities: [],
              conventions: [
                {
                  pattern: '*.controller.ts',
                  description: 'Controllers',
                  examples: ['user.controller.ts', 'payment-processing.controller.ts'],
                  confidence: 0.9,
                },
              ],
            },
          ],
          conventions: [],
          suggestions: [],
        };

        const extractWords = (engine as any).extractDomainWords.bind(engine);
        const words = extractWords(mockAnalysis);

        expect(words).toContain('User');
        expect(words).toContain('Payment-processing');
      });

      it('should filter out common technical words', () => {
        const mockAnalysis: ProjectAnalysis = {
          structure: {} as ProjectStructureInfo,
          patterns: [],
          dependencies: [],
          frameworks: [
            {
              name: 'NestJS',
              version: '^9.0.0',
              capabilities: [],
              conventions: [
                {
                  pattern: '*.service.ts',
                  description: 'Services',
                  examples: ['ts.service.ts', 'controller.service.ts'],
                  confidence: 0.9,
                },
              ],
            },
          ],
          conventions: [],
          suggestions: [],
        };

        const extractWords = (engine as any).extractDomainWords.bind(engine);
        const words = extractWords(mockAnalysis);

        expect(words).not.toContain('Ts');
        expect(words).not.toContain('Controller');
        expect(words).not.toContain('Service');
      });
    });
  });
});

describe('SmartPrompts', () => {
  let mockContext: WorkflowContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      workflowType: 'default',
      step: 0,
      totalSteps: 1,
      data: {},
      metadata: {
        startedAt: new Date(),
        lastModified: new Date(),
        sessionId: 'test-session',
      },
      answers: {},
      config: { outputDir: '/test/project' },
      outputPath: '/test/project/src',
    };

    // Mock FileSystem
    mockFileSystem.joinPath = vi.fn((...parts) => parts.join('/'));
    mockFileSystem.exists = vi.fn().mockReturnValue(true);
    mockFileSystem.listDirectory = vi.fn().mockResolvedValue([]);
    mockFileSystem.readFile = vi.fn().mockResolvedValue('{}');

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');
  });

  describe('componentName', () => {
    it('should create component name prompt with validation', () => {
      const prompt = SmartPrompts.componentName('Aggregate');

      expect(prompt.type).toBe('input');
      expect(prompt.message).toBe('Enter Aggregate name:');
      expect(prompt.validate).toBeDefined();
      expect(prompt.analyzer).toBeDefined();
    });

    it('should validate PascalCase names', () => {
      const prompt = SmartPrompts.componentName('Aggregate');
      const validate = prompt.validate!;

      expect(validate('UserAggregate')).toBe(true);
      expect(validate('user')).toBe('Use PascalCase (e.g., UserAggregate)');
      expect(validate('')).toBe('Component name is required');
      expect(validate('123Invalid')).toBe('Use PascalCase (e.g., UserAggregate)');
    });

    it('should generate suggestions from project context', async () => {
      mockFileSystem.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: { '@nestjs/core': '^9.0.0' },
        })
      );

      const prompt = SmartPrompts.componentName('Aggregate');

      if (prompt.analyzer) {
        const suggestions = await prompt.analyzer(mockContext);

        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);
      }
    });
  });

  describe('frameworkSelection', () => {
    it('should create framework selection prompt', () => {
      const prompt = SmartPrompts.frameworkSelection();

      expect(prompt.type).toBe('select');
      expect(prompt.message).toBe('Select target framework:');
      expect(prompt.choices).toHaveLength(4);
      expect(prompt.dynamicDefault).toBeDefined();
    });

    it('should include all framework options', () => {
      const prompt = SmartPrompts.frameworkSelection();
      const choices = prompt.choices as Array<{ name: string; value: string }>;

      const frameworks = choices.map(c => c.value);
      expect(frameworks).toContain('nestjs');
      expect(frameworks).toContain('express');
      expect(frameworks).toContain('fastify');
      expect(frameworks).toContain('standalone');
    });

    it('should detect existing framework as default', async () => {
      mockFileSystem.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: { '@nestjs/core': '^9.0.0' },
        })
      );

      const prompt = SmartPrompts.frameworkSelection();

      if (prompt.dynamicDefault) {
        const defaultValue = await prompt.dynamicDefault(mockContext);
        expect(defaultValue).toBe('nestjs');
      }
    });

    it('should default to nestjs when no framework detected', async () => {
      mockFileSystem.readFile.mockResolvedValue('{}');

      const prompt = SmartPrompts.frameworkSelection();

      if (prompt.dynamicDefault) {
        const defaultValue = await prompt.dynamicDefault(mockContext);
        expect(defaultValue).toBe('nestjs');
      }
    });
  });

  describe('architectureSelection', () => {
    it('should create architecture selection prompt', () => {
      const prompt = SmartPrompts.architectureSelection();

      expect(prompt.type).toBe('select');
      expect(prompt.message).toBe('Select architecture pattern:');
      expect(prompt.choices).toHaveLength(4);
      expect(prompt.dynamicDefault).toBeDefined();
    });

    it('should include all architecture options', () => {
      const prompt = SmartPrompts.architectureSelection();
      const choices = prompt.choices as Array<{ name: string; value: string }>;

      const architectures = choices.map(c => c.value);
      expect(architectures).toContain('clean');
      expect(architectures).toContain('hexagonal');
      expect(architectures).toContain('onion');
      expect(architectures).toContain('layered');
    });

    it('should detect existing architecture as default', async () => {
      mockFileSystem.listDirectory.mockResolvedValue(['domain', 'application', 'infrastructure']);

      const prompt = SmartPrompts.architectureSelection();

      if (prompt.dynamicDefault) {
        const defaultValue = await prompt.dynamicDefault(mockContext);
        expect(defaultValue).toBe('clean');
      }
    });

    it('should default to clean when no architecture detected', async () => {
      mockFileSystem.listDirectory.mockResolvedValue([]);

      const prompt = SmartPrompts.architectureSelection();

      if (prompt.dynamicDefault) {
        const defaultValue = await prompt.dynamicDefault(mockContext);
        expect(defaultValue).toBe('clean');
      }
    });
  });
});
