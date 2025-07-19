import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ParsedDocumentationSet,
  BaseDocumentationContent,
  FrameworkIntegrationContent,
  MergedDocumentationContent,
  EnhancedExampleDefinition,
  DocumentationParseOptions,
  DocumentationFilterOptions,
  FrameworkComponentType,
} from '../types/documentation-types';
import { globalDocumentationRegistry } from '../core/documentation-registry';

// Re-export DocumentationParseOptions for backward compatibility
export type ParseExampleOptions = DocumentationParseOptions;

/**
 * Unified parser for both base examples and framework integrations
 */
export class UnifiedExampleParser {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Parse example with optional framework integration
   */
  async parseExample(options: ParseExampleOptions): Promise<ParsedDocumentationSet> {
    // Find example metadata
    const example = globalDocumentationRegistry.findById(options.exampleId);
    if (!example) {
      throw new Error(`Example '${options.exampleId}' not found`);
    }

    // Parse base example
    const baseExample = await this.parseBaseExample(example);

    // Parse framework integration if requested
    let frameworkExample: FrameworkIntegrationContent | undefined;
    if (options.framework) {
      const availableFrameworks = globalDocumentationRegistry.getAvailableFrameworks(options.exampleId);

      if (!availableFrameworks.includes(options.framework)) {
        throw new Error(
          `Framework '${options.framework}' not available for example '${options.exampleId}'. ` +
          `Available: ${availableFrameworks.join(', ')}`
        );
      }

      frameworkExample = await this.parseFrameworkIntegration(example, options.framework);
    }

    // Merge and return
    const result: ParsedDocumentationSet = {
      base: baseExample,
      merged: this.mergeExamples(baseExample, frameworkExample),
    };

    if (frameworkExample) {
      result.framework = frameworkExample;
    }

    return result;
  }

  /**
   * Parse base example from markdown file
   */
  private async parseBaseExample(example: EnhancedExampleDefinition): Promise<BaseDocumentationContent> {
    const filePath = this.resolveExamplePath(example);
    const content = await this.readFileContent(filePath);

    return {
      metadata: example,
      content: {
        description: this.extractSection(content, 'Description'),
        businessContext: this.extractSection(content, 'Business Context'),
        codeExample: this.extractCodeSection(content, 'Code Example'),
        supportingTypes: this.extractCodeSection(content, 'Supporting Types'),
        usageExample: this.extractCodeSection(content, 'Usage Example'),
        testExample: this.extractCodeSection(content, 'Test Example'),
        commonPitfalls: this.extractListSection(content, 'Common Pitfalls'),
        migrationNotes: this.extractSection(content, 'Migration Notes'),
      },
    };
  }

  /**
   * Parse framework integration from markdown file
   */
  private async parseFrameworkIntegration(
    example: EnhancedExampleDefinition,
    framework: 'nestjs' | 'express' | 'fastify'
  ): Promise<FrameworkIntegrationContent> {
    const integration = example.frameworkIntegrations?.find(fi => fi.framework === framework);
    if (!integration) {
      throw new Error(`Framework integration for '${framework}' not found in example metadata`);
    }

    const filePath = this.resolveFrameworkPath(example, integration.path);
    const content = await this.readFileContent(filePath);

    // Extract components by parsing markdown sections
    const components = new Map<FrameworkComponentType, string>();

    integration.components.forEach(componentType => {
      const sectionName = this.getComponentSectionName(componentType);
      const componentCode = this.extractCodeSection(content, sectionName);

      if (componentCode) {
        components.set(componentType, componentCode);
      }
    });

    return {
      framework,
      baseExampleId: example.id,
      components,
      configuration: this.extractCodeSection(content, 'Configuration') || '',
      installation: this.extractSection(content, 'Installation') || '',
      errorHandling: this.extractCodeSection(content, 'Error Handling') || '',
      testing: this.extractCodeSection(content, 'Testing') || '',
      deployment: this.extractSection(content, 'Deployment') || '',
    };
  }

  /**
   * Merge base and framework examples
   */
  private mergeExamples(
    base: BaseDocumentationContent,
    framework?: FrameworkIntegrationContent
  ): MergedDocumentationContent {
    const result: MergedDocumentationContent = {
      metadata: base.metadata,
      baseContent: base.content,
      availableComponents: framework ? Array.from(framework.components.keys()) : [],
    };

    if (framework) {
      result.frameworkContent = framework;
    }

    return result;
  }

  /**
   * Extract text section from markdown
   */
  private extractSection(content: string, sectionName: string): string {
    const sectionRegex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, 'i');
    const match = content.match(sectionRegex);
    return match?.[1] ? match[1].trim() : '';
  }

  /**
   * Extract code section from markdown
   */
  private extractCodeSection(content: string, sectionName: string): string {
    const sectionRegex = new RegExp(
      `## ${sectionName}\\s*\\n\\s*\`\`\`[^\\n]*\\n([\\s\\S]*?)\`\`\``,
      'i'
    );
    const match = content.match(sectionRegex);
    return match?.[1] ? match[1].trim() : '';
  }

  /**
   * Extract list items from markdown section
   */
  private extractListSection(content: string, sectionName: string): string[] {
    const sectionText = this.extractSection(content, sectionName);
    if (!sectionText) return [];

    return sectionText
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(item => item.length > 0);
  }

  /**
   * Get section name for component type
   */
  private getComponentSectionName(componentType: FrameworkComponentType): string {
    const sectionMap: Record<FrameworkComponentType, string> = {
      module: 'Module Configuration',
      service: 'Service Implementation',
      controller: 'Controller Implementation',
      repository: 'Repository Implementation',
      dto: 'DTOs and Validation',
      config: 'Configuration',
      middleware: 'Middleware Implementation',
      guard: 'Guard Implementation',
      interceptor: 'Interceptor Implementation',
    };

    return sectionMap[componentType] || componentType;
  }

  /**
   * Resolve base example file path
   */
  private resolveExamplePath(example: EnhancedExampleDefinition): string {
    if (!example.package) {
      throw new Error(`Package not specified for example ${example.id}`);
    }
    return path.join(
      this.workspaceRoot,
      'packages',
      example.package,
      'examples',
      example.path || example.file
    );
  }

  /**
   * Resolve framework integration file path
   */
  private resolveFrameworkPath(example: EnhancedExampleDefinition, frameworkPath: string): string {
    if (!example.package) {
      throw new Error(`Package not specified for example ${example.id}`);
    }
    return path.join(
      this.workspaceRoot,
      'packages',
      example.package,
      'examples',
      frameworkPath
    );
  }

  /**
   * Read file content with error handling
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file '${filePath}': ${error}`);
    }
  }

  /**
   * Extract components from code sections based on file comments
   */
  extractComponentsByFileMarkers(code: string): Map<string, string> {
    const components = new Map<string, string>();

    // Split by file markers like "// filename.ts"
    const fileMarkerRegex = /\/\/\s+([a-zA-Z0-9-_.]+\.(ts|js))\s*\n([\s\S]*?)(?=\/\/\s+[a-zA-Z0-9-_.]+\.(ts|js)|$)/g;

    let match;
    while ((match = fileMarkerRegex.exec(code)) !== null) {
      const fileName = match[1];
      const fileContent = match?.[3]?.trim();

      if (fileName && fileContent) {
        components.set(fileName, fileContent);
      }
    }

    return components;
  }

  /**
   * Filter components based on selection criteria
   */
  filterComponents(
    components: Map<FrameworkComponentType, string>,
    options: DocumentationFilterOptions
  ): Map<FrameworkComponentType, string> {
    const filtered = new Map<FrameworkComponentType, string>();

    for (const [type, code] of components.entries()) {
      // Apply only filter
      if (options.only && options.only.length > 0) {
        if (!options.only.includes(type)) {
          continue;
        }
      }

      // Apply exclude filter
      if (options.exclude && options.exclude.includes(type)) {
        continue;
      }

      filtered.set(type, code);
    }

    return filtered;
  }
}
