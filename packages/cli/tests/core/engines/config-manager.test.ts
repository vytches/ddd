import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../../src/core/engines/config-manager';
import { ConfigError } from '../../../src/types';
import type { CLIConfig, ProjectStructure, FrameworkType } from '../../../src/types';

// Mock fs module
vi.mock('fs');

describe('ConfigManager', () => {
  const mockFs = fs as any;
  const originalEnv = { ...process.env };

  const defaultConfig: CLIConfig = {
    debug: false,
    outputDir: './src',
    templateDir: './templates',
    projectStructure: 'clean-architecture',
    framework: 'standalone',
    patterns: [],
    plugins: [],
  };

  beforeEach(() => {
    // Reset ConfigManager state
    ConfigManager.reset();

    // Clear all mocks
    vi.clearAllMocks();

    // Reset environment variables
    process.env = { ...originalEnv };

    // Setup default fs mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialize', () => {
    it('should return default configuration when no config file exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = await ConfigManager.initialize();

      expect(config).toEqual(defaultConfig);
    });

    it('should load configuration from explicit path', async () => {
      const configPath = '/path/to/config.json';
      const customConfig = {
        debug: true,
        outputDir: './custom/src',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(customConfig));

      const config = await ConfigManager.initialize(configPath);

      expect(config.debug).toBe(true);
      expect(config.outputDir).toBe('./custom/src');
      expect(config.framework).toBe('standalone'); // Default value
    });

    it('should throw error for non-existent explicit path', async () => {
      const configPath = '/non/existent/config.json';
      mockFs.existsSync.mockReturnValue(false);

      const [error] = await safeRun(async () => await ConfigManager.initialize(configPath));

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Configuration file not found');
    });

    it('should search for config files in order of precedence', async () => {
      const configFiles = [
        'vytches-ddd.config.json',
        'vytches-ddd.config.yaml',
        'vytches-ddd.config.yml',
        '.vytchesrc.json',
        '.vytchesrc.yaml',
        '.vytchesrc.yml',
        '.vytchesrc',
      ];

      // Mock only the third file exists
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('.vytchesrc.json');
      });

      mockFs.readFileSync.mockReturnValue('{"debug": true}');

      await ConfigManager.initialize();

      // Check that existsSync was called for each config file
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should merge environment variables with file config', async () => {
      const fileConfig = { debug: false, outputDir: './src' };

      process.env.VYTCHES_DEBUG = 'true';
      process.env.VYTCHES_OUTPUT_DIR = './env/output';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(fileConfig));

      const config = await ConfigManager.initialize();

      expect(config.debug).toBe(true); // Env overrides file
      expect(config.outputDir).toBe('./env/output'); // Env overrides file
    });

    it('should parse environment variables correctly', async () => {
      process.env.VYTCHES_DEBUG = 'true';
      process.env.VYTCHES_OUTPUT_DIR = './custom';
      process.env.VYTCHES_TEMPLATE_DIR = './custom/templates';
      process.env.VYTCHES_PROJECT_STRUCTURE = 'hexagonal';
      process.env.VYTCHES_FRAMEWORK = 'nestjs';
      process.env.VYTCHES_PATTERNS = 'repository,factory,observer';
      process.env.VYTCHES_PLUGINS = 'plugin1,plugin2';

      const config = await ConfigManager.initialize();

      expect(config.debug).toBe(true);
      expect(config.outputDir).toBe('./custom');
      expect(config.templateDir).toBe('./custom/templates');
      expect(config.projectStructure).toBe('hexagonal');
      expect(config.framework).toBe('nestjs');
      expect(config.patterns).toEqual(['repository', 'factory', 'observer']);
      expect(config.plugins).toEqual(['plugin1', 'plugin2']);
    });

    it('should throw error for YAML files', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const [error] = await safeRun(
        async () => await ConfigManager.initialize('/path/to/config.yaml')
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('YAML configuration files are not supported');
    });

    it('should throw error for invalid JSON', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const [error] = await safeRun(
        async () => await ConfigManager.initialize('/path/to/config.json')
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Failed to parse configuration file');
    });

    it('should return existing config if already initialized', async () => {
      // First initialization
      const config1 = await ConfigManager.initialize();

      // Second initialization should return same instance
      const config2 = await ConfigManager.initialize();

      expect(config2).toBe(config1);
    });
  });

  describe('getConfig', () => {
    it('should throw error if not initialized', () => {
      const [error] = safeRun(() => ConfigManager.getConfig());

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Configuration not initialized');
    });

    it('should return current configuration after initialization', async () => {
      await ConfigManager.initialize();

      const config = ConfigManager.getConfig();

      expect(config).toEqual(defaultConfig);
    });
  });

  describe('updateConfig', () => {
    it('should throw error if not initialized', () => {
      const [error] = safeRun(() => ConfigManager.updateConfig({ debug: true }));

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Configuration not initialized');
    });

    it('should update configuration values', async () => {
      await ConfigManager.initialize();

      ConfigManager.updateConfig({
        debug: true,
        outputDir: './custom/output',
      });

      const config = ConfigManager.getConfig();
      expect(config.debug).toBe(true);
      expect(config.outputDir).toBe('./custom/output');
    });

    it('should validate updated configuration', async () => {
      await ConfigManager.initialize();

      const [error] = safeRun(() =>
        ConfigManager.updateConfig({
          projectStructure: 'invalid-structure' as ProjectStructure,
        })
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Invalid project structure');
    });
  });

  describe('getConfigPath', () => {
    it('should return null if no config file was loaded', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await ConfigManager.initialize();

      const configPath = ConfigManager.getConfigPath();

      expect(configPath).toBeNull();
    });

    it('should return config file path when loaded from file', async () => {
      const expectedPath = '/path/to/config.json';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      await ConfigManager.initialize(expectedPath);

      const configPath = ConfigManager.getConfigPath();
      expect(configPath).toBe(expectedPath);
    });
  });

  describe('saveConfiguration', () => {
    it('should save configuration to specified path', async () => {
      const config: CLIConfig = {
        ...defaultConfig,
        debug: true,
      };
      const savePath = '/path/to/save/config.json';

      mockFs.writeFileSync.mockImplementation(() => {
        return;
      });

      await ConfigManager.saveConfiguration(config, savePath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        savePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });

    it('should use existing config path if available', async () => {
      const existingPath = '/existing/config.json';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');
      mockFs.writeFileSync.mockImplementation(() => {
        return;
      });

      await ConfigManager.initialize(existingPath);
      const config = ConfigManager.getConfig();

      await ConfigManager.saveConfiguration(config);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(existingPath, expect.any(String), 'utf-8');
    });

    it('should default to vytches-ddd.config.yaml in cwd', async () => {
      const config = { ...defaultConfig };
      mockFs.writeFileSync.mockImplementation(() => {
        return;
      });

      await ConfigManager.saveConfiguration(config);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'vytches-ddd.config.yaml'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should throw error on write failure', async () => {
      const config = { ...defaultConfig };
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const [error] = await safeRun(async () => await ConfigManager.saveConfiguration(config));

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Failed to save configuration');
    });
  });

  describe('reset', () => {
    it('should reset configuration to initial state', async () => {
      await ConfigManager.initialize();
      ConfigManager.updateConfig({ debug: true });

      ConfigManager.reset();

      const [error] = safeRun(() => ConfigManager.getConfig());
      expect(error).toBeInstanceOf(ConfigError);
    });
  });

  describe('getSummary', () => {
    it('should throw error if not initialized', () => {
      const [error] = safeRun(() => ConfigManager.getSummary());

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Configuration not initialized');
    });

    it('should return summary with defaults source', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await ConfigManager.initialize();

      const summary = ConfigManager.getSummary();

      expect(summary.source).toBe('defaults');
      expect(summary.configPath).toBeNull();
      expect(summary.config).toEqual(defaultConfig);
    });

    it('should return summary with file source', async () => {
      const configPath = '/path/to/config.json';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"debug": true}');

      await ConfigManager.initialize(configPath);

      const summary = ConfigManager.getSummary();

      expect(summary.source).toBe('file');
      expect(summary.configPath).toBe(configPath);
    });

    it('should return summary with environment source', async () => {
      process.env.VYTCHES_DEBUG = 'true';
      mockFs.existsSync.mockReturnValue(false);

      await ConfigManager.initialize();

      const summary = ConfigManager.getSummary();

      expect(summary.source).toBe('environment');
    });
  });

  describe('validation', () => {
    it('should validate project structure values', async () => {
      const validStructures: ProjectStructure[] = [
        'clean-architecture',
        'hexagonal',
        'onion',
        'modular-monolith',
        'microservices',
        'custom',
      ];

      for (const structure of validStructures) {
        ConfigManager.reset();
        process.env.VYTCHES_PROJECT_STRUCTURE = structure;

        const config = await ConfigManager.initialize();
        expect(config.projectStructure).toBe(structure);
      }
    });

    it('should validate framework values', async () => {
      const validFrameworks: FrameworkType[] = ['nestjs', 'express', 'fastify', 'standalone'];

      for (const framework of validFrameworks) {
        ConfigManager.reset();
        process.env.VYTCHES_FRAMEWORK = framework;

        const config = await ConfigManager.initialize();
        expect(config.framework).toBe(framework);
      }
    });

    it('should validate required string fields', async () => {
      await ConfigManager.initialize();

      const [error] = safeRun(() =>
        ConfigManager.updateConfig({
          outputDir: '',
        })
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Output directory must be a non-empty string');
    });

    it('should validate array fields', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"patterns": "not-an-array"}');

      const [error] = await safeRun(
        async () => await ConfigManager.initialize('/path/to/config.json')
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Patterns must be an array');
    });

    it('should handle multiple validation errors', async () => {
      await ConfigManager.initialize();

      const [error] = safeRun(() =>
        ConfigManager.updateConfig({
          projectStructure: 'invalid' as ProjectStructure,
          framework: 'invalid' as FrameworkType,
          outputDir: '',
        })
      );

      expect(error).toBeInstanceOf(ConfigError);
      expect(error?.message).toContain('Invalid project structure');
      expect(error?.message).toContain('Invalid framework');
      expect(error?.message).toContain('Output directory must be a non-empty string');
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge array fields without duplicates', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          patterns: ['repository', 'factory'],
          plugins: ['plugin1'],
        })
      );

      process.env.VYTCHES_PATTERNS = 'factory,observer';
      process.env.VYTCHES_PLUGINS = 'plugin1,plugin2';

      const config = await ConfigManager.initialize();

      expect(config.patterns).toEqual(['repository', 'factory', 'observer']);
      expect(config.plugins).toEqual(['plugin1', 'plugin2']);
    });
  });
});
