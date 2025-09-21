import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { bundleCommand } from '../../../src/commands/docs/bundle';
import { DocumentationBundler } from '../../../src/generators/documentation-bundler';
import { logger } from '../../../src/core/utils/logger';

// Mock dependencies
vi.mock('../../../src/generators/documentation-bundler');
vi.mock('../../../src/core/utils/logger');

describe('bundle command', () => {
  let mockBundler: any;
  let mockProcessExit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DocumentationBundler
    mockBundler = {
      generateBundle: vi.fn(),
    };
    vi.mocked(DocumentationBundler).mockImplementation(() => mockBundler);

    // Mock logger
    vi.mocked(logger.success).mockImplementation(() => {
      return;
    });
    vi.mocked(logger.info).mockImplementation(() => {
      return;
    });
    vi.mocked(logger.error).mockImplementation(() => {
      return;
    });

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
      expect(bundleCommand.command).toBe('bundle');
      expect(bundleCommand.describe).toBe('Generate bundled documentation for multiple packages');
      expect(bundleCommand.builder).toBeDefined();
      expect(bundleCommand.handler).toBeDefined();
    });

    it('should define all required options', () => {
      const builder = bundleCommand.builder as any;

      expect(builder.packages).toBeDefined();
      expect(builder.packages.alias).toBe('p');
      expect(builder.framework).toBeDefined();
      expect(builder.framework.alias).toBe('f');
      expect(builder.complexity).toBeDefined();
      expect(builder.complexity.alias).toBe('c');
      expect(builder.sections).toBeDefined();
      expect(builder.sections.alias).toBe('s');
      expect(builder.llmOptimized).toBeDefined();
      expect(builder.llmOptimized.alias).toBe('llm');
      expect(builder.diOnly).toBeDefined();
      expect(builder.output).toBeDefined();
      expect(builder.output.alias).toBe('o');
    });

    it('should have framework choices defined', () => {
      const builder = bundleCommand.builder as any;
      expect(builder.framework.choices).toEqual(['nestjs', 'express', 'fastify']);
    });

    it('should have default values set correctly', () => {
      const builder = bundleCommand.builder as any;
      expect(builder.llmOptimized.default).toBe(false);
      expect(builder.diOnly.default).toBe(false);
    });
  });

  describe('handler execution', () => {
    it('should execute bundle generation successfully with minimal options', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 2,
        exampleCount: 10,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = { _: [], $0: 'test' };

      await bundleCommand.handler!(argv);

      expect(DocumentationBundler).toHaveBeenCalledTimes(1);
      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: [],
        framework: undefined,
        complexityLevels: undefined,
        sections: undefined,
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });

      expect(logger.success).toHaveBeenCalledWith('✅ Bundle generated: /test/bundle.md');
      expect(logger.info).toHaveBeenCalledWith('📦 Includes 2 packages with 10 examples');
    });

    it('should parse packages from comma-separated string', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 3,
        exampleCount: 15,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        packages: 'core, events, cqrs',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: ['core', 'events', 'cqrs'],
        framework: undefined,
        complexityLevels: undefined,
        sections: undefined,
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should parse complexity levels from comma-separated string', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 2,
        exampleCount: 8,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        complexity: 'basic, intermediate, advanced',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: [],
        framework: undefined,
        complexityLevels: ['basic', 'intermediate', 'advanced'],
        sections: undefined,
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should parse sections from comma-separated string', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 1,
        exampleCount: 5,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        sections: 'introduction, examples, conclusion',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: [],
        framework: undefined,
        complexityLevels: undefined,
        sections: ['introduction', 'examples', 'conclusion'],
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should handle all options together', async () => {
      const mockResult = {
        outputPath: '/custom/path/bundle.md',
        packageCount: 4,
        exampleCount: 25,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        packages: 'core,events',
        framework: 'nestjs',
        complexity: 'intermediate,advanced',
        sections: 'intro,examples',
        llmOptimized: true,
        diOnly: true,
        output: '/custom/path/bundle.md',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: ['core', 'events'],
        framework: 'nestjs',
        complexityLevels: ['intermediate', 'advanced'],
        sections: ['intro', 'examples'],
        llmOptimized: true,
        diOnly: true,
        outputPath: '/custom/path/bundle.md',
      });

      expect(logger.success).toHaveBeenCalledWith('✅ Bundle generated: /custom/path/bundle.md');
      expect(logger.info).toHaveBeenCalledWith('📦 Includes 4 packages with 25 examples');
      expect(logger.info).toHaveBeenCalledWith(
        '💡 Tip: Use this bundle with LLM prompts for complete library understanding'
      );
    });

    it('should display LLM tip when llmOptimized is true', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 2,
        exampleCount: 10,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        llmOptimized: true,
      };

      await bundleCommand.handler!(argv);

      expect(logger.info).toHaveBeenCalledWith(
        '💡 Tip: Use this bundle with LLM prompts for complete library understanding'
      );
    });

    it('should not display LLM tip when llmOptimized is false', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 2,
        exampleCount: 10,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
      };

      await bundleCommand.handler!(argv);

      expect(logger.info).not.toHaveBeenCalledWith(
        '💡 Tip: Use this bundle with LLM prompts for complete library understanding'
      );
    });
  });

  describe('error handling', () => {
    it('should handle bundler errors gracefully', async () => {
      const bundlerError = new Error('Bundle generation failed');
      mockBundler.generateBundle.mockRejectedValue(bundlerError);

      const argv = {
        _: [],
        $0: 'test',
        packages: 'core',
      };

      const [error] = await safeRun(async () => {
        await bundleCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to generate bundle: Bundle generation failed'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'String error message';
      mockBundler.generateBundle.mockRejectedValue(stringError);

      const argv = { _: [], $0: 'test' };

      const [error] = await safeRun(async () => {
        await bundleCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to generate bundle: String error message'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle bundler initialization errors', async () => {
      vi.mocked(DocumentationBundler).mockImplementation(() => {
        throw new Error('Bundler initialization failed');
      });

      const argv = { _: [], $0: 'test' };

      const [error] = await safeRun(async () => {
        await bundleCommand.handler!(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to generate bundle: Bundler initialization failed'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('argument parsing', () => {
    it('should handle empty package list correctly', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 0,
        exampleCount: 0,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        packages: '',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: [],
        framework: undefined,
        complexityLevels: undefined,
        sections: undefined,
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should trim whitespace from parsed values', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 2,
        exampleCount: 10,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        packages: ' core , events , cqrs ',
        complexity: ' basic , intermediate ',
        sections: ' intro , examples , outro ',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: ['core', 'events', 'cqrs'],
        framework: undefined,
        complexityLevels: ['basic', 'intermediate'],
        sections: ['intro', 'examples', 'outro'],
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });

    it('should handle single values without commas', async () => {
      const mockResult = {
        outputPath: '/test/bundle.md',
        packageCount: 1,
        exampleCount: 5,
      };
      mockBundler.generateBundle.mockResolvedValue(mockResult);

      const argv = {
        _: [],
        $0: 'test',
        packages: 'core',
        complexity: 'basic',
        sections: 'examples',
      };

      await bundleCommand.handler!(argv);

      expect(mockBundler.generateBundle).toHaveBeenCalledWith({
        packages: ['core'],
        framework: undefined,
        complexityLevels: ['basic'],
        sections: ['examples'],
        llmOptimized: undefined,
        diOnly: undefined,
        outputPath: undefined,
      });
    });
  });
});
