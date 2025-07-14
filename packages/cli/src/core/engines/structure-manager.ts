/**
 * @fileoverview Structure Manager - Flexible project structure support
 * Manages different architecture patterns and project layouts
 */

import type { ProjectStructure} from '../../types';
import { CLIError } from '../../types';
import { FileSystem } from '../utils/file-system';

export interface StructureConfig {
  name: ProjectStructure;
  description: string;
  directories: string[];
  files: { [path: string]: string };
  patterns: {
    domain: string;
    application: string;
    infrastructure: string;
    presentation?: string;
  };
}

/**
 * Project structure manager for different architecture patterns
 */
export class StructureManager {
  private structures = new Map<ProjectStructure, StructureConfig>();

  constructor() {
    this.initializeBuiltInStructures();
  }

  /**
   * Create structure manager instance
   */
  static create(): StructureManager {
    return new StructureManager();
  }

  /**
   * Initialize built-in structure configurations
   */
  private initializeBuiltInStructures(): void {
    // Clean Architecture
    this.structures.set('clean-architecture', {
      name: 'clean-architecture',
      description: 'Clean Architecture with dependency inversion',
      directories: [
        'src/domain/entities',
        'src/domain/aggregates',
        'src/domain/value-objects',
        'src/domain/specifications',
        'src/domain/events',
        'src/application/commands',
        'src/application/queries',
        'src/application/handlers',
        'src/application/services',
        'src/infrastructure/repositories',
        'src/infrastructure/adapters',
        'src/infrastructure/persistence',
        'src/presentation/controllers',
        'src/presentation/dtos',
        'tests/domain',
        'tests/application',
        'tests/infrastructure',
        'tests/presentation'
      ],
      files: {
        'src/domain/index.ts': '// Domain layer exports',
        'src/application/index.ts': '// Application layer exports',
        'src/infrastructure/index.ts': '// Infrastructure layer exports',
        'src/presentation/index.ts': '// Presentation layer exports'
      },
      patterns: {
        domain: 'src/domain',
        application: 'src/application',
        infrastructure: 'src/infrastructure',
        presentation: 'src/presentation'
      }
    });

    // Hexagonal Architecture
    this.structures.set('hexagonal', {
      name: 'hexagonal',
      description: 'Hexagonal Architecture (Ports and Adapters)',
      directories: [
        'src/core/domain',
        'src/core/application',
        'src/core/ports',
        'src/adapters/primary/web',
        'src/adapters/primary/cli',
        'src/adapters/secondary/persistence',
        'src/adapters/secondary/messaging',
        'src/adapters/secondary/external',
        'tests/core',
        'tests/adapters'
      ],
      files: {
        'src/core/index.ts': '// Core domain exports',
        'src/adapters/index.ts': '// Adapters exports'
      },
      patterns: {
        domain: 'src/core/domain',
        application: 'src/core/application',
        infrastructure: 'src/adapters/secondary'
      }
    });

    // Onion Architecture
    this.structures.set('onion', {
      name: 'onion',
      description: 'Onion Architecture with concentric layers',
      directories: [
        'src/core/domain/model',
        'src/core/domain/services',
        'src/core/application/services',
        'src/core/application/interfaces',
        'src/infrastructure/data',
        'src/infrastructure/services',
        'src/infrastructure/repositories',
        'src/presentation/api',
        'src/presentation/web',
        'tests/core',
        'tests/infrastructure',
        'tests/presentation'
      ],
      files: {
        'src/core/index.ts': '// Core layer exports',
        'src/infrastructure/index.ts': '// Infrastructure layer exports',
        'src/presentation/index.ts': '// Presentation layer exports'
      },
      patterns: {
        domain: 'src/core/domain',
        application: 'src/core/application',
        infrastructure: 'src/infrastructure',
        presentation: 'src/presentation'
      }
    });

    // Modular Monolith
    this.structures.set('modular-monolith', {
      name: 'modular-monolith',
      description: 'Modular Monolith with bounded contexts',
      directories: [
        'src/modules/orders/domain',
        'src/modules/orders/application',
        'src/modules/orders/infrastructure',
        'src/modules/customers/domain',
        'src/modules/customers/application',
        'src/modules/customers/infrastructure',
        'src/modules/inventory/domain',
        'src/modules/inventory/application',
        'src/modules/inventory/infrastructure',
        'src/shared/domain',
        'src/shared/application',
        'src/shared/infrastructure',
        'src/api',
        'tests/modules',
        'tests/shared',
        'tests/integration'
      ],
      files: {
        'src/modules/index.ts': '// Modules exports',
        'src/shared/index.ts': '// Shared exports',
        'src/api/index.ts': '// API exports'
      },
      patterns: {
        domain: 'src/modules/*/domain',
        application: 'src/modules/*/application',
        infrastructure: 'src/modules/*/infrastructure'
      }
    });

    // Microservices
    this.structures.set('microservices', {
      name: 'microservices',
      description: 'Microservices with service boundaries',
      directories: [
        'services/order-service/src/domain',
        'services/order-service/src/application',
        'services/order-service/src/infrastructure',
        'services/customer-service/src/domain',
        'services/customer-service/src/application',
        'services/customer-service/src/infrastructure',
        'services/inventory-service/src/domain',
        'services/inventory-service/src/application',
        'services/inventory-service/src/infrastructure',
        'shared/contracts',
        'shared/events',
        'shared/utils',
        'gateway',
        'tests/services',
        'tests/integration'
      ],
      files: {
        'services/order-service/package.json': '{\n  "name": "order-service",\n  "version": "1.0.0"\n}',
        'services/customer-service/package.json': '{\n  "name": "customer-service",\n  "version": "1.0.0"\n}',
        'services/inventory-service/package.json': '{\n  "name": "inventory-service",\n  "version": "1.0.0"\n}',
        'shared/index.ts': '// Shared exports'
      },
      patterns: {
        domain: 'services/*/src/domain',
        application: 'services/*/src/application',
        infrastructure: 'services/*/src/infrastructure'
      }
    });
  }

  /**
   * Get structure configuration
   */
  getStructure(type: ProjectStructure): StructureConfig {
    const structure = this.structures.get(type);
    if (!structure) {
      throw new CLIError(`Unknown project structure: ${type}`);
    }
    return structure;
  }

  /**
   * Get all available structures
   */
  getAllStructures(): StructureConfig[] {
    return Array.from(this.structures.values());
  }

  /**
   * Register custom structure
   */
  registerStructure(config: StructureConfig): void {
    this.structures.set(config.name, config);
  }

  /**
   * Detect existing project structure
   */
  async detectStructure(projectPath: string): Promise<ProjectStructure | null> {
    try {
      // Check for typical structure indicators
      const indicators = [
        { structure: 'clean-architecture' as ProjectStructure, paths: ['src/domain', 'src/application', 'src/infrastructure'] },
        { structure: 'hexagonal' as ProjectStructure, paths: ['src/core', 'src/adapters'] },
        { structure: 'onion' as ProjectStructure, paths: ['src/core/domain', 'src/core/application'] },
        { structure: 'modular-monolith' as ProjectStructure, paths: ['src/modules'] },
        { structure: 'microservices' as ProjectStructure, paths: ['services'] }
      ];

      for (const indicator of indicators) {
        const hasAllPaths = await Promise.all(
          indicator.paths.map(path =>
            FileSystem.exists(FileSystem.joinPath(projectPath, path))
          )
        );

        if (hasAllPaths.every(exists => exists)) {
          return indicator.structure;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create project structure
   */
  async createStructure(type: ProjectStructure, projectPath: string): Promise<void> {
    const structure = this.getStructure(type);

    try {
      // Create directories
      for (const directory of structure.directories) {
        const fullPath = FileSystem.joinPath(projectPath, directory);
        await FileSystem.createDirectory(fullPath);
      }

      // Create files
      for (const [filePath, content] of Object.entries(structure.files)) {
        const fullPath = FileSystem.joinPath(projectPath, filePath);
        await FileSystem.writeFile(fullPath, content);
      }

    } catch (error) {
      throw new CLIError(`Failed to create ${type} structure: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get component path for structure
   */
  getComponentPath(
    structure: ProjectStructure,
    componentType: 'domain' | 'application' | 'infrastructure' | 'presentation',
    componentName: string,
    moduleName?: string
  ): string {
    const config = this.getStructure(structure);
    let basePath = config.patterns[componentType];

    if (!basePath) {
      throw new CLIError(`Component type ${componentType} not supported in ${structure} structure`);
    }

    // Handle modular structures
    if (structure === 'modular-monolith' && moduleName) {
      basePath = basePath.replace('*', moduleName);
    } else if (structure === 'microservices' && moduleName) {
      basePath = basePath.replace('*', `${moduleName}-service`);
    }

    // Determine subdirectory based on component type
    let subdirectory = '';
    switch (componentType) {
      case 'domain':
        if (componentName.endsWith('Aggregate')) {
          subdirectory = 'aggregates';
        } else if (componentName.endsWith('Entity')) {
          subdirectory = 'entities';
        } else if (componentName.endsWith('ValueObject') || componentName.endsWith('VO')) {
          subdirectory = 'value-objects';
        } else if (componentName.endsWith('Specification')) {
          subdirectory = 'specifications';
        } else if (componentName.endsWith('Event')) {
          subdirectory = 'events';
        } else {
          subdirectory = 'model';
        }
        break;
      case 'application':
        if (componentName.endsWith('Command')) {
          subdirectory = 'commands';
        } else if (componentName.endsWith('Query')) {
          subdirectory = 'queries';
        } else if (componentName.endsWith('Handler')) {
          subdirectory = 'handlers';
        } else {
          subdirectory = 'services';
        }
        break;
      case 'infrastructure':
        if (componentName.endsWith('Repository')) {
          subdirectory = 'repositories';
        } else if (componentName.endsWith('Adapter')) {
          subdirectory = 'adapters';
        } else {
          subdirectory = 'services';
        }
        break;
    }

    return FileSystem.joinPath(basePath, subdirectory);
  }

  /**
   * Validate structure configuration
   */
  validateStructure(config: StructureConfig): boolean {
    try {
      // Check required fields
      if (!config.name || !config.description || !config.directories || !config.patterns) {
        return false;
      }

      // Check patterns
      if (!config.patterns.domain || !config.patterns.application || !config.patterns.infrastructure) {
        return false;
      }

      // Check directories array
      if (!Array.isArray(config.directories) || config.directories.length === 0) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate structure documentation
   */
  generateDocumentation(type: ProjectStructure): string {
    const structure = this.getStructure(type);

    let doc = `# ${structure.name} Architecture\n\n`;
    doc += `${structure.description}\n\n`;
    doc += `## Directory Structure\n\n`;

    structure.directories.forEach(dir => {
      doc += `- \`${dir}\`\n`;
    });

    doc += `\n## Layer Patterns\n\n`;
    Object.entries(structure.patterns).forEach(([layer, path]) => {
      doc += `- **${layer}**: \`${path}\`\n`;
    });

    return doc;
  }
}
