import { HybridTemplateEngine } from '../core/hybrid-template-engine';
import type { SelectOptions } from '../core/smart-tag-finder';
import { SmartTagFinder } from '../core/smart-tag-finder';
import { YamlPackageConfigLoader } from '../core/yaml-package-config-loader';
import type { ExampleDefinition, PackageExampleConfig } from '../types/example-types';
import { logger } from '../core/utils/logger';
import { HierarchicalMetadataResolver } from '@vytches/ddd-utils';
import type { ResolvedMetadata } from '@vytches/ddd-utils';
import path from 'path';
import fs from 'fs/promises';
import * as yaml from 'js-yaml';

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
  enhancedMetadata?: boolean;
}

export interface GenerateDocumentationResult {
  outputPath: string;
  packageConfig: PackageExampleConfig;
  examplesUsed: ExampleDefinition[];
  randomizedExamples: ExampleDefinition[];
  sectionsIncluded: string[];
}

interface YamlComponent {
  name: string;
  className: string;
  description: string;
  businessContext: string;
  methods: Record<string, YamlMethod>;
  examples?: string[];
  interfaces?: Record<string, YamlInterface>;
  types?: Record<string, YamlType>;
  enums?: Record<string, YamlEnum>;
  constants?: Record<string, YamlConstant>;
}

interface YamlMethod {
  description: string;
  businessContext: string;
  parameters?: unknown[];
  returns?: { type: string; description: string };
  examples: string[];
}

interface YamlInterface {
  description: string;
  businessContext: string;
  methods: Record<string, YamlMethod>;
  properties?: Array<{ name: string; type: string; description?: string; required?: boolean }>;
  genericParameters?: Array<{ name: string; description?: string; default?: string; extends?: string }>;
  extends?: string[];
}

interface YamlType {
  description: string;
  businessContext: string;
  properties?: Array<{ name: string; type: string; description?: string; required?: boolean }>;
  genericParameters?: Array<{ name: string; description?: string; default?: string; extends?: string }>;
  typeDefinition?: string;
  functionSignature?: unknown;
  callSignature?: unknown;
}

interface YamlEnum {
  description: string;
  businessContext: string;
  values: Array<{ name: string; value?: string; description?: string }>;
}

interface YamlConstant {
  description: string;
  businessContext: string;
  type: string;
  properties?: Array<{ name: string; value?: string; description?: string }>;
}

export class DocumentationGenerator {
  private templateEngine: HybridTemplateEngine;
  private tagFinder: SmartTagFinder;
  private configLoader: YamlPackageConfigLoader;
  private metadataResolver: HierarchicalMetadataResolver;

  constructor() {
    this.templateEngine = new HybridTemplateEngine();
    this.tagFinder = new SmartTagFinder();
    this.configLoader = new YamlPackageConfigLoader();
    this.metadataResolver = new HierarchicalMetadataResolver();
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
    const filteredExamples = this.filterExamplesByDI(
      examples,
      options.diOnly ?? false,
      complexityLevels
    );

    // 6. Apply smart selection and randomization
    const selectedExamples = await this.selectExamples(filteredExamples, options, packageConfig);

    // 7. Find related examples if requested
    const relatedExamples = options.showRelated
      ? await this.findRelatedExamples(options.packageName, complexityLevels, packageConfig)
      : [];

    // 8. Load YAML components if enhanced metadata is enabled
    const yamlComponents = options.enhancedMetadata
      ? await this.loadYamlComponents(options.packageName, complexityLevels[0] || 'basic')
      : [];

    // 9. Generate documentation
    const templateData = {
      packageConfig,
      complexityLevels,
      framework: options.framework,
      sections: sectionsIncluded,
      examples: selectedExamples.selected,
      relatedExamples,
      yamlComponents,
      llmOptimized: options.llmOptimized,
      enhancedMetadata: options.enhancedMetadata,
      timestamp: new Date().toISOString(),
      seed: options.seed || packageConfig.tagFinder?.seed,
    };

    const layout = options.enhancedMetadata ? 'yaml-doc' : (options.llmOptimized ? 'llm-optimized' : 'feature-doc');
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
      sectionsIncluded,
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

    const selectOptions: SelectOptions = {
      maxExamples,
      randomize: options.randomize,
      priorityTags: tagFinderConfig.priorityTags,
    };

    if (seed !== undefined) {
      selectOptions.seed = seed;
    }

    const selected = await this.tagFinder.selectExamples(examples, selectOptions);

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
      const integrationExamples = await this.tagFinder.findExamplesByTag(
        integrationTag,
        complexity
      );
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

  /**
   * Extract examples from various formats into a consistent structure
   */
  private extractExamples(examples: any): Array<{ id?: string; code: string }> {
    if (!examples || !Array.isArray(examples)) {
      return [];
    }

    return examples.map((example, index) => {
      // Handle different example formats
      if (typeof example === 'string') {
        // Simple string example
        return { id: `example-${index + 1}`, code: example };
      } else if (typeof example === 'object' && example !== null) {
        // Object with code property
        if (example.code) {
          return { 
            id: example.id || example.title || `example-${index + 1}`, 
            code: example.code 
          };
        }
        // Object with direct content
        if (example.content) {
          return { 
            id: example.id || example.title || `example-${index + 1}`, 
            code: example.content 
          };
        }
        // Try to stringify object as fallback
        return { 
          id: `example-${index + 1}`, 
          code: JSON.stringify(example, null, 2) 
        };
      }
      return { id: `example-${index + 1}`, code: String(example) };
    });
  }

  /**
   * Converts kebab-case to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private async loadYamlComponents(packageName: string, _complexity: string): Promise<YamlComponent[]> {
    const components: YamlComponent[] = [];
    const yamlDir = path.join(process.cwd(), 'docs', 'examples', 'domain', packageName);
    
    try {
      // Get all YAML files in the package directory (excluding .md-settings.yaml)
      const files = await fs.readdir(yamlDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') && f !== '.md-settings.yaml');
      
      console.log(`[DEBUG] Found ${yamlFiles.length} YAML files: ${yamlFiles.join(', ')}`);
      
      for (const file of yamlFiles) {
        // Extract className from file name (e.g., 'aggregate-root.yaml' -> 'AggregateRoot')
        const baseName = path.basename(file, '.yaml');
        const className = this.toPascalCase(baseName);
        
        console.log(`[DEBUG] Loading YAML component: ${className} from ${file}`);
        
        // Read and parse the YAML file directly to access all sections
        const filePath = path.join(yamlDir, file);
        const yamlContent = await fs.readFile(filePath, 'utf8');
        const yamlData = yaml.load(yamlContent) as any;
        
        if (!yamlData) {
          console.log(`[DEBUG] Failed to parse YAML file: ${file}`);
          continue;
        }
        console.log(`[DEBUG] Successfully parsed YAML file: ${file}`);
        
        // Use HierarchicalMetadataResolver to get class-level metadata for classes section
        let classMetadata: any = null;
        if (yamlData.classes) {
          classMetadata = await this.metadataResolver.resolveForMethod({
            packageName,
            className: baseName, // Use kebab-case for resolver
            methodName: 'constructor', // Get class-level info
            format: 'cli'
          });
        }
        
        const component: YamlComponent = {
          name: className,
          className,
          description: yamlData.description || classMetadata?.description || '',
          businessContext: yamlData.businessContext || classMetadata?.businessContext || '',
          methods: {},
          examples: this.extractExamples(classMetadata?.examples || yamlData.examples || []),
          interfaces: {}, // Add interfaces support
          types: {}, // Add types support
          enums: {}, // Add enums support
          constants: {} // Add constants support
        };
        
        // Process classes if they exist
        if (yamlData.classes) {
          // Load method metadata using batch resolution for performance
          const allMethodsMetadata = await this.metadataResolver.resolveAllMethodsForClass({
            packageName,
            className: baseName, // Use kebab-case for resolver
            format: 'cli'
          });
          
          // Process each method
          for (const [methodName, methodMetadata] of Object.entries(allMethodsMetadata)) {
            if (methodMetadata) {
              component.methods[methodName] = {
                description: methodMetadata.description || '',
                businessContext: methodMetadata.businessContext || '',
                parameters: methodMetadata.parameters || [],
                returns: methodMetadata.returns || { type: 'void', description: '' },
                examples: this.extractExamples(methodMetadata.examples || [])
              };
            }
          }
        }
        
        // Process interfaces section
        if (yamlData.interfaces && typeof yamlData.interfaces === 'object') {
          if (!component.interfaces) component.interfaces = {};
          for (const [interfaceName, interfaceData] of Object.entries(yamlData.interfaces)) {
            if (typeof interfaceData === 'object' && interfaceData !== null) {
              const iface = interfaceData as Record<string, unknown>;
              component.interfaces[interfaceName] = {
                description: (iface.description as string) || '',
                businessContext: (iface.businessContext as string) || '',
                methods: {},
                properties: (iface.properties as Array<{ name: string; type: string; description?: string; required?: boolean }>) || [],
                genericParameters: (iface['generic-parameters'] as Array<{ name: string; description?: string; default?: string; extends?: string }>) || [],
                extends: (iface.extends as string[]) || []
              };
              
              // Process interface methods
              if (iface.methods && typeof iface.methods === 'object') {
                for (const [methodName, methodData] of Object.entries(iface.methods as Record<string, unknown>)) {
                  if (typeof methodData === 'object' && methodData !== null) {
                    const method = methodData as Record<string, unknown>;
                    component.interfaces[interfaceName].methods[methodName] = {
                      description: (method.description as string) || '',
                      businessContext: (method.businessContext as string) || '',
                      parameters: (method.parameters as unknown[]) || [],
                      returns: (method.returns as { type: string; description: string }) || { type: 'void', description: '' },
                      examples: (method.examples as string[]) || []
                    };
                  }
                }
              }
            }
          }
        }
        
        // Process types section
        if (yamlData.types && typeof yamlData.types === 'object') {
          if (!component.types) component.types = {};
          for (const [typeName, typeData] of Object.entries(yamlData.types)) {
            if (typeof typeData === 'object' && typeData !== null) {
              const type = typeData as Record<string, unknown>;
              component.types[typeName] = {
                description: (type.description as string) || '',
                businessContext: (type.businessContext as string) || '',
                properties: (type.properties as Array<{ name: string; type: string; description?: string; required?: boolean }>) || [],
                genericParameters: (type['generic-parameters'] as Array<{ name: string; description?: string; default?: string; extends?: string }>) || [],
                typeDefinition: (type['type-definition'] as string) || '',
                functionSignature: type['function-signature'] || null,
                callSignature: type['call-signature'] || null
              };
            }
          }
        }
        
        // Process enums section
        if (yamlData.enums && typeof yamlData.enums === 'object') {
          if (!component.enums) component.enums = {};
          for (const [enumName, enumData] of Object.entries(yamlData.enums)) {
            if (typeof enumData === 'object' && enumData !== null) {
              const enumDef = enumData as Record<string, unknown>;
              component.enums[enumName] = {
                description: (enumDef.description as string) || '',
                businessContext: (enumDef.businessContext as string) || '',
                values: (enumDef.values as Array<{ name: string; value?: string; description?: string }>) || []
              };
            }
          }
        }
        
        // Process constants section
        if (yamlData.constants && typeof yamlData.constants === 'object') {
          if (!component.constants) component.constants = {};
          for (const [constantName, constantData] of Object.entries(yamlData.constants)) {
            if (typeof constantData === 'object' && constantData !== null) {
              const constant = constantData as Record<string, unknown>;
              component.constants[constantName] = {
                description: (constant.description as string) || '',
                businessContext: (constant.businessContext as string) || '',
                type: (constant.type as string) || 'unknown',
                properties: (constant.properties as Array<{ name: string; value?: string; description?: string }>) || []
              };
            }
          }
        }
        
        components.push(component);
        console.log(`[DEBUG] Loaded component ${className} with ${Object.keys(component.methods).length} methods, ${Object.keys(component.interfaces || {}).length} interfaces, ${Object.keys(component.types || {}).length} types`);
      }
    } catch (error) {
      console.log(`[DEBUG] Failed to load YAML components for ${packageName}:`, error);
    }
    
    return components;
  }
  
}
