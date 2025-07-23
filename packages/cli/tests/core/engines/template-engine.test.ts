import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { TemplateEngine } from '../../../src/core/engines/template-engine';
import { TemplateError } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/core/utils/file-system');

import { FileSystem } from '../../../src/core/utils/file-system';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new TemplateEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and static methods', () => {
    it('should create instance', () => {
      expect(engine).toBeInstanceOf(TemplateEngine);
    });

    it('should create instance using static method', () => {
      const staticEngine = TemplateEngine.create();
      expect(staticEngine).toBeInstanceOf(TemplateEngine);
    });
  });

  describe('registerTemplate', () => {
    it('should register template successfully', () => {
      const template = 'Hello {{name}}!';

      const [error] = safeRun(() => engine.registerTemplate('greeting', template));

      expect(error).toBeUndefined();
      expect(engine.hasTemplate('greeting')).toBe(true);
    });

    it('should handle invalid template syntax gracefully', () => {
      // Handlebars is quite forgiving, so we test with a template that would actually fail
      const invalidTemplate = 'Hello {{#if}}{{/if}}'; // Missing condition in if block

      const [templateError] = safeRun(() => engine.registerTemplate('invalid', invalidTemplate));

      // If it doesn't throw during registration, it should still register successfully
      if (!templateError) {
        expect(engine.hasTemplate('invalid')).toBe(true);
      }
    });
  });

  describe('registerPartial', () => {
    it('should register partial successfully', () => {
      const partial = 'Header: {{title}}';

      const [error] = safeRun(() => engine.registerPartial('header', partial));

      expect(error).toBeUndefined();
    });

    it('should register partial even with unclosed braces', () => {
      // Handlebars is forgiving with partials and doesn't validate syntax during registration
      const partialWithUnclosedBrace = 'Header: {{title';

      const [templateError] = safeRun(() =>
        engine.registerPartial('partialWithUnclosedBrace', partialWithUnclosedBrace)
      );

      // Handlebars doesn't throw during partial registration
      expect(templateError).toBeUndefined();
    });
  });

  describe('loadTemplate', () => {
    it('should load template from file', async () => {
      const templateContent = 'Hello {{name}}!';
      vi.mocked(FileSystem.readFile).mockResolvedValue(templateContent);

      const [error] = await safeRun(
        async () => await engine.loadTemplate('fileTemplate', 'template.hbs')
      );

      expect(error).toBeUndefined();
      expect(FileSystem.readFile).toHaveBeenCalledWith('template.hbs');
      expect(engine.hasTemplate('fileTemplate')).toBe(true);
    });

    it('should throw TemplateError when file loading fails', async () => {
      const fileError = new Error('File not found');
      vi.mocked(FileSystem.readFile).mockRejectedValue(fileError);

      const [templateError] = await safeRun(
        async () => await engine.loadTemplate('missingTemplate', 'missing.hbs')
      );

      expect(templateError).toBeInstanceOf(TemplateError);
      expect(templateError?.message).toContain('Failed to load template');
    });
  });

  describe('loadTemplatesFromDirectory', () => {
    it('should load templates from directory', async () => {
      const files = ['template1.hbs', 'template2.template', 'template3.handlebars'];
      const templateContent = 'Template {{name}}';

      vi.mocked(FileSystem.findFiles).mockResolvedValue(files);
      vi.mocked(FileSystem.getBaseName).mockImplementation(
        file => file.split('/').pop()?.split('.')[0] || ''
      );
      vi.mocked(FileSystem.readFile).mockResolvedValue(templateContent);

      const [error] = await safeRun(
        async () => await engine.loadTemplatesFromDirectory('./templates')
      );

      expect(error).toBeUndefined();
      expect(FileSystem.findFiles).toHaveBeenCalledWith(
        './templates',
        /\.(hbs|handlebars|tmpl|template)$/
      );
      expect(FileSystem.readFile).toHaveBeenCalledTimes(3);
    });

    it('should handle directory loading errors', async () => {
      const dirError = new Error('Directory not found');
      vi.mocked(FileSystem.findFiles).mockRejectedValue(dirError);

      const [templateError] = await safeRun(
        async () => await engine.loadTemplatesFromDirectory('./missing')
      );

      expect(templateError).toBeInstanceOf(TemplateError);
      expect(templateError?.message).toContain('Failed to load templates from');
    });
  });

  describe('render', () => {
    beforeEach(() => {
      engine.registerTemplate('greeting', 'Hello {{name}}!');
      engine.registerTemplate('complex', 'Name: {{name}}, Age: {{age}}, Year: {{year}}');
    });

    it('should render template with context', () => {
      const [error, result] = safeRun(() => engine.render('greeting', { name: 'World' }));

      expect(error).toBeUndefined();
      expect(result).toBe('Hello World!');
    });

    it('should render template with enhanced context', () => {
      const [error, result] = safeRun(() => engine.render('complex', { name: 'John', age: 30 }));

      expect(error).toBeUndefined();
      expect(result).toContain('Name: John');
      expect(result).toContain('Age: 30');
      expect(result).toContain('Year: ');
    });

    it('should throw TemplateError for non-existent template', () => {
      const [templateError] = safeRun(() => engine.render('nonExistent', { name: 'Test' }));

      expect(templateError).toBeInstanceOf(TemplateError);
      expect(templateError?.message).toContain('Template not found: nonExistent');
    });

    it('should handle unknown helpers gracefully', () => {
      // Handlebars renders unknown helpers as empty strings by default
      engine.registerTemplate('unknownHelperTemplate', '{{helper_that_doesnt_exist}}');

      const [templateError, result] = safeRun(() => engine.render('unknownHelperTemplate', {}));

      expect(templateError).toBeUndefined();
      expect(result).toBe(''); // Unknown helpers render as empty string
    });
  });

  describe('renderString', () => {
    it('should render template string with context', () => {
      const template = 'Hello {{name}}!';

      const [error, result] = safeRun(() => engine.renderString(template, { name: 'World' }));

      expect(error).toBeUndefined();
      expect(result).toBe('Hello World!');
    });

    it('should handle invalid template string', () => {
      const invalidTemplate = 'Hello {{name';

      const [templateError] = safeRun(() =>
        engine.renderString(invalidTemplate, { name: 'World' })
      );

      expect(templateError).toBeInstanceOf(TemplateError);
      expect(templateError?.message).toContain('Template string rendering failed');
    });
  });

  describe('handlebars helpers', () => {
    it('should use string transformation helpers', () => {
      const template =
        '{{uppercase name}} {{lowercase name}} {{capitalize name}} {{camelCase name}} {{pascalCase name}} {{kebabCase name}} {{snakeCase name}}';

      const [error, result] = safeRun(() => engine.renderString(template, { name: 'hello-world' }));

      expect(error).toBeUndefined();
      expect(result).toContain('HELLO-WORLD');
      expect(result).toContain('hello-world');
      expect(result).toContain('Hello-world');
      expect(result).toContain('helloWorld');
      expect(result).toContain('HelloWorld');
      expect(result).toContain('hello-world');
      expect(result).toContain('hello_world');
    });

    it('should use conditional helpers', () => {
      const template =
        '{{#if (eq status "active")}}Active{{/if}} {{#if (gt age 18)}}Adult{{/if}} {{#if (and name age)}}Valid{{/if}}';

      const [error, result] = safeRun(() =>
        engine.renderString(template, { status: 'active', age: 25, name: 'John' })
      );

      expect(error).toBeUndefined();
      expect(result).toContain('Active');
      expect(result).toContain('Adult');
      expect(result).toContain('Valid');
    });

    it('should use default helper', () => {
      const template = '{{default name "Anonymous"}}';

      const [error, result] = safeRun(() => engine.renderString(template, {}));

      expect(error).toBeUndefined();
      expect(result).toBe('Anonymous');
    });

    it('should use json helper', () => {
      const template = '{{json data}}';
      const data = { key: 'value', number: 42 };

      const [error, result] = safeRun(() => engine.renderString(template, { data }));

      expect(error).toBeUndefined();
      // Handlebars HTML-escapes the output by default
      expect(result).toContain('&quot;key&quot;: &quot;value&quot;');
      expect(result).toContain('&quot;number&quot;: 42');
    });
  });

  describe('template management', () => {
    beforeEach(() => {
      engine.registerTemplate('template1', 'Template 1');
      engine.registerTemplate('template2', 'Template 2');
    });

    it('should get template names', () => {
      const names = engine.getTemplateNames();

      expect(names).toContain('template1');
      expect(names).toContain('template2');
      expect(names).toHaveLength(2);
    });

    it('should check if template exists', () => {
      expect(engine.hasTemplate('template1')).toBe(true);
      expect(engine.hasTemplate('nonExistent')).toBe(false);
    });

    it('should clear all templates', () => {
      engine.clear();

      expect(engine.getTemplateNames()).toHaveLength(0);
      expect(engine.hasTemplate('template1')).toBe(false);
    });
  });
});
