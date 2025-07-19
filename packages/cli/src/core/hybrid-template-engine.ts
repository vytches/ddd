import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { ContentResolver } from './content-resolver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HybridTemplateEngine {
  private hbs: typeof Handlebars;
  private templatesPath: string;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private contentCache: Map<string, string> = new Map();

  constructor() {
    this.hbs = Handlebars.create();
    this.templatesPath = path.join(__dirname, '../templates');
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Helper to load markdown content
    this.hbs.registerHelper('loadMarkdown', (packageName: string, filePath: string) => {
      const content = this.loadMarkdownContent(packageName, filePath);
      return new this.hbs.SafeString(content);
    });

    // Helper to load framework-specific content
    this.hbs.registerHelper('loadFrameworkExample', (packageName: string, framework: string, complexity: string) => {
      const frameworkPath = `frameworks/${framework}/${complexity}`;
      const content = this.loadFrameworkContent(packageName, frameworkPath);
      return new this.hbs.SafeString(content);
    });

    // Helper for conditional sections
    this.hbs.registerHelper('ifSection', function(this: any, sectionName: string, options: any) {
      const sections = this.sections || [];
      if (sections.includes(sectionName)) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper for complexity filtering
    this.hbs.registerHelper('ifComplexity', function(this: any, complexity: string, options: any) {
      const complexityLevels = this.complexityLevels || [];
      if (complexityLevels.includes(complexity)) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper for framework filtering
    this.hbs.registerHelper('ifFramework', function(this: any, framework: string, options: any) {
      if (this.framework === framework) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper to capitalize strings
    this.hbs.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Helper to concatenate strings
    this.hbs.registerHelper('concat', (...args: any[]) => {
      // Remove the last argument which is the Handlebars options object
      const strings = args.slice(0, -1);
      return strings.join('');
    });

    // Helper to check if array includes value
    this.hbs.registerHelper('includes', (array: any[], value: any) => {
      return array && array.includes(value);
    });

    // Helper to format tags
    this.hbs.registerHelper('formatTags', (tags: string[]) => {
      return tags.map(tag => `<code>${tag}</code>`).join(', ');
    });

    // Helper to resolve tag examples
    this.hbs.registerHelper('resolveTagExample', (tag: string) => {
      return `Example for ${tag}`;
    });

    // Helper to find related examples
    this.hbs.registerHelper('findRelatedExamples', (packageName: string, complexity: string) => {
      return [];
    });

    // Helper to load cross-package examples
    this.hbs.registerHelper('loadCrossPackageExample', (
      sourcePackage: string,
      targetPackage: string,
      complexity: string,
      exampleId: string
    ) => {
      const content = this.loadMarkdownContent(
        sourcePackage,
        `cross-package/${targetPackage}/${complexity}/${exampleId}.md`
      );
      return new this.hbs.SafeString(content);
    });
  }

  async render(layout: string, data: any): Promise<string> {
    const template = await this.loadTemplate(`layouts/${layout}.hbs`);
    return template(data);
  }

  private async loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }

    const fullPath = path.join(this.templatesPath, templatePath);

    try {
      const templateSource = await fs.readFile(fullPath, 'utf-8');
      const compiledTemplate = this.hbs.compile(templateSource);

      this.templateCache.set(templatePath, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  private loadMarkdownContent(packageName: string, filePath: string): string {
    const cacheKey = `${packageName}:${filePath}`;

    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    // Use the new ContentResolver for intelligent content resolution
    const content = ContentResolver.resolveContent(packageName, filePath);
    this.contentCache.set(cacheKey, content);
    return content;
  }


  private loadFrameworkContent(packageName: string, frameworkPath: string): string {
    const cacheKey = `${packageName}:${frameworkPath}`;

    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    // Use ContentResolver for framework content as well
    const content = ContentResolver.resolveContent(packageName, frameworkPath);
    this.contentCache.set(cacheKey, content);
    return content;
  }

  clearCache(): void {
    this.templateCache.clear();
    this.contentCache.clear();
  }
}
