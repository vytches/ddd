/**
 * @fileoverview Template Engine - Handlebars-based template generation
 * Enterprise-grade template engine with full Handlebars support
 */

import * as Handlebars from 'handlebars';
import type { TemplateContext } from '../../types';
import { TemplateError } from '../../types';
import { FileSystem } from '../utils/file-system';

export class TemplateEngine {
  private templates = new Map<string, HandlebarsTemplateDelegate>();
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Create template engine instance
   */
  static create(): TemplateEngine {
    return new TemplateEngine();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // String transformation helpers
    this.handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
    this.handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
    this.handlebars.registerHelper('capitalize', (str: string) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
    );
    this.handlebars.registerHelper('camelCase', (str: string) => this.toCamelCase(str || ''));
    this.handlebars.registerHelper('pascalCase', (str: string) => this.toPascalCase(str || ''));
    this.handlebars.registerHelper('kebabCase', (str: string) => this.toKebabCase(str || ''));
    this.handlebars.registerHelper('snakeCase', (str: string) => this.toSnakeCase(str || ''));

    // Conditional helpers
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    this.handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    this.handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
    this.handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
    this.handlebars.registerHelper('and', (...args: any[]) => {
      // Remove the last argument which is the options object
      const values = args.slice(0, -1);
      return values.every(Boolean);
    });
    this.handlebars.registerHelper('or', (...args: any[]) => {
      // Remove the last argument which is the options object
      const values = args.slice(0, -1);
      return values.some(Boolean);
    });

    // Default value helper
    this.handlebars.registerHelper('default', (value: any, defaultValue: any) =>
      value != null && value !== '' ? value : defaultValue
    );

    // JSON helper
    this.handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
  }

  /**
   * Register a template
   */
  registerTemplate(name: string, content: string): void {
    try {
      const compiled = this.handlebars.compile(content);
      this.templates.set(name, compiled);
    } catch (error) {
      throw new TemplateError(
        `Failed to compile template ${name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, content: string): void {
    try {
      this.handlebars.registerPartial(name, content);
    } catch (error) {
      throw new TemplateError(
        `Failed to register partial ${name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Load template from file
   */
  async loadTemplate(name: string, filePath: string): Promise<void> {
    try {
      const content = await FileSystem.readFile(filePath);
      this.registerTemplate(name, content);
    } catch (error) {
      throw new TemplateError(
        `Failed to load template ${name} from ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Load templates from directory
   */
  async loadTemplatesFromDirectory(directory: string): Promise<void> {
    try {
      // Load both .template and .handlebars/.hbs files
      const files = await FileSystem.findFiles(directory, /\.(hbs|handlebars|tmpl|template)$/);

      for (const file of files) {
        const baseName = FileSystem.getBaseName(file);
        // Remove .template extension for the template name
        const name = baseName.replace(/\.template$/, '');
        await this.loadTemplate(name, file);
      }
    } catch (error) {
      throw new TemplateError(
        `Failed to load templates from ${directory}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Render template with context
   */
  render(templateName: string, context: TemplateContext): string {
    const template = this.templates.get(templateName);
    if (!template) {
      const availableTemplates = Array.from(this.templates.keys()).join(', ');
      throw new TemplateError(
        `Template not found: ${templateName}. Available: ${availableTemplates}`
      );
    }

    try {
      // Enhance context with standard variables
      const enhancedContext = this.enhanceContext(context);
      return template(enhancedContext);
    } catch (error) {
      throw new TemplateError(
        `Template rendering failed for ${templateName}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Render template string with context
   */
  renderString(template: string, context: TemplateContext): string {
    try {
      const compiled = this.handlebars.compile(template);
      const enhancedContext = this.enhanceContext(context);
      return compiled(enhancedContext);
    } catch (error) {
      throw new TemplateError(
        `Template string rendering failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Enhance context with standard variables
   */
  private enhanceContext(context: TemplateContext): TemplateContext {
    const now = new Date();

    return {
      ...context,
      // Add standard context variables if not provided
      timestamp: context.timestamp || now.toISOString(),
      date: now.toDateString(),
      time: now.toTimeString(),
      year: now.getFullYear(),
      // Default entity type if not provided
      entityType: context.entityType || 'any',
      // Default async flag
      isAsync: context.isAsync || false,
    };
  }

  /**
   * Get all registered template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.clear();
    // Note: partials are stored in handlebars instance, we can't clear them individually
    // but creating a new instance would clear them
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/[_-\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
      .replace(/[_\s]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      .replace(/[-\s]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
