import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { FindByTagArgs} from '../../../src/commands/docs/find-by-tag';
import { findByTagCommand } from '../../../src/commands/docs/find-by-tag';
import { SmartTagFinder } from '../../../src/core/smart-tag-finder';
import { logger } from '../../../src/core/utils/logger';
import { promises as fs } from 'fs';
import type { ArgumentsCamelCase } from 'yargs';

// Mock dependencies
vi.mock('../../../src/core/smart-tag-finder');
vi.mock('../../../src/core/utils/logger');
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
  },
}));

describe('find-by-tag command', () => {
  let mockTagFinder: any;
  let mockProcessExit: any;
  let mockConsoleTable: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SmartTagFinder
    mockTagFinder = {
      findExamplesByTag: vi.fn(),
      suggestSimilarTags: vi.fn(),
    };
    vi.mocked(SmartTagFinder).mockImplementation(() => mockTagFinder);

    // Mock logger
    vi.mocked(logger.success).mockImplementation(() => { return });
    vi.mocked(logger.info).mockImplementation(() => { return });
    vi.mocked(logger.warn).mockImplementation(() => { return });
    vi.mocked(logger.error).mockImplementation(() => { return });

    // Mock console.table
    mockConsoleTable = vi.spyOn(console, 'table').mockImplementation(() => { return });

    // Mock process.exit
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleTable.mockRestore();
  });

  describe('command definition', () => {
    it('should have correct command structure', () => {
      expect(findByTagCommand.command).toBe('find-by-tag <tag>');
      expect(findByTagCommand.describe).toBe('Find examples by tag pattern');
      expect(findByTagCommand.builder).toBeDefined();
      expect(findByTagCommand.handler).toBeDefined();
    });

    it('should define all required options', () => {
      const builder = findByTagCommand.builder as any;

      expect(builder.tag).toBeDefined();
      expect(builder.tag.demandOption).toBe(true);
      expect(builder.complexity).toBeDefined();
      expect(builder.complexity.alias).toBe('c');
      expect(builder.framework).toBeDefined();
      expect(builder.framework.alias).toBe('f');
      expect(builder.maxExamples).toBeDefined();
      expect(builder.maxExamples.alias).toBe('m');
      expect(builder.noRandomize).toBeDefined();
      expect(builder.seed).toBeDefined();
      expect(builder.output).toBeDefined();
      expect(builder.output.alias).toBe('o');
    });

    it('should have framework choices defined', () => {
      const builder = findByTagCommand.builder as any;
      expect(builder.framework.choices).toEqual(['nestjs', 'express', 'fastify']);
    });

    it('should have default values set correctly', () => {
      const builder = findByTagCommand.builder as any;
      expect(builder.maxExamples.default).toBe(10);
      expect(builder.noRandomize.default).toBe(false);
    });
  });

  describe('handler execution', () => {
    const mockExamples = [
      {
        id: 'example-1',
        name: 'Basic Policy',
        package: 'policies',
        complexity: 'basic',
        description: 'Basic policy example',
        tags: ['policies:core', 'validation'],
        diSupport: true,
        frameworkIntegrations: ['nestjs'],
      },
      {
        id: 'example-2',
        name: 'Advanced Policy',
        package: 'policies',
        complexity: 'advanced',
        description: 'Advanced policy example',
        tags: ['policies:advanced', 'enterprise'],
        diSupport: false,
        frameworkIntegrations: ['express'],
      },
    ];

    it('should find examples and display in console by default', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(SmartTagFinder).toHaveBeenCalledTimes(1);
      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith('policies:*', undefined, {
        randomize: true,
      });

      expect(logger.info).toHaveBeenCalledWith('🔍 Found 2 examples for tag: policies:*');
      expect(mockConsoleTable).toHaveBeenCalledWith([
        {
          ID: 'example-1',
          Name: 'Basic Policy',
          Package: 'policies',
          Complexity: 'basic',
          DI: '✅',
          Tags: 'policies:core, validation',
        },
        {
          ID: 'example-2',
          Name: 'Advanced Policy',
          Package: 'policies',
          Complexity: 'advanced',
          DI: '❌',
          Tags: 'policies:advanced, enterprise',
        },
      ]);
      expect(logger.info).toHaveBeenCalledWith('🎲 Results were randomized. Use --no-randomize for deterministic results');
    });

    it('should handle all search options', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      const argv = {
        tag: 'policies:advanced',
        complexity: 'intermediate',
        framework: 'nestjs',
        maxExamples: 5,
        noRandomize: true,
        seed: 'test-seed',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith('policies:advanced', 'intermediate', {
        framework: 'nestjs',
        maxExamples: 5,
        randomize: false,
        seed: 'test-seed',
      });

      expect(logger.info).not.toHaveBeenCalledWith('🎲 Results were randomized. Use --no-randomize for deterministic results');
    });

    it('should save results to file when output option is provided', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const argv = {
        tag: 'policies:*',
        output: '/test/results.json',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      const expectedOutput = [
        {
          id: 'example-1',
          name: 'Basic Policy',
          package: 'policies',
          complexity: 'basic',
          description: 'Basic policy example',
          tags: ['policies:core', 'validation'],
          diSupport: true,
          frameworkIntegrations: ['nestjs'],
        },
        {
          id: 'example-2',
          name: 'Advanced Policy',
          package: 'policies',
          complexity: 'advanced',
          description: 'Advanced policy example',
          tags: ['policies:advanced', 'enterprise'],
          diSupport: false,
          frameworkIntegrations: ['express'],
        },
      ];

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/results.json',
        JSON.stringify(expectedOutput, null, 2)
      );
      expect(logger.success).toHaveBeenCalledWith('✅ Results saved to: /test/results.json');
      expect(mockConsoleTable).not.toHaveBeenCalled();
    });

    it('should handle no results found with suggestions', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockResolvedValue(['policies:core', 'policies:advanced']);

      const argv = {
        tag: 'policies:invalid',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(logger.warn).toHaveBeenCalledWith('⚠️  No examples found for tag pattern: policies:invalid');
      expect(mockTagFinder.suggestSimilarTags).toHaveBeenCalledWith('policies:invalid');
      expect(logger.info).toHaveBeenCalledWith('💡 Did you mean:');
      expect(logger.info).toHaveBeenCalledWith('   - policies:core');
      expect(logger.info).toHaveBeenCalledWith('   - policies:advanced');
      expect(mockConsoleTable).not.toHaveBeenCalled();
    });

    it('should handle no results found without suggestions', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockResolvedValue([]);

      const argv = {
        tag: 'invalid:tag',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(logger.warn).toHaveBeenCalledWith('⚠️  No examples found for tag pattern: invalid:tag');
      expect(mockTagFinder.suggestSimilarTags).toHaveBeenCalledWith('invalid:tag');
      expect(logger.info).not.toHaveBeenCalledWith('💡 Did you mean:');
      expect(mockConsoleTable).not.toHaveBeenCalled();
    });

    it('should not show randomization message when noRandomize is true', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      const argv = {
        tag: 'policies:*',
        noRandomize: true,
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(logger.info).not.toHaveBeenCalledWith('🎲 Results were randomized. Use --no-randomize for deterministic results');
    });

    it('should not show randomization message when no examples found', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockResolvedValue([]);

      const argv = {
        tag: 'invalid:tag',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(logger.info).not.toHaveBeenCalledWith('🎲 Results were randomized. Use --no-randomize for deterministic results');
    });

    it('should handle optional parameters correctly', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      const argv = {
        tag: 'policies:*',
        framework: 'nestjs',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith('policies:*', undefined, {
        framework: 'nestjs',
        randomize: true,
      });
    });
  });

  describe('error handling', () => {
    const mockExamples = [
      {
        id: 'example-1',
        name: 'Basic Policy',
        package: 'policies',
        complexity: 'basic',
        description: 'Basic policy example',
        tags: ['policies:core', 'validation'],
        diSupport: true,
        frameworkIntegrations: ['nestjs'],
      },
      {
        id: 'example-2',
        name: 'Advanced Policy',
        package: 'policies',
        complexity: 'advanced',
        description: 'Advanced policy example',
        tags: ['policies:advanced', 'enterprise'],
        diSupport: false,
        frameworkIntegrations: ['express'],
      },
    ];

    it('should handle finder errors gracefully', async () => {
      const finderError = new Error('Tag finder failed');
      mockTagFinder.findExamplesByTag.mockRejectedValue(finderError);

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      const [error] = await safeRun(async () => {
        await findByTagCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to find examples: Tag finder failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'String error message';
      mockTagFinder.findExamplesByTag.mockRejectedValue(stringError);

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      const [error] = await safeRun(async () => {
        await findByTagCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to find examples: String error message');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file write errors', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([mockExamples[0]]);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('File write failed'));

      const argv = {
        tag: 'policies:*',
        output: '/test/results.json',
      } as ArgumentsCamelCase<FindByTagArgs>;

      const [error] = await safeRun(async () => {
        await findByTagCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to find examples: File write failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle SmartTagFinder initialization errors', async () => {
      vi.mocked(SmartTagFinder).mockImplementation(() => {
        throw new Error('SmartTagFinder initialization failed');
      });

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      const [error] = await safeRun(async () => {
        await findByTagCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to find examples: SmartTagFinder initialization failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle suggestion errors gracefully', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockRejectedValue(new Error('Suggestion failed'));

      const argv = {
        tag: 'invalid:tag',
      } as ArgumentsCamelCase<FindByTagArgs>;

      const [error] = await safeRun(async () => {
        await findByTagCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to find examples: Suggestion failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('console table formatting', () => {
        const mockExamples = [
      {
        id: 'example-1',
        name: 'Basic Policy',
        package: 'policies',
        complexity: 'basic',
        description: 'Basic policy example',
        tags: ['policies:core', 'validation'],
        diSupport: true,
        frameworkIntegrations: ['nestjs'],
      },
      {
        id: 'example-2',
        name: 'Advanced Policy',
        package: 'policies',
        complexity: 'advanced',
        description: 'Advanced policy example',
        tags: ['policies:advanced', 'enterprise'],
        diSupport: false,
        frameworkIntegrations: ['express'],
      },
    ];

    it('should format DI support correctly in console table', async () => {
      const examplesWithDiVariations = [
        { ...mockExamples[0], diSupport: true },
        { ...mockExamples[1], diSupport: false },
      ];
      mockTagFinder.findExamplesByTag.mockResolvedValue(examplesWithDiVariations);

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(mockConsoleTable).toHaveBeenCalledWith([
        expect.objectContaining({ DI: '✅' }),
        expect.objectContaining({ DI: '❌' }),
      ]);
    });

    it('should join tags correctly in console table', async () => {
      const exampleWithManyTags = [{
        ...mockExamples[0],
        tags: ['tag1', 'tag2', 'tag3'],
      }];
      mockTagFinder.findExamplesByTag.mockResolvedValue(exampleWithManyTags);

      const argv = {
        tag: 'policies:*',
      } as ArgumentsCamelCase<FindByTagArgs>;

      await findByTagCommand.handler(argv);

      expect(mockConsoleTable).toHaveBeenCalledWith([
        expect.objectContaining({ Tags: 'tag1, tag2, tag3' }),
      ]);
    });
  });
});
