import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import * as fs from 'fs/promises';
import { PackageConfigLoader } from '../../src/core/package-config-loader';

// Mock fs/promises module
vi.mock('fs/promises');

describe('PackageConfigLoader', () => {
  let loader: any;
  const mockFs = fs as any;

  const validConfig = {
    packageName: 'test-package',
    displayName: 'Test Package',
    description: 'Test package description',
    complexityLevels: {
      basic: {
        level: 'basic',
        description: 'Basic examples',
        examples: ['example1']
      },
      intermediate: {
        level: 'intermediate',
        description: 'Intermediate examples',
        examples: ['example2']
      }
    },
    tags: {
      core: ['test-package:core', 'test-package:feature'],
      patterns: ['pattern1'],
      integration: []
    },
    sections: [
      {
        title: 'Getting Started',
        complexities: ['basic'],
        description: 'Introduction'
      }
    ]
  };

  beforeEach(() => {
    loader = new PackageConfigLoader();
    vi.clearAllMocks();

    // Default mock for fs.access - simulate packages directory exists
    (mockFs.access as any).mockImplementation(async (filePath: any) => {
      if (filePath.includes('packages')) {
        return Promise.resolve();
      }
      throw new Error('Not found');
    });
  });

  describe('loadPackageConfig', () => {
    it('should throw error if config file does not exist', async () => {
      const packageName = 'non-existent-package';

      (mockFs.access as any).mockImplementation(async (filePath: any) => {
        if (filePath.includes(packageName)) {
          throw new Error('File not found');
        }
        return Promise.resolve();
      });

      const [error] = await safeRun(async () =>
        loader.loadPackageConfig(packageName)
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Failed to load package config');
    });

    it('should find root directory by traversing up', async () => {
      let accessCallCount = 0;
      (mockFs.access as any).mockImplementation(async (filePath: any) => {
        accessCallCount++;
        // Simulate packages directory is 2 levels up
        if (accessCallCount > 2 && filePath.includes('packages')) {
          return Promise.resolve();
        }
        throw new Error('Not found');
      });

      const packageName = 'test-package';

      const [error] = await safeRun(async () =>
        loader.loadPackageConfig(packageName)
      );

      // Will fail but should have attempted traversal
      expect(accessCallCount).toBeGreaterThan(2);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('validateConfig', () => {
    it('should validate required fields', async () => {
      const packageName = 'test-package';

      // Test the validation method directly since dynamic imports are complex to mock
      const testCases = [
        { config: { ...validConfig, packageName: undefined }, expectedError: 'missing packageName' },
        { config: { ...validConfig, displayName: undefined }, expectedError: 'missing displayName' },
        { config: { ...validConfig, complexityLevels: undefined }, expectedError: 'missing complexityLevels' },
        { config: { ...validConfig, tags: undefined }, expectedError: 'missing core tags' },
        { config: { ...validConfig, tags: { ...validConfig.tags, core: undefined } }, expectedError: 'missing core tags' },
        { config: { ...validConfig, sections: undefined }, expectedError: 'missing sections' }
      ];

      for (const testCase of testCases) {
        const [error] = safeRun(() => {
          // Access the private validation method via bracket notation
          loader['validateConfig'](testCase.config, packageName);
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain(testCase.expectedError);
      }
    });

    it('should validate complexity levels', () => {
      const packageName = 'test-package';

      const invalidConfig = {
        ...validConfig,
        complexityLevels: {
          basic: {
            level: 'invalid-level',
            description: 'Basic examples',
            examples: []
          }
        }
      };

      const [error] = safeRun(() => {
        loader['validateConfig'](invalidConfig, packageName);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Invalid complexity level');
    });

    it('should validate core tags format', () => {
      const packageName = 'test-package';

      const invalidConfig = {
        ...validConfig,
        tags: {
          ...validConfig.tags,
          core: ['wrong-prefix:tag']
        }
      };

      const [error] = safeRun(() => {
        loader['validateConfig'](invalidConfig, packageName);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Core tag must start with package name');
    });
  });

  describe('getAvailablePackages', () => {
    it('should return list of packages with examples config', async () => {
      const mockPackages = [
        { name: 'package1', isDirectory: () => true },
        { name: 'package2', isDirectory: () => true },
        { name: 'package3', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ];

      (mockFs.readdir as any).mockResolvedValue(mockPackages);

      // Mock access to simulate package2 doesn't have examples config
      (mockFs.access as any).mockImplementation(async (filePath: any) => {
        if (filePath.includes('package2') && filePath.includes('config.ts')) {
          throw new Error('Not found');
        }
        return Promise.resolve();
      });

      const packages = await loader.getAvailablePackages();

      expect(packages).toEqual(['package1', 'package3']);
      expect(mockFs.readdir).toHaveBeenCalled();
    });

    it('should return empty array if no packages found', async () => {
      (mockFs.readdir as any).mockResolvedValue([]);

      const packages = await loader.getAvailablePackages();

      expect(packages).toEqual([]);
    });

    it('should throw error if packages directory cannot be read', async () => {
      (mockFs.readdir as any).mockRejectedValue(new Error('Permission denied'));

      const [error] = await safeRun(async () =>
        await loader.getAvailablePackages()
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Failed to read packages directory');
    });

    it('should handle reaching filesystem root', async () => {
      // Mock access to always fail (no packages directory found)
      (mockFs.access as any).mockRejectedValue(new Error('Not found'));
      (mockFs.readdir as any).mockResolvedValue([]);

      const packages = await loader.getAvailablePackages();

      expect(packages).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear cached configurations', () => {
      // Test cache functionality without dynamic imports
      const packageName = 'test-package';
      
      // Manually set cache entry
      loader['configCache'].set(packageName, validConfig);
      
      // Verify cache has entry
      expect(loader['configCache'].has(packageName)).toBe(true);
      expect(loader['configCache'].get(packageName)).toEqual(validConfig);

      // Clear cache
      loader.clearCache();

      // Verify cache is cleared
      expect(loader['configCache'].has(packageName)).toBe(false);
      expect(loader['configCache'].size).toBe(0);
    });
  });
});
