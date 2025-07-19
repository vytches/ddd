import type { ExampleDefinition } from '../types/example-types';
import { PackageConfigLoader } from './package-config-loader';
import { SeededRandom } from '../utils/seeded-random';

export interface FindOptions {
  framework?: string;
  maxExamples?: number;
  randomize?: boolean;
  seed?: string;
  priorityTags?: string[];
}

export interface SelectOptions {
  maxExamples: number;
  randomize: boolean;
  seed?: string;
  priorityTags?: string[];
}

export class SmartTagFinder {
  private configLoader: PackageConfigLoader;
  private exampleCache: Map<string, ExampleDefinition[]> = new Map();

  constructor() {
    this.configLoader = new PackageConfigLoader();
  }

  async findExamplesByTag(
    tagPattern: string,
    complexity?: string,
    options?: FindOptions
  ): Promise<ExampleDefinition[]> {
    // Load all examples
    const allExamples = await this.loadAllExamples();

    // Filter by tag pattern
    const tagRegex = new RegExp(tagPattern.replace(/\*/g, '.*'));
    const matchingExamples = allExamples.filter(example => {
      const resolvedTags = this.resolveTagsForExample(example);
      return resolvedTags.some(tag => tagRegex.test(tag));
    });

    // Filter by complexity if specified
    const complexityFiltered = complexity
      ? matchingExamples.filter(example => example.complexity === complexity)
      : matchingExamples;

    // Filter by framework if specified
    const frameworkFiltered = options?.framework
      ? complexityFiltered.filter(example =>
          example.frameworkIntegrations?.some(integration =>
            integration === options.framework
          )
        )
      : complexityFiltered;

    return frameworkFiltered;
  }

  async selectExamples(
    examples: ExampleDefinition[],
    options: SelectOptions
  ): Promise<ExampleDefinition[]> {
    if (examples.length <= options.maxExamples) {
      return examples;
    }

    // Separate priority examples
    const { priority, regular } = this.separateByPriority(examples, options.priorityTags);

    const selected: ExampleDefinition[] = [];

    // Always include priority examples
    selected.push(...priority);

    // Fill remaining slots with regular examples
    const remainingSlots = options.maxExamples - selected.length;
    if (remainingSlots > 0) {
      const regularSelection = options.randomize
        ? this.randomSelect(regular, remainingSlots, options.seed)
        : regular.slice(0, remainingSlots);

      selected.push(...regularSelection);
    }

    return selected;
  }

  async suggestSimilarTags(tagPattern: string): Promise<string[]> {
    const allExamples = await this.loadAllExamples();
    const allTags = new Set<string>();

    allExamples.forEach(example => {
      const resolvedTags = this.resolveTagsForExample(example);
      resolvedTags.forEach(tag => allTags.add(tag));
    });

    const suggestions = Array.from(allTags).filter(tag => {
      // Simple similarity check - could be improved with Levenshtein distance
      return tag.includes(tagPattern.replace(/\*/g, '')) ||
             tagPattern.replace(/\*/g, '').includes(tag);
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private resolveTagsForExample(example: ExampleDefinition): string[] {
    return example.tags.map(tag => `${tag}:${example.complexity}`);
  }

  private separateByPriority(
    examples: ExampleDefinition[],
    priorityTags?: string[]
  ): { priority: ExampleDefinition[]; regular: ExampleDefinition[] } {
    if (!priorityTags || priorityTags.length === 0) {
      return { priority: [], regular: examples };
    }

    const priority = examples.filter(example =>
      example.tags.some(tag => priorityTags.includes(tag))
    );

    const regular = examples.filter(example =>
      !example.tags.some(tag => priorityTags.includes(tag))
    );

    return { priority, regular };
  }

  private randomSelect(
    examples: ExampleDefinition[],
    count: number,
    seed?: string
  ): ExampleDefinition[] {
    if (examples.length <= count) {
      return examples;
    }

    const random = new SeededRandom(seed || 'default');
    const shuffled = [...examples].sort(() => random.next() - 0.5);

    return shuffled.slice(0, count);
  }

  private async loadAllExamples(): Promise<ExampleDefinition[]> {
    const cacheKey = 'all-examples';

    if (this.exampleCache.has(cacheKey)) {
      return this.exampleCache.get(cacheKey)!;
    }

    const allExamples: ExampleDefinition[] = [];

    // Load examples from all packages
    const packages = await this.configLoader.getAvailablePackages();

    for (const packageName of packages) {
      try {
        const packageConfig = await this.configLoader.loadPackageConfig(packageName);

        // Generate example definitions from package config
        const packageExamples = await this.generateExampleDefinitions(packageConfig);
        allExamples.push(...packageExamples);

      } catch (error) {
        console.warn(`⚠️  Failed to load examples from package: ${packageName}`);
      }
    }

    this.exampleCache.set(cacheKey, allExamples);
    return allExamples;
  }

  private async generateExampleDefinitions(
    packageConfig: any
  ): Promise<ExampleDefinition[]> {
    const examples: ExampleDefinition[] = [];

    // Generate examples for each complexity level
    for (const [complexityKey, complexityConfig] of Object.entries(packageConfig.complexityLevels)) {
      const complexity = complexityConfig as any;

      // Generate core examples
      if (packageConfig.tags.core) {
        for (const coreTag of packageConfig.tags.core) {
          examples.push({
            id: `${packageConfig.packageName}-${complexity.level}-core`,
            name: `${packageConfig.displayName} - ${complexity.level} Core`,
            description: complexity.description,
            path: `${complexity.level}/implementation.md`,
            complexity: complexity.level,
            file: `${complexity.level}/implementation.md`,
            priority: 'medium',
            package: packageConfig.packageName,
            tags: [coreTag],
            dependencies: packageConfig.dependencies || [],
            diSupport: complexity.diSupport || false,
            frameworkIntegrations: packageConfig.frameworks?.map((framework: string) => ({
              framework,
              path: `frameworks/${framework}/${complexity.level}.md`,
              components: ['service'],
              dependencies: []
            })) || []
          });
        }
      }

      // Generate integration examples
      if (packageConfig.tags.integrations) {
        for (const integrationTag of packageConfig.tags.integrations) {
          const targetPackage = integrationTag.split(':')[2];

          examples.push({
            id: `${packageConfig.packageName}-${complexity.level}-integration-${targetPackage}`,
            name: `${packageConfig.displayName} - ${complexity.level} Integration with ${targetPackage}`,
            description: `Integration example with ${targetPackage}`,
            path: `${complexity.level}/integration-${targetPackage}.md`,
            complexity: complexity.level,
            file: `${complexity.level}/integration-${targetPackage}.md`,
            priority: 'medium',
            package: packageConfig.packageName,
            tags: [integrationTag],
            dependencies: packageConfig.dependencies || [],
            diSupport: complexity.diSupport || false,
            frameworkIntegrations: []
          });
        }
      }
    }

    return examples;
  }

  clearCache(): void {
    this.exampleCache.clear();
  }
}
