import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { ContentResolver } from './content-resolver';
import { YamlContentResolver } from './yaml-content-resolver';

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
    // Helper to load markdown content (YAML-aware)
    this.hbs.registerHelper('loadMarkdown', (packageName: string, filePath: string) => {
      const content = this.loadMarkdownContent(packageName, filePath);
      return new this.hbs.SafeString(content);
    });

    // Helper to load YAML-based documentation content
    this.hbs.registerHelper(
      'yamlContent',
      (packageName: string, section: string, field: string, format = 'cli') => {
        // Special handling for different section types
        if (section === 'package') {
          // Load package-level metadata
          const yamlPath = path.join(
            process.cwd(),
            'docs',
            'examples',
            'domain',
            packageName,
            '.md-settings.yaml'
          );
          try {
            const content = require('fs').readFileSync(yamlPath, 'utf-8');
            const metadata = require('js-yaml').load(content) as any;

            // Handle nested format-specific fields
            let value = null;

            if (field.includes('.')) {
              // Already format-specific like "description.cli"
              const parts = field.split('.');
              const [baseField, requestedFormat] = parts;
              if (baseField && requestedFormat) {
                value = metadata.formats?.[requestedFormat]?.[baseField] || metadata[baseField];
              }
            } else {
              // Look in formats first, then fallback to root
              value = metadata.formats?.[format]?.[field] || metadata[field];
            }

            return new this.hbs.SafeString(value || '');
          } catch (error) {
            return new this.hbs.SafeString('');
          }
        } else {
          // For class/method level, use the resolver
          const resolverPath = field ? `${section}/${field}.md` : `${section}.md`;
          const content = YamlContentResolver.resolveContent(packageName, resolverPath);
          return new this.hbs.SafeString(content);
        }
      }
    );

    // Helper to load YAML markdown with format awareness
    this.hbs.registerHelper(
      'loadYamlMarkdown',
      (packageName: string, filePath: string, format?: string) => {
        // Use YamlContentResolver for YAML-aware content loading
        const content = YamlContentResolver.resolveContent(packageName, filePath);
        return new this.hbs.SafeString(content);
      }
    );

    // Helper to load framework-specific content
    this.hbs.registerHelper(
      'loadFrameworkExample',
      (packageName: string, framework: string, complexity: string) => {
        const frameworkPath = `frameworks/${framework}/${complexity}`;
        const content = this.loadFrameworkContent(packageName, frameworkPath);
        return new this.hbs.SafeString(content);
      }
    );

    // Helper for conditional sections
    this.hbs.registerHelper(
      'ifSection',
      function (
        this: { sections?: string[] },
        sectionName: string,
        options: Handlebars.HelperOptions
      ) {
        const sections = this.sections || [];
        if (sections.includes(sectionName)) {
          return options.fn(this);
        }
        return options.inverse(this);
      }
    );

    // Helper for complexity filtering
    this.hbs.registerHelper(
      'ifComplexity',
      function (
        this: { complexityLevels?: string[] },
        complexity: string,
        options: Handlebars.HelperOptions
      ) {
        const complexityLevels = this.complexityLevels || [];
        if (complexityLevels.includes(complexity)) {
          return options.fn(this);
        }
        return options.inverse(this);
      }
    );

    // Helper for framework filtering
    this.hbs.registerHelper(
      'ifFramework',
      function (
        this: { framework?: string },
        framework: string,
        options: Handlebars.HelperOptions
      ) {
        if (this.framework === framework) {
          return options.fn(this);
        }
        return options.inverse(this);
      }
    );

    // Helper to capitalize strings
    this.hbs.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Helper for equality comparisons
    this.hbs.registerHelper('eq', (a: unknown, b: unknown) => {
      return a === b;
    });

    // Helper to concatenate strings
    this.hbs.registerHelper('concat', (...args: unknown[]) => {
      // Remove the last argument which is the Handlebars options object
      const strings = args.slice(0, -1);
      return strings.join('');
    });

    // Helper to check if array includes value
    this.hbs.registerHelper('includes', (array: unknown[], value: unknown) => {
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
    this.hbs.registerHelper('findRelatedExamples', (_packageName: string, _complexity: string) => {
      return [];
    });

    // Helper to load cross-package examples
    this.hbs.registerHelper(
      'loadCrossPackageExample',
      (sourcePackage: string, targetPackage: string, complexity: string, exampleId: string) => {
        const content = this.loadMarkdownContent(
          sourcePackage,
          `cross-package/${targetPackage}/${complexity}/${exampleId}.md`
        );
        return new this.hbs.SafeString(content);
      }
    );
  }

  async render(layout: string, data: Record<string, unknown>): Promise<string> {
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

    // Try YamlContentResolver first, then fall back to ContentResolver
    const content = YamlContentResolver.resolveContent(packageName, filePath);
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
