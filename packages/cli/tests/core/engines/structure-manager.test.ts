import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { StructureManager } from '../../../src/core/engines/structure-manager';
import { CLIError } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/core/utils/file-system');

import { FileSystem } from '../../../src/core/utils/file-system';

interface StructureConfig {
  name: any;
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

describe('StructureManager', () => {
  let manager: StructureManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new StructureManager();

    // Setup default mocks
    vi.mocked(FileSystem.exists).mockResolvedValue(true);
    vi.mocked(FileSystem.createDirectory).mockResolvedValue(undefined);
    vi.mocked(FileSystem.writeFile).mockResolvedValue(undefined);
    vi.mocked(FileSystem.joinPath).mockImplementation((...paths) => paths.join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and factory', () => {
    it('should create instance and initialize built-in structures', () => {
      expect(manager).toBeInstanceOf(StructureManager);

      // Verify that built-in structures are loaded
      const allStructures = manager.getAllStructures();
      expect(allStructures.length).toBeGreaterThan(0);
    });

    it('should create instance using static factory method', () => {
      const factoryManager = StructureManager.create();

      expect(factoryManager).toBeInstanceOf(StructureManager);
    });
  });

  describe('structure retrieval', () => {
    it('should get structure by type', () => {
      const [error, structure] = safeRun(() => manager.getStructure('clean-architecture'));

      expect(error).toBeUndefined();
      expect(structure).toBeDefined();
      expect(structure?.name).toBe('clean-architecture');
      expect(structure?.description).toContain('Clean Architecture');
    });

    it('should throw error for non-existent structure', () => {
      const [structureError] = safeRun(() => manager.getStructure('non-existent' as any));

      expect(structureError).toBeInstanceOf(CLIError);
      expect(structureError?.message).toContain('Unknown project structure: non-existent');
    });

    it('should get all structures', () => {
      const allStructures = manager.getAllStructures();

      expect(allStructures).toBeInstanceOf(Array);
      expect(allStructures.length).toBe(5); // Built-in structures

      // Check that key structures are included
      const structureNames = allStructures.map(s => s.name);
      expect(structureNames).toContain('clean-architecture');
      expect(structureNames).toContain('hexagonal');
      expect(structureNames).toContain('onion');
      expect(structureNames).toContain('modular-monolith');
      expect(structureNames).toContain('microservices');
    });
  });

  describe('custom structure registration', () => {
    it('should register custom structure', () => {
      const customStructure: StructureConfig = {
        name: 'custom-arch' as any,
        description: 'Custom architecture pattern',
        directories: ['src/custom', 'tests/custom'],
        files: {
          'src/custom/index.ts': '// Custom exports',
        },
        patterns: {
          domain: 'src/custom/domain',
          application: 'src/custom/application',
          infrastructure: 'src/custom/infrastructure',
        },
      };

      const [error] = safeRun(() => manager.registerStructure(customStructure));

      expect(error).toBeUndefined();

      const retrievedStructure = manager.getStructure('custom-arch' as any);
      expect(retrievedStructure.description).toBe('Custom architecture pattern');
    });
  });

  describe('structure detection', () => {
    it('should detect clean architecture', async () => {
      vi.mocked(FileSystem.exists).mockImplementation((path: string) => {
        return (
          path.includes('domain') || path.includes('application') || path.includes('infrastructure')
        );
      });

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBe('clean-architecture');
    });

    it('should detect hexagonal architecture', async () => {
      vi.mocked(FileSystem.exists).mockImplementation((path: string) => {
        return path.includes('core') || path.includes('adapters');
      });

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBe('hexagonal');
    });

    it('should detect onion architecture', async () => {
      vi.mocked(FileSystem.exists).mockImplementation((path: string) => {
        return path.includes('core/domain') || path.includes('core/application');
      });

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBe('onion');
    });

    it('should detect modular monolith', async () => {
      vi.mocked(FileSystem.exists).mockImplementation((path: string) => {
        return path.includes('modules');
      });

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBe('modular-monolith');
    });

    it('should detect microservices', async () => {
      vi.mocked(FileSystem.exists).mockImplementation((path: string) => {
        return path.includes('services');
      });

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBe('microservices');
    });

    it('should return null when no structure is detected', async () => {
      vi.mocked(FileSystem.exists).mockResolvedValue(false);

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBeNull();
    });

    it('should handle detection errors gracefully', async () => {
      vi.mocked(FileSystem.exists).mockRejectedValue(new Error('File system error'));

      const [error, detectedStructure] = await safeRun(
        async () => await manager.detectStructure('/project')
      );

      expect(error).toBeUndefined();
      expect(detectedStructure).toBeNull();
    });
  });

  describe('structure creation', () => {
    it('should create clean architecture structure', async () => {
      const [error] = await safeRun(
        async () => await manager.createStructure('clean-architecture', '/project')
      );

      expect(error).toBeUndefined();
      expect(FileSystem.createDirectory).toHaveBeenCalled();
      expect(FileSystem.writeFile).toHaveBeenCalled();
    });

    it('should create hexagonal architecture structure', async () => {
      const [error] = await safeRun(
        async () => await manager.createStructure('hexagonal', '/project')
      );

      expect(error).toBeUndefined();
      expect(FileSystem.createDirectory).toHaveBeenCalledTimes(10); // Number of directories
      expect(FileSystem.writeFile).toHaveBeenCalledTimes(2); // Number of files
    });

    it('should handle structure creation errors', async () => {
      vi.mocked(FileSystem.createDirectory).mockRejectedValue(
        new Error('Directory creation failed')
      );

      const [createError] = await safeRun(
        async () => await manager.createStructure('clean-architecture', '/project')
      );

      expect(createError).toBeInstanceOf(CLIError);
      expect(createError?.message).toContain('Failed to create clean-architecture structure');
    });
  });

  describe('component path generation', () => {
    it('should generate path for domain aggregate', () => {
      const path = manager.getComponentPath('clean-architecture', 'domain', 'OrderAggregate');

      expect(path).toBe('src/domain/aggregates');
    });

    it('should generate path for domain entity', () => {
      const path = manager.getComponentPath('clean-architecture', 'domain', 'OrderEntity');

      expect(path).toBe('src/domain/entities');
    });

    it('should generate path for value object', () => {
      const path = manager.getComponentPath('clean-architecture', 'domain', 'MoneyValueObject');

      expect(path).toBe('src/domain/value-objects');
    });

    it('should generate path for application command', () => {
      const path = manager.getComponentPath(
        'clean-architecture',
        'application',
        'CreateOrderCommand'
      );

      expect(path).toBe('src/application/commands');
    });

    it('should generate path for application query', () => {
      const path = manager.getComponentPath('clean-architecture', 'application', 'GetOrderQuery');

      expect(path).toBe('src/application/queries');
    });

    it('should generate path for infrastructure repository', () => {
      const path = manager.getComponentPath(
        'clean-architecture',
        'infrastructure',
        'OrderRepository'
      );

      expect(path).toBe('src/infrastructure/repositories');
    });

    it('should handle modular monolith with module name', () => {
      const path = manager.getComponentPath(
        'modular-monolith',
        'domain',
        'OrderAggregate',
        'orders'
      );

      expect(path).toBe('src/modules/orders/domain/aggregates');
    });

    it('should handle microservices with service name', () => {
      const path = manager.getComponentPath('microservices', 'domain', 'OrderAggregate', 'order');

      expect(path).toBe('services/order-service/src/domain/aggregates');
    });

    it('should throw error for unsupported component type', () => {
      const [pathError] = safeRun(() =>
        manager.getComponentPath('hexagonal', 'presentation' as any, 'OrderController')
      );

      expect(pathError).toBeInstanceOf(CLIError);
      expect(pathError?.message).toContain('Component type presentation not supported');
    });
  });

  describe('structure validation', () => {
    it('should validate correct structure config', () => {
      const validConfig: StructureConfig = {
        name: 'test-structure' as any,
        description: 'Test structure',
        directories: ['src/test'],
        files: { 'src/test/index.ts': '// Test' },
        patterns: {
          domain: 'src/test/domain',
          application: 'src/test/application',
          infrastructure: 'src/test/infrastructure',
        },
      };

      const isValid = manager.validateStructure(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject structure config missing required fields', () => {
      const invalidConfig = {
        name: 'test-structure',
        // Missing description and other required fields
      } as any;

      const isValid = manager.validateStructure(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject structure config with invalid patterns', () => {
      const invalidConfig: StructureConfig = {
        name: 'test-structure' as any,
        description: 'Test structure',
        directories: ['src/test'],
        files: {},
        patterns: {
          domain: 'src/test/domain',
          // Missing application and infrastructure
        } as any,
      };

      const isValid = manager.validateStructure(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject structure config with empty directories', () => {
      const invalidConfig: StructureConfig = {
        name: 'test-structure' as any,
        description: 'Test structure',
        directories: [], // Empty array
        files: {},
        patterns: {
          domain: 'src/test/domain',
          application: 'src/test/application',
          infrastructure: 'src/test/infrastructure',
        },
      };

      const isValid = manager.validateStructure(invalidConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('documentation generation', () => {
    it('should generate structure documentation', () => {
      const documentation = manager.generateDocumentation('clean-architecture');

      expect(documentation).toContain('# clean-architecture Architecture');
      expect(documentation).toContain('Clean Architecture with dependency inversion');
      expect(documentation).toContain('## Directory Structure');
      expect(documentation).toContain('## Layer Patterns');
      expect(documentation).toContain('src/domain');
      expect(documentation).toContain('src/application');
      expect(documentation).toContain('src/infrastructure');
    });

    it('should generate documentation for all structure types', () => {
      const structures = [
        'clean-architecture',
        'hexagonal',
        'onion',
        'modular-monolith',
        'microservices',
      ];

      structures.forEach(structure => {
        const documentation = manager.generateDocumentation(structure as any);
        expect(documentation).toContain(`# ${structure} Architecture`);
        expect(documentation).toContain('## Directory Structure');
        expect(documentation).toContain('## Layer Patterns');
      });
    });
  });

  describe('built-in structures', () => {
    it('should have clean architecture configuration', () => {
      const structure = manager.getStructure('clean-architecture');

      expect(structure.name).toBe('clean-architecture');
      expect(structure.directories).toContain('src/domain/entities');
      expect(structure.directories).toContain('src/application/commands');
      expect(structure.directories).toContain('src/infrastructure/repositories');
      expect(structure.patterns.domain).toBe('src/domain');
    });

    it('should have hexagonal architecture configuration', () => {
      const structure = manager.getStructure('hexagonal');

      expect(structure.name).toBe('hexagonal');
      expect(structure.directories).toContain('src/core/domain');
      expect(structure.directories).toContain('src/adapters/primary/web');
      expect(structure.directories).toContain('src/adapters/secondary/persistence');
      expect(structure.patterns.domain).toBe('src/core/domain');
    });

    it('should have onion architecture configuration', () => {
      const structure = manager.getStructure('onion');

      expect(structure.name).toBe('onion');
      expect(structure.directories).toContain('src/core/domain/model');
      expect(structure.directories).toContain('src/core/application/services');
      expect(structure.patterns.domain).toBe('src/core/domain');
    });

    it('should have modular monolith configuration', () => {
      const structure = manager.getStructure('modular-monolith');

      expect(structure.name).toBe('modular-monolith');
      expect(structure.directories).toContain('src/modules/orders/domain');
      expect(structure.directories).toContain('src/shared/domain');
      expect(structure.patterns.domain).toBe('src/modules/*/domain');
    });

    it('should have microservices configuration', () => {
      const structure = manager.getStructure('microservices');

      expect(structure.name).toBe('microservices');
      expect(structure.directories).toContain('services/order-service/src/domain');
      expect(structure.directories).toContain('shared/contracts');
      expect(structure.patterns.domain).toBe('services/*/src/domain');
    });
  });
});
