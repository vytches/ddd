import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { GenerateArgs} from '../../../src/commands/docs/generate';
import { generateCommand } from '../../../src/commands/docs/generate';
import { DocumentationGenerator } from '../../../src/generators/documentation-generator';
import { logger } from '../../../src/core/utils/logger';
import type { ArgumentsCamelCase } from 'yargs';
import type { FindByTagArgs } from '../../../src/commands/docs/find-by-tag';

// Mock dependencies
vi.mock('../../../src/generators/documentation-generator');
vi.mock('../../../src/core/utils/logger');

describe('generate command', () => {
  let mockGenerator: any;
  let mockProcessExit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DocumentationGenerator
    mockGenerator = {
      generate: vi.fn(),
    };
    vi.mocked(DocumentationGenerator).mockImplementation(() => mockGenerator);

    // Mock logger
    vi.mocked(logger.success).mockImplementation(() => { return });
    vi.mocked(logger.info).mockImplementation(() => { return });
    vi.mocked(logger.error).mockImplementation(() => { return });

    // Mock process.exit
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
  });

  describe('command definition', () => {
    it('should have correct command structure', () => {
      expect(generateCommand.command).toBe('generate <package>');
      expect(generateCommand.describe).toBe('Generate documentation for a specific package');
      expect(generateCommand.builder).toBeDefined();
      expect(generateCommand.handler).toBeDefined();
    });

    it('should define all required options', () => {
      const builder = generateCommand.builder as any;

      expect(builder.package).toBeDefined();
      expect(builder.package.demandOption).toBe(true);
      expect(builder.complexity).toBeDefined();
      expect(builder.complexity.alias).toBe('c');
      expect(builder.framework).toBeDefined();
      expect(builder.framework.alias).toBe('f');
      expect(builder.sections).toBeDefined();
      expect(builder.sections.alias).toBe('s');
      expect(builder.llmOptimized).toBeDefined();
      expect(builder.llmOptimized.alias).toBe('llm');
      expect(builder.showRelated).toBeDefined();
      expect(builder.maxExamples).toBeDefined();
      expect(builder.maxExamples.alias).toBe('m');
      expect(builder.noRandomize).toBeDefined();
      expect(builder.seed).toBeDefined();
      expect(builder.diOnly).toBeDefined();
      expect(builder.output).toBeDefined();
      expect(builder.output.alias).toBe('o');
    });

    it('should have framework choices defined', () => {
      const builder = generateCommand.builder as any;
      expect(builder.framework.choices).toEqual(['nestjs', 'express', 'fastify']);
    });

    it('should have default values set correctly', () => {
      const builder = generateCommand.builder as any;
      expect(builder.llmOptimized.default).toBe(false);
      expect(builder.showRelated.default).toBe(false);
      expect(builder.noRandomize.default).toBe(false);
      expect(builder.diOnly.default).toBe(false);
    });
  });

  describe('handler execution', () => {
    it('should execute documentation generation successfully with minimal options', async () => {
      const mockResult = {
        outputPath: '/test/policies-docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler(argv);

      expect(DocumentationGenerator).toHaveBeenCalledTimes(1);
      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: [],
        sections: [],
        randomize: true,
      });

      expect(logger.success).toHaveBeenCalledWith('✅ Documentation generated: /test/policies-docs.md');
    });

    it('should parse complexity levels from comma-separated string', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'core',
        complexity: 'basic, intermediate, advanced',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'core',
        complexityLevels: ['basic', 'intermediate', 'advanced'],
        sections: [],
        randomize: true,
      });
    });

    it('should parse sections from comma-separated string', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'events',
        sections: 'intro, examples, patterns',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'events',
        complexityLevels: [],
        sections: ['intro', 'examples', 'patterns'],
        randomize: true,
      });
    });

    it('should handle all options together', async () => {
      const mockResult = {
        outputPath: '/custom/path/docs.md',
        randomizedExamples: ['example1', 'example2'],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'domain-services',
        complexity: 'intermediate,advanced',
        framework: 'nestjs',
        sections: 'intro,examples',
        llmOptimized: true,
        showRelated: true,
        maxExamples: 10,
        noRandomize: false,
        seed: 'test-seed',
        diOnly: true,
        output: '/custom/path/docs.md',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'domain-services',
        complexityLevels: ['intermediate', 'advanced'],
        framework: 'nestjs',
        sections: ['intro', 'examples'],
        llmOptimized: true,
        showRelated: true,
        maxExamples: 10,
        randomize: true,
        seed: 'test-seed',
        diOnly: true,
        outputPath: '/custom/path/docs.md',
      });

      expect(logger.success).toHaveBeenCalledWith('✅ Documentation generated: /custom/path/docs.md');
      expect(logger.info).toHaveBeenCalledWith('💡 Tip: Use this file with LLM prompts for code generation');
      expect(logger.info).toHaveBeenCalledWith('🎲 Examples were randomized. Run again to see different examples');
    });

    it('should handle noRandomize flag correctly', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        noRandomize: true,
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: [],
        sections: [],
        randomize: false,
      });
    });

    it('should display LLM tip when llmOptimized is true', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        llmOptimized: true,
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(logger.info).toHaveBeenCalledWith('💡 Tip: Use this file with LLM prompts for code generation');
    });

    it('should display randomization message when examples were randomized', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: ['example1', 'example2', 'example3'],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(logger.info).toHaveBeenCalledWith('🎲 Examples were randomized. Run again to see different examples');
    });

    it('should not display randomization message when no examples were randomized', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(logger.info).not.toHaveBeenCalledWith('🎲 Examples were randomized. Run again to see different examples');
    });

    it('should handle optional properties correctly', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        framework: 'nestjs',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: [],
        framework: 'nestjs',
        sections: [],
        randomize: true,
      });
    });
  });

  describe('error handling', () => {
    it('should handle generator errors gracefully', async () => {
      const generatorError = new Error('Documentation generation failed');
      mockGenerator.generate.mockRejectedValue(generatorError);

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      const [error] = await safeRun(async () => {
        await generateCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to generate documentation: Documentation generation failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'String error message';
      mockGenerator.generate.mockRejectedValue(stringError);

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      const [error] = await safeRun(async () => {
        await generateCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to generate documentation: String error message');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle generator initialization errors', async () => {
      vi.mocked(DocumentationGenerator).mockImplementation(() => {
        throw new Error('Generator initialization failed');
      });

      const argv = {
        package: 'policies',
      } as ArgumentsCamelCase<GenerateArgs>;

      const [error] = await safeRun(async () => {
        await generateCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to generate documentation: Generator initialization failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('argument parsing', () => {
    it('should trim whitespace from parsed values', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        complexity: ' basic , intermediate ',
        sections: ' intro , examples , outro ',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: ['basic', 'intermediate'],
        sections: ['intro', 'examples', 'outro'],
        randomize: true,
      });
    });

    it('should handle single values without commas', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        complexity: 'basic',
        sections: 'examples',
      } as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: ['basic'],
        sections: ['examples'],
        randomize: true,
      });
    });

    it('should handle undefined complexity and sections correctly', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      const argv = {
        package: 'policies',
        complexity: undefined,
        sections: undefined,
      } as unknown as ArgumentsCamelCase<GenerateArgs>;

      await generateCommand.handler!(argv);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: [],
        sections: [],
        randomize: true,
      });
    });
  });
});
