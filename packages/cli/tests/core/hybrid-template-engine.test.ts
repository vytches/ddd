/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { HybridTemplateEngine } from '../../src/core/hybrid-template-engine';
import { ContentResolver } from '../../src/core/content-resolver';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../src/core/content-resolver');
vi.mock('handlebars', () => ({
  default: {
    create: vi.fn(() => ({
      registerHelper: vi.fn(),
      compile: vi.fn(),
      SafeString: vi.fn(content => ({ toString: () => content })),
    })),
    SafeString: vi.fn(content => ({ toString: () => content })),
  },
}));

const mockFs = vi.mocked(fs);
const mockContentResolver = vi.mocked(ContentResolver);

describe('HybridTemplateEngine', () => {
  let engine: HybridTemplateEngine;
  let mockHandlebars: any;
  let mockCompiledTemplate: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup Handlebars mock
    mockCompiledTemplate = vi.fn().mockReturnValue('<div>Rendered Template</div>');

    mockHandlebars = {
      registerHelper: vi.fn(),
      compile: vi.fn().mockReturnValue(mockCompiledTemplate),
      SafeString: vi.fn(content => ({ toString: () => content })),
    };

    // Mock Handlebars.create to return our mock
    const Handlebars = (await import('handlebars')).default;
    vi.mocked(Handlebars.create).mockReturnValue(mockHandlebars);

    // Setup fs mock
    mockFs.readFile.mockResolvedValue('{{title}}\n{{content}}');

    // Setup ContentResolver mock
    mockContentResolver.resolveContent.mockReturnValue('Mock resolved content');

    engine = new HybridTemplateEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create engine instance and register helpers', () => {
      expect(engine).toBeInstanceOf(HybridTemplateEngine);
      expect(mockHandlebars.registerHelper).toHaveBeenCalledTimes(12); // All helpers registered
    });

    it('should set up templates path correctly', () => {
      // The constructor creates the engine and sets up paths
      expect(engine).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render template with provided data successfully', async () => {
      const templateData = {
        title: 'Test Title',
        content: 'Test Content',
      };

      const result = await safeRun(async () => {
        return await engine.render('test-layout', templateData);
      });
      const error = result[0] as Error | undefined;
      const rendered = result[1] as string | undefined;

      expect(error).toBeUndefined();
      expect(rendered).toBe('<div>Rendered Template</div>');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('layouts/test-layout.hbs'),
        'utf-8'
      );
      expect(mockCompiledTemplate).toHaveBeenCalledWith(templateData);
    });

    it('should use cached template on subsequent renders', async () => {
      const templateData = { test: 'data' };

      // First render
      await engine.render('cached-layout', templateData);

      // Second render
      const result = await safeRun(async () => {
        return await engine.render('cached-layout', templateData);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Only called once due to caching
      expect(mockCompiledTemplate).toHaveBeenCalledTimes(2); // But template executed twice
    });

    it('should handle template loading errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Template file not found'));

      const result = await safeRun(async () => {
        return await engine.render('missing-layout', {});
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Template not found');
    });
  });

  describe('helper functions', () => {
    let registeredHelpers: Map<string, Function>;

    beforeEach(() => {
      registeredHelpers = new Map();

      // Capture registered helpers
      mockHandlebars.registerHelper.mockImplementation((name: string, fn: Function) => {
        registeredHelpers.set(name, fn);
      });

      // Re-create engine to capture helpers
      engine = new HybridTemplateEngine();
    });

    describe('loadMarkdown helper', () => {
      it('should load markdown content using ContentResolver', () => {
        const loadMarkdownHelper = registeredHelpers.get('loadMarkdown');
        expect(loadMarkdownHelper).toBeDefined();

        const result = loadMarkdownHelper!('test-package', 'example.md');

        expect(ContentResolver.resolveContent).toHaveBeenCalledWith('test-package', 'example.md');
        expect(result.toString()).toBe('Mock resolved content');
      });

      it('should cache loaded markdown content', () => {
        const loadMarkdownHelper = registeredHelpers.get('loadMarkdown');

        // Load same content twice
        loadMarkdownHelper!('test-package', 'example.md');
        loadMarkdownHelper!('test-package', 'example.md');

        expect(ContentResolver.resolveContent).toHaveBeenCalledTimes(1); // Only called once due to caching
      });
    });

    describe('loadFrameworkExample helper', () => {
      it('should load framework-specific content', () => {
        const helper = registeredHelpers.get('loadFrameworkExample');
        expect(helper).toBeDefined();

        const result = helper!('test-package', 'nestjs', 'basic');

        expect(ContentResolver.resolveContent).toHaveBeenCalledWith(
          'test-package',
          'frameworks/nestjs/basic'
        );
        expect(result.toString()).toBe('Mock resolved content');
      });
    });

    describe('ifSection helper', () => {
      it('should render content when section is included', () => {
        const helper = registeredHelpers.get('ifSection');
        expect(helper).toBeDefined();

        const context = { sections: ['introduction', 'examples'] };
        const options = {
          fn: vi.fn().mockReturnValue('Section content'),
          inverse: vi.fn().mockReturnValue('No section'),
        };

        const result = helper!.call(context, 'examples', options);

        expect(result).toBe('Section content');
        expect(options.fn).toHaveBeenCalledWith(context);
        expect(options.inverse).not.toHaveBeenCalled();
      });

      it('should render inverse when section is not included', () => {
        const helper = registeredHelpers.get('ifSection');

        const context = { sections: ['introduction'] };
        const options = {
          fn: vi.fn().mockReturnValue('Section content'),
          inverse: vi.fn().mockReturnValue('No section'),
        };

        const result = helper!.call(context, 'advanced', options);

        expect(result).toBe('No section');
        expect(options.inverse).toHaveBeenCalledWith(context);
        expect(options.fn).not.toHaveBeenCalled();
      });
    });

    describe('ifComplexity helper', () => {
      it('should render content when complexity level matches', () => {
        const helper = registeredHelpers.get('ifComplexity');

        const context = { complexityLevels: ['basic', 'intermediate'] };
        const options = {
          fn: vi.fn().mockReturnValue('Complexity content'),
          inverse: vi.fn().mockReturnValue('No complexity'),
        };

        const result = helper!.call(context, 'basic', options);

        expect(result).toBe('Complexity content');
        expect(options.fn).toHaveBeenCalledWith(context);
      });

      it('should render inverse when complexity level does not match', () => {
        const helper = registeredHelpers.get('ifComplexity');

        const context = { complexityLevels: ['basic'] };
        const options = {
          fn: vi.fn().mockReturnValue('Complexity content'),
          inverse: vi.fn().mockReturnValue('No complexity'),
        };

        const result = helper!.call(context, 'advanced', options);

        expect(result).toBe('No complexity');
        expect(options.inverse).toHaveBeenCalledWith(context);
      });
    });

    describe('ifFramework helper', () => {
      it('should render content when framework matches', () => {
        const helper = registeredHelpers.get('ifFramework');

        const context = { framework: 'nestjs' };
        const options = {
          fn: vi.fn().mockReturnValue('Framework content'),
          inverse: vi.fn().mockReturnValue('No framework'),
        };

        const result = helper!.call(context, 'nestjs', options);

        expect(result).toBe('Framework content');
        expect(options.fn).toHaveBeenCalledWith(context);
      });

      it('should render inverse when framework does not match', () => {
        const helper = registeredHelpers.get('ifFramework');

        const context = { framework: 'nestjs' };
        const options = {
          fn: vi.fn().mockReturnValue('Framework content'),
          inverse: vi.fn().mockReturnValue('No framework'),
        };

        const result = helper!.call(context, 'express', options);

        expect(result).toBe('No framework');
        expect(options.inverse).toHaveBeenCalledWith(context);
      });
    });

    describe('string helpers', () => {
      it('should capitalize strings', () => {
        const helper = registeredHelpers.get('capitalize');

        expect(helper!('hello')).toBe('Hello');
        expect(helper!('WORLD')).toBe('WORLD');
        expect(helper!('')).toBe('');
      });

      it('should concatenate strings', () => {
        const helper = registeredHelpers.get('concat');

        // Simulate Handlebars passing options object as last argument
        const result = helper!('hello', ' ', 'world', {
          /* handlebars options */
        });

        expect(result).toBe('hello world');
      });

      it('should check array includes', () => {
        const helper = registeredHelpers.get('includes');

        expect(helper!(['a', 'b', 'c'], 'b')).toBe(true);
        expect(helper!(['a', 'b', 'c'], 'd')).toBe(false);
        expect(helper!(null, 'a')).toBeFalsy(); // Returns undefined for null, which is falsy
        expect(helper!(undefined, 'a')).toBeFalsy(); // Returns undefined, which is falsy
      });

      it('should format tags', () => {
        const helper = registeredHelpers.get('formatTags');

        const result = helper!(['tag1', 'tag2', 'tag3']);

        expect(result).toBe('<code>tag1</code>, <code>tag2</code>, <code>tag3</code>');
      });
    });

    describe('content helpers', () => {
      it('should resolve tag examples', () => {
        const helper = registeredHelpers.get('resolveTagExample');

        const result = helper!('aggregate');

        expect(result).toBe('Example for aggregate');
      });

      it('should find related examples', () => {
        const helper = registeredHelpers.get('findRelatedExamples');

        const result = helper!('core', 'basic');

        expect(result).toEqual([]);
      });

      it('should load cross-package examples', () => {
        const helper = registeredHelpers.get('loadCrossPackageExample');

        const result = helper!('core', 'events', 'intermediate', 'integration-example');

        expect(ContentResolver.resolveContent).toHaveBeenCalledWith(
          'core',
          'cross-package/events/intermediate/integration-example.md'
        );
        expect(result.toString()).toBe('Mock resolved content');
      });
    });
  });

  describe('clearCache', () => {
    it('should clear template and content caches', async () => {
      // Populate caches
      await engine.render('test-layout', {});

      // Clear cache
      engine.clearCache();

      // Verify caches are cleared by checking if templates are reloaded
      await engine.render('test-layout', {});

      expect(mockFs.readFile).toHaveBeenCalledTimes(2); // Called twice due to cache clear
    });
  });

  describe('private methods', () => {
    describe('loadTemplate', () => {
      it('should load and compile template', async () => {
        const result = await safeRun(async () => {
          return await (engine as any).loadTemplate('test/template.hbs');
        });
        const error = result[0] as Error | undefined;
        const template = result[1] as Function | undefined;

        expect(error).toBeUndefined();
        expect(template).toBe(mockCompiledTemplate);
        expect(mockFs.readFile).toHaveBeenCalledWith(
          expect.stringContaining('test/template.hbs'),
          'utf-8'
        );
        expect(mockHandlebars.compile).toHaveBeenCalled();
      });

      it('should throw error for missing template', async () => {
        mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

        const result = await safeRun(async () => {
          return await (engine as any).loadTemplate('missing/template.hbs');
        });
        const error = result[0] as Error | undefined;

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('Template not found');
      });
    });

    describe('loadMarkdownContent', () => {
      it('should load content using ContentResolver', () => {
        const result = (engine as any).loadMarkdownContent('test-package', 'example.md');

        expect(result).toBe('Mock resolved content');
        expect(ContentResolver.resolveContent).toHaveBeenCalledWith('test-package', 'example.md');
      });

      it('should cache loaded content', () => {
        // Load same content twice
        (engine as any).loadMarkdownContent('test-package', 'example.md');
        (engine as any).loadMarkdownContent('test-package', 'example.md');

        expect(ContentResolver.resolveContent).toHaveBeenCalledTimes(1);
      });
    });

    describe('loadFrameworkContent', () => {
      it('should load framework content using ContentResolver', () => {
        const result = (engine as any).loadFrameworkContent(
          'test-package',
          'frameworks/nestjs/basic'
        );

        expect(result).toBe('Mock resolved content');
        expect(ContentResolver.resolveContent).toHaveBeenCalledWith(
          'test-package',
          'frameworks/nestjs/basic'
        );
      });

      it('should cache framework content', () => {
        // Load same content twice
        (engine as any).loadFrameworkContent('test-package', 'frameworks/nestjs/basic');
        (engine as any).loadFrameworkContent('test-package', 'frameworks/nestjs/basic');

        expect(ContentResolver.resolveContent).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete template rendering workflow', async () => {
      const complexTemplateData = {
        title: 'Complex Example',
        sections: ['introduction', 'examples', 'api'],
        complexityLevels: ['basic', 'intermediate'],
        framework: 'nestjs',
        tags: ['aggregate', 'entity', 'repository'],
      };

      const result = await safeRun(async () => {
        return await engine.render('complex-layout', complexTemplateData);
      });
      const error = result[0] as Error | undefined;
      const rendered = result[1] as string | undefined;

      expect(error).toBeUndefined();
      expect(rendered).toBe('<div>Rendered Template</div>');
      expect(mockCompiledTemplate).toHaveBeenCalledWith(complexTemplateData);
    });

    it('should handle multiple template renders with caching', async () => {
      const templates = ['layout1', 'layout2', 'layout1']; // layout1 repeated for cache test

      for (const template of templates) {
        const result = await safeRun(async () => {
          return await engine.render(template, { test: 'data' });
        });
        const error = result[0] as Error | undefined;
        expect(error).toBeUndefined();
      }

      expect(mockFs.readFile).toHaveBeenCalledTimes(2); // Only 2 unique templates
      expect(mockCompiledTemplate).toHaveBeenCalledTimes(3); // But rendered 3 times
    });

    it('should handle helper functions in template context', () => {
      // Verify that helpers are registered correctly
      expect(mockHandlebars.registerHelper).toHaveBeenCalledTimes(12);

      // Check specific helper registrations
      const helperCalls = mockHandlebars.registerHelper.mock.calls;
      const helperNames = helperCalls.map((call: any[]) => call[0]);

      expect(helperNames).toContain('capitalize');
      expect(helperNames).toContain('concat');
      expect(helperNames).toContain('includes');
      expect(helperNames).toContain('formatTags');
    });
  });

  describe('error handling', () => {
    it('should handle Handlebars compilation errors', async () => {
      mockHandlebars.compile.mockImplementation(() => {
        throw new Error('Handlebars compilation error');
      });

      const result = await safeRun(async () => {
        return await engine.render('error-layout', {});
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
    });

    it('should handle ContentResolver errors gracefully', () => {
      mockContentResolver.resolveContent.mockImplementation(() => {
        throw new Error('Content resolution failed');
      });

      const result = safeRun(() => {
        return (engine as any).loadMarkdownContent('error-package', 'error-file.md');
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeInstanceOf(Error);
    });
  });
});
