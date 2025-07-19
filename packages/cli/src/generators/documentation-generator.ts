import { HybridTemplateEngine } from '../core/hybrid-template-engine';
import { SmartTagFinder } from '../core/smart-tag-finder';
import { PackageConfigLoader } from '../core/package-config-loader';
import type { ExampleDefinition, PackageExampleConfig } from '../types/example-types';
import { logger } from '../core/utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface GenerateDocumentationOptions {
  packageName: string;
  complexityLevels?: string[];
  framework?: string;
  sections?: string[];
  llmOptimized?: boolean;
  showRelated?: boolean;
  maxExamples?: number;
  randomize?: boolean;
  seed?: string;
  diOnly?: boolean;
  outputPath?: string;
}

export interface GenerateDocumentationResult {
  outputPath: string;
  packageConfig: PackageExampleConfig;
  examplesUsed: ExampleDefinition[];
  randomizedExamples: ExampleDefinition[];
  sectionsIncluded: string[];
}

export class DocumentationGenerator {
  private templateEngine: HybridTemplateEngine;
  private tagFinder: SmartTagFinder;
  private configLoader: PackageConfigLoader;

  constructor() {
    this.templateEngine = new HybridTemplateEngine();
    this.tagFinder = new SmartTagFinder();
    this.configLoader = new PackageConfigLoader();
  }

  async generate(options: GenerateDocumentationOptions): Promise<GenerateDocumentationResult> {
    logger.info(`🚀 Generating documentation for ${options.packageName}...`);

    // 1. Load package configuration
    const packageConfig = await this.configLoader.loadPackageConfig(options.packageName);

    // 2. Determine complexity levels
    const complexityLevels = options.complexityLevels || ['basic', 'intermediate', 'advanced'];

    // 3. Determine sections to include
    const sectionsIncluded = this.determineSections(options.sections, packageConfig);

    // 4. Find examples
    const examples = await this.findExamples(options, packageConfig);

    // 5. Filter examples by DI requirements
    const filteredExamples = this.filterExamplesByDI(examples, options.diOnly ?? false, complexityLevels);

    // 6. Apply smart selection and randomization
    const selectedExamples = await this.selectExamples(filteredExamples, options, packageConfig);

    // 7. Find related examples if requested
    const relatedExamples = options.showRelated
      ? await this.findRelatedExamples(options.packageName, complexityLevels, packageConfig)
      : [];

    // 8. Generate documentation
    const templateData = {
      packageConfig,
      complexityLevels,
      framework: options.framework,
      sections: sectionsIncluded,
      examples: selectedExamples.selected,
      relatedExamples,
      llmOptimized: options.llmOptimized,
      timestamp: new Date().toISOString(),
      seed: options.seed || packageConfig.tagFinder?.seed
    };

    const layout = options.llmOptimized ? 'llm-optimized' : 'feature-doc';
    const content = await this.templateEngine.render(layout, templateData);

    // 9. Write output
    const outputPath = this.determineOutputPath(options, packageConfig);
    await this.writeOutput(outputPath, content);

    logger.success(`✅ Documentation generated successfully!`);

    return {
      outputPath,
      packageConfig,
      examplesUsed: selectedExamples.selected,
      randomizedExamples: selectedExamples.randomized,
      sectionsIncluded
    };
  }

  private determineSections(
    requestedSections: string[] | undefined,
    packageConfig: PackageExampleConfig
  ): string[] {
    if (requestedSections) {
      // Validate requested sections
      const availableSections = packageConfig.sections || [];

      const invalidSections = requestedSections.filter(
        section => !availableSections.includes(section)
      );

      if (invalidSections.length > 0) {
        logger.warn(`⚠️  Invalid sections: ${invalidSections.join(', ')}`);
        logger.info(`Available sections: ${availableSections.join(', ')}`);
      }

      return requestedSections.filter(section => availableSections.includes(section));
    }

    // Use all available sections
    return packageConfig.sections || [];
  }

  private async findExamples(
    options: GenerateDocumentationOptions,
    packageConfig: PackageExampleConfig
  ): Promise<ExampleDefinition[]> {
    const examples: ExampleDefinition[] = [];

    // Find examples by complexity levels
    for (const complexity of options.complexityLevels || ['basic', 'intermediate', 'advanced']) {
      const coreTag = `${options.packageName}:core`;
      const coreExamples = await this.tagFinder.findExamplesByTag(coreTag, complexity);
      examples.push(...coreExamples);
    }

    return examples;
  }

  private filterExamplesByDI(
    examples: ExampleDefinition[],
    diOnly: boolean,
    complexityLevels: string[]
  ): ExampleDefinition[] {
    if (!diOnly) {
      return examples;
    }

    return examples.filter(example => {
      // For advanced examples, DI is usually required
      if (example.complexity === 'advanced') {
        return example.diSupport;
      }

      // For other levels, check if DI is supported
      return example.diSupport;
    });
  }

  private async selectExamples(
    examples: ExampleDefinition[],
    options: GenerateDocumentationOptions,
    packageConfig: PackageExampleConfig
  ): Promise<{ selected: ExampleDefinition[]; randomized: ExampleDefinition[] }> {
    const tagFinderConfig = packageConfig.tagFinder;

    if (!tagFinderConfig || !options.randomize) {
      return { selected: examples, randomized: [] };
    }

    // Apply smart selection
    const maxExamples = options.maxExamples || tagFinderConfig.maxExamples || 3;
    const seed = options.seed || tagFinderConfig.seed;

    const selected = await this.tagFinder.selectExamples(examples, {
      maxExamples,
      randomize: options.randomize,
      seed,
      priorityTags: tagFinderConfig.priorityTags
    });

    const randomized = examples.filter(ex => !selected.includes(ex));

    return { selected, randomized };
  }

  private async findRelatedExamples(
    packageName: string,
    complexityLevels: string[],
    packageConfig: PackageExampleConfig
  ): Promise<ExampleDefinition[]> {
    const relatedExamples: ExampleDefinition[] = [];

    // Find examples from other packages that integrate with this package
    for (const complexity of complexityLevels) {
      const integrationTag = `*:integration:${packageName}`;
      const integrationExamples = await this.tagFinder.findExamplesByTag(integrationTag, complexity);
      relatedExamples.push(...integrationExamples);
    }

    return relatedExamples;
  }

  private determineOutputPath(
    options: GenerateDocumentationOptions,
    packageConfig: PackageExampleConfig
  ): string {
    if (options.outputPath) {
      return options.outputPath;
    }

    // Generate descriptive filename with version and date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const version = packageConfig.version || '1.0.0';
    
    let filename = `${packageConfig.displayName || packageConfig.packageName}-Documentation`;
    
    // Add version information
    filename += `-v${version}`;
    
    // Add framework if specified
    if (options.framework) {
      filename += `-${options.framework}`;
    }
    
    // Add complexity level if single level specified
    if (options.complexityLevels && options.complexityLevels.length === 1) {
      filename += `-${options.complexityLevels[0]}`;
    }
    
    // Add optimization type
    if (options.llmOptimized) {
      filename += '-LLM-Optimized';
    } else {
      filename += '-Standard';
    }
    
    // Add generation date
    filename += `-${dateStr}`;
    
    filename += '.md';

    return path.join(process.cwd(), filename);
  }

  private async writeOutput(outputPath: string, content: string): Promise<void> {
    await fs.writeFile(outputPath, content, 'utf-8');
  }
}
