import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { examplesCommand } from '../../src/commands/examples';
import { DocumentationGenerator } from '../../src/generators/documentation-generator';
import { DocumentationBundler } from '../../src/generators/documentation-bundler';
import { SmartTagFinder } from '../../src/core/smart-tag-finder';
import { ExampleValidator } from '../../src/validators/example-validator';
import { Colors } from '../../src/core/utils/colors';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../../src/generators/documentation-generator');
vi.mock('../../src/generators/documentation-bundler');
vi.mock('../../src/core/smart-tag-finder');
vi.mock('../../src/validators/example-validator');
vi.mock('../../src/core/utils/colors');
vi.mock('fs/promises');

describe('examples command', () => {
  let mockGenerator: any;
  let mockBundler: any;
  let mockTagFinder: any;
  let mockValidator: any;
  let mockProcessExit: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DocumentationGenerator
    mockGenerator = {
      generate: vi.fn(),
    };
    vi.mocked(DocumentationGenerator).mockImplementation(() => mockGenerator);

    // Mock DocumentationBundler
    mockBundler = {
      generateBundle: vi.fn(),
    };
    vi.mocked(DocumentationBundler).mockImplementation(() => mockBundler);

    // Mock SmartTagFinder
    mockTagFinder = {
      findExamplesByTag: vi.fn(),
      suggestSimilarTags: vi.fn(),
    };
    vi.mocked(SmartTagFinder).mockImplementation(() => mockTagFinder);

    // Mock ExampleValidator
    mockValidator = {
      validateExamples: vi.fn(),
    };
    vi.mocked(ExampleValidator).mockImplementation(() => mockValidator);

    // Mock Colors
    vi.mocked(Colors.yellow).mockImplementation((text: string) => text);
    vi.mocked(Colors.red).mockImplementation((text: string) => text);
    vi.mocked(Colors.green).mockImplementation((text: string) => text);
    vi.mocked(Colors.cyan).mockImplementation((text: string) => text);
    vi.mocked(Colors.dim).mockImplementation((text: string) => text);

    // Mock fs/promises
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });

    // Mock process.exit
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('command structure', () => {
    it('should have correct command structure', () => {
      expect(examplesCommand.name).toBe('examples');
      expect(examplesCommand.description).toBe('Manage and generate documentation from examples');
      expect(examplesCommand.action).toBeDefined();
    });
  });

  describe('help display', () => {
    it('should display help when no subcommand provided', async () => {
      await examplesCommand.action([], {});

      expect(mockConsoleLog).toHaveBeenCalledWith('📚 Examples Management');
      expect(mockConsoleLog).toHaveBeenCalledWith('Usage: examples <command> [options]');
      expect(mockConsoleLog).toHaveBeenCalledWith('Commands:');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  generate <package>     Generate documentation for a package'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  bundle                 Generate bundled documentation'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  find-by-tag <tag>      Find examples by tag pattern'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  validate               Validate example configurations'
      );
    });

    it('should display help when help option is true', async () => {
      await examplesCommand.action(['generate'], { help: true });

      expect(mockConsoleLog).toHaveBeenCalledWith('📚 Examples Management');
      expect(mockConsoleLog).toHaveBeenCalledWith('Examples:');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  examples generate policies --complexity intermediate'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '  examples generate policies --framework nestjs --llm-optimized'
      );
    });
  });

  describe('generate subcommand', () => {
    it('should generate documentation successfully', async () => {
      const mockResult = {
        outputPath: '/test/policies-docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      await examplesCommand.action(['generate', 'policies'], {
        complexity: 'basic,intermediate',
        framework: 'nestjs',
        llmOptimized: true,
      });

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: ['basic', 'intermediate'],
        framework: 'nestjs',
        llmOptimized: true,
        randomize: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ Documentation generated: /test/policies-docs.md'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '💡 Tip: Use this file with LLM prompts for code generation'
      );
    });

    it('should handle llm alias option', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      await examplesCommand.action(['generate', 'policies'], {
        llm: true,
      });

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        llmOptimized: true,
        randomize: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '💡 Tip: Use this file with LLM prompts for code generation'
      );
    });

    it('should display randomization message when examples were randomized', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: ['example1', 'example2'],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      await examplesCommand.action(['generate', 'policies'], {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🎲 Examples were randomized. Run again to see different examples'
      );
    });

    it('should require package name for generate command', async () => {
      await examplesCommand.action(['generate'], {});

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Package name required');
      expect(mockConsoleLog).toHaveBeenCalledWith('Usage: examples generate <package>');
    });

    it('should handle generate errors', async () => {
      mockGenerator.generate.mockRejectedValue(new Error('Generation failed'));

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['generate', 'policies'], {});
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Failed to generate documentation: Generation failed'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('bundle subcommand', () => {
    it('should generate bundle successfully', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        content: '# Bundle Content',
        packageCount: 2,
        exampleCount: 10,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      await examplesCommand.action(['bundle'], {
        packages: 'policies,domain-services',
        framework: 'nestjs',
        llmOptimized: true,
      });

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: ['policies', 'domain-services'],
        framework: 'nestjs',
        complexityLevels: undefined,
        sections: undefined,
        llmOptimized: true,
        diOnly: undefined,
        outputPath: undefined,
      });

      expect(fs.writeFile).toHaveBeenCalledWith('/test/bundle.md', '# Bundle Content', 'utf8');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Bundle generated: /test/bundle.md');
      expect(mockConsoleLog).toHaveBeenCalledWith('📦 Includes 2 packages with 10 examples');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '💡 Tip: Use this bundle with LLM prompts for complete library understanding'
      );
    });

    it('should handle bundle with llm alias', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        content: '# Bundle Content',
        packageCount: 1,
        exampleCount: 5,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      await examplesCommand.action(['bundle'], {
        llm: true,
      });

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: [],
        framework: undefined,
        complexityLevels: undefined,
        sections: undefined,
        llmOptimized: true,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should handle bundle errors', async () => {
      mockBundler.generateBundle.mockRejectedValue(new Error('Bundle failed'));

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['bundle'], {});
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to generate bundle: Bundle failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle file write errors', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        content: '# Bundle Content',
        packageCount: 1,
        exampleCount: 5,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('File write failed'));

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['bundle'], {});
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Failed to generate bundle: File write failed'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('find-by-tag subcommand', () => {
    const mockExamples = [
      {
        id: 'example-1',
        name: 'Basic Policy',
        package: 'policies',
        complexity: 'basic',
        tags: ['policies:core'],
        diSupport: true,
      },
      {
        id: 'example-2',
        name: 'Advanced Policy',
        package: 'policies',
        complexity: 'advanced',
        tags: ['policies:advanced'],
        diSupport: false,
      },
    ];

    it('should find examples by tag successfully', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      await examplesCommand.action(['find-by-tag', 'policies:*'], {
        complexity: 'intermediate',
        framework: 'nestjs',
        maxExamples: 5,
      });

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith('policies:*', 'intermediate', {
        framework: 'nestjs',
        maxExamples: 5,
        randomize: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('🔍 Found 2 examples for tag: policies:*');
      expect(mockConsoleLog).toHaveBeenCalledWith('🔹 example-1');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Name: Basic Policy');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Package: @vytches/ddd-policies');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Complexity: 🟢 basic');
      expect(mockConsoleLog).toHaveBeenCalledWith('   DI Support: ✅');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Tags: policies:core');
    });

    it('should handle no results with suggestions', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockResolvedValue(['policies:core', 'policies:advanced']);

      await examplesCommand.action(['find-by-tag', 'invalid:tag'], {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '⚠️  No examples found for tag pattern: invalid:tag'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('💡 Did you mean:');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - policies:core');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - policies:advanced');
    });

    it('should handle no results without suggestions', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);
      mockTagFinder.suggestSimilarTags.mockResolvedValue([]);

      await examplesCommand.action(['find-by-tag', 'invalid:tag'], {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '⚠️  No examples found for tag pattern: invalid:tag'
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith('💡 Did you mean:');
    });

    it('should require tag pattern for find-by-tag command', async () => {
      await examplesCommand.action(['find-by-tag'], {});

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Tag pattern required');
      expect(mockConsoleLog).toHaveBeenCalledWith('Usage: examples find-by-tag <tag>');
    });

    it('should display randomization message when applicable', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      await examplesCommand.action(['find-by-tag', 'policies:*'], {});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🎲 Results were randomized. Use --no-randomize for deterministic results'
      );
    });

    it('should not display randomization message when noRandomize is true', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamples);

      await examplesCommand.action(['find-by-tag', 'policies:*'], { noRandomize: true });

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        '🎲 Results were randomized. Use --no-randomize for deterministic results'
      );
    });

    it('should handle find-by-tag errors', async () => {
      mockTagFinder.findExamplesByTag.mockRejectedValue(new Error('Find failed'));

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['find-by-tag', 'policies:*'], {});
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to find examples: Find failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('validate subcommand', () => {
    it('should validate examples successfully with no issues', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [],
        packagesValidated: 3,
        examplesValidated: 15,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      await examplesCommand.action(['validate'], {
        package: 'policies',
        fix: true,
        verbose: true,
      });

      expect(mockValidator.validateExamples).toHaveBeenCalledWith('policies', {
        packageName: 'policies',
        autoFix: true,
        verbose: true,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('✅ All examples are valid!');
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 Validation summary:');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - Packages validated: 3');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - Examples validated: 15');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - Errors: 0');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - Warnings: 0');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - Fixes applied: 0');
    });

    it('should handle validation results with errors and warnings', async () => {
      const mockResults = {
        errors: [{ package: 'policies', example: 'basic-example', message: 'Missing file' }],
        warnings: [{ package: 'events', example: 'event-example', message: 'Missing description' }],
        fixed: [{ package: 'core', example: 'fixed-example', description: 'Added imports' }],
        packagesValidated: 2,
        examplesValidated: 10,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['validate'], { fix: true });
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Found 1 errors:');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - policies/basic-example: Missing file');
      expect(mockConsoleLog).toHaveBeenCalledWith('⚠️  Found 1 warnings:');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - events/event-example: Missing description');
      expect(mockConsoleLog).toHaveBeenCalledWith('🔧 Applied 1 fixes:');
      expect(mockConsoleLog).toHaveBeenCalledWith('   - core/fixed-example: Added imports');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validate errors', async () => {
      mockValidator.validateExamples.mockRejectedValue(new Error('Validation failed'));

      const [error] = await safeRun(async () => {
        await examplesCommand.action(['validate'], {});
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Validation failed: Validation failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('unknown subcommand', () => {
    it('should handle unknown subcommands', async () => {
      await examplesCommand.action(['unknown'], {});

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Unknown examples command: unknown');
      expect(mockConsoleLog).toHaveBeenCalledWith('Use: examples --help for available commands');
    });
  });

  describe('complexity icon helper', () => {
    const mockExamples = [
      {
        id: 'example-1',
        name: 'Basic Policy',
        package: 'policies',
        complexity: 'basic',
        tags: ['policies:core'],
        diSupport: true,
      },
      {
        id: 'example-2',
        name: 'Advanced Policy',
        package: 'policies',
        complexity: 'advanced',
        tags: ['policies:advanced'],
        diSupport: false,
      },
    ];

    it('should display correct complexity icons', async () => {
      const mockExamplesWithComplexity = [
        { ...mockExamples[0], complexity: 'basic' },
        { ...mockExamples[1], complexity: 'intermediate' },
        {
          id: 'example-3',
          name: 'Expert',
          package: 'test',
          complexity: 'advanced',
          tags: [],
          diSupport: true,
        },
        {
          id: 'example-4',
          name: 'Unknown',
          package: 'test',
          complexity: 'unknown',
          tags: [],
          diSupport: true,
        },
      ];
      mockTagFinder.findExamplesByTag.mockResolvedValue(mockExamplesWithComplexity);

      await examplesCommand.action(['find-by-tag', 'test:*'], {});

      expect(mockConsoleLog).toHaveBeenCalledWith('   Complexity: 🟢 basic');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Complexity: 🟡 intermediate');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Complexity: 🔴 advanced');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Complexity: ⚪ unknown');
    });
  });

  describe('option parsing', () => {
    it('should parse comma-separated values correctly', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      await examplesCommand.action(['generate', 'policies'], {
        complexity: ' basic , intermediate , advanced ',
        sections: ' intro , examples , conclusion ',
      });

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: ['basic', 'intermediate', 'advanced'],
        sections: ['intro', 'examples', 'conclusion'],
        randomize: true,
      });
    });

    it('should handle undefined optional parameters', async () => {
      const mockResult = {
        outputPath: '/test/docs.md',
        randomizedExamples: [],
      };
      mockGenerator.generate.mockResolvedValue(mockResult);

      await examplesCommand.action(['generate', 'policies'], {
        complexity: undefined as unknown as string,
        sections: undefined as unknown as string,
      });

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        randomize: true,
      });
    });
  });
});
