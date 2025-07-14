/**
 * @fileoverview Config Manager - Multi-environment configuration with inheritance
 * Enterprise-grade configuration management with YAML/JSON support
 */

import * as fs from 'fs';
import * as path from 'path';
// import { load, dump } from 'js-yaml'; // Temporarily disabled for testing
import type { CLIConfig, ProjectStructure, FrameworkType } from '../../types';
import { ConfigError } from '../../types';

/**
 * Configuration file names in order of precedence
 */
const CONFIG_FILES = [
  'vytches-ddd.config.json',
  'vytches-ddd.config.yaml',
  'vytches-ddd.config.yml',
  '.vytchesrc.json',
  '.vytchesrc.yaml',
  '.vytchesrc.yml',
  '.vytchesrc',
] as const;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
  debug: false,
  outputDir: './src',
  templateDir: './templates',
  projectStructure: 'clean-architecture',
  framework: 'standalone',
  patterns: [],
  plugins: [],
};

/**
 * Configuration manager with multi-environment support and inheritance
 */
export class ConfigManager {
  private static config: CLIConfig | null = null;
  private static configPath: string | null = null;
  private static actualSource: 'file' | 'environment' | 'defaults' = 'defaults';

  /**
   * Initialize configuration from files, environment, and defaults
   */
  static async initialize(configPath?: string): Promise<CLIConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Load base configuration
      const baseConfig = await this.loadConfiguration(configPath);

      // Apply environment variables
      const envConfig = this.loadEnvironmentConfig();

      // Determine actual source for tracking
      if (Object.keys(envConfig).length > 0) {
        this.actualSource = 'environment';
      } else if (Object.keys(baseConfig).length > 0) {
        this.actualSource = 'file';
      } else {
        this.actualSource = 'defaults';
      }

      // Merge configurations (env variables override file config)
      this.config = this.mergeConfigurations(DEFAULT_CONFIG, baseConfig, envConfig);

      // Validate configuration
      this.validateConfiguration(this.config);

      return this.config;

    } catch (error) {
      throw new ConfigError(`Failed to initialize configuration: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): CLIConfig {
    if (!this.config) {
      throw new ConfigError('Configuration not initialized. Call ConfigManager.initialize() first.');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<CLIConfig>): void {
    if (!this.config) {
      throw new ConfigError('Configuration not initialized.');
    }

    this.config = { ...this.config, ...updates };
    this.validateConfiguration(this.config);
  }

  /**
   * Get configuration file path
   */
  static getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Load configuration from file
   */
  private static async loadConfiguration(explicitPath?: string): Promise<Partial<CLIConfig>> {
    let configPath: string | undefined;

    if (explicitPath) {
      // Use explicitly provided path
      if (!fs.existsSync(explicitPath)) {
        throw new ConfigError(`Configuration file not found: ${explicitPath}`);
      }
      configPath = explicitPath;
    } else {
      // Search for configuration files
      configPath = this.findConfigFile();
    }

    if (!configPath) {
      // No configuration file found, use defaults
      return {};
    }

    this.configPath = configPath;

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const ext = path.extname(configPath).toLowerCase();

      if (ext === '.json' || configPath.endsWith('.vytchesrc')) {
        return JSON.parse(content);
      } else if (ext === '.yaml' || ext === '.yml') {
        throw new ConfigError('YAML configuration files are not supported yet. Please use JSON format.');
      }

      throw new ConfigError(`Unsupported configuration file format: ${ext}`);

    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(`Failed to parse configuration file ${configPath}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Find configuration file in current and parent directories
   */
  private static findConfigFile(): string | undefined {
    let currentDir = process.cwd();
    const rootDir = path.parse(currentDir).root;

    while (currentDir !== rootDir) {
      for (const fileName of CONFIG_FILES) {
        const filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }
      currentDir = path.dirname(currentDir);
    }

    return undefined;
  }

  /**
   * Load configuration from environment variables
   */
  private static loadEnvironmentConfig(): Partial<CLIConfig> {
    const config: Partial<CLIConfig> = {};

    // Debug mode
    if (process.env.VYTCHES_DEBUG) {
      config.debug = process.env.VYTCHES_DEBUG === 'true';
    }

    // Output directory
    if (process.env.VYTCHES_OUTPUT_DIR) {
      config.outputDir = process.env.VYTCHES_OUTPUT_DIR;
    }

    // Template directory
    if (process.env.VYTCHES_TEMPLATE_DIR) {
      config.templateDir = process.env.VYTCHES_TEMPLATE_DIR;
    }

    // Project structure
    if (process.env.VYTCHES_PROJECT_STRUCTURE) {
      config.projectStructure = process.env.VYTCHES_PROJECT_STRUCTURE as ProjectStructure;
    }

    // Framework
    if (process.env.VYTCHES_FRAMEWORK) {
      config.framework = process.env.VYTCHES_FRAMEWORK as FrameworkType;
    }

    // Patterns (comma-separated)
    if (process.env.VYTCHES_PATTERNS) {
      config.patterns = process.env.VYTCHES_PATTERNS.split(',').map(p => p.trim());
    }

    // Plugins (comma-separated)
    if (process.env.VYTCHES_PLUGINS) {
      config.plugins = process.env.VYTCHES_PLUGINS.split(',').map(p => p.trim());
    }

    return config;
  }

  /**
   * Merge multiple configuration objects
   */
  private static mergeConfigurations(...configs: Partial<CLIConfig>[]): CLIConfig {
    const merged = {} as CLIConfig;

    for (const config of configs) {
      // Merge non-array properties normally
      for (const [key, value] of Object.entries(config)) {
        if (key === 'patterns' || key === 'plugins') {
          // Handle arrays specially
          if (Array.isArray(value)) {
            const currentArray = merged[key] || [];
            merged[key] = [...new Set([...currentArray, ...value])];
          } else {
            // Non-array value - just assign it (validation will catch invalid types later)
            (merged as Record<string, any>)[key] = value;
          }
        } else {
          // Regular property assignment
          (merged as Record<string, any>)[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Validate configuration
   */
  private static validateConfiguration(config: CLIConfig): void {
    const errors: string[] = [];

    // Validate project structure
    const validStructures: ProjectStructure[] = [
      'clean-architecture', 'hexagonal', 'onion', 'modular-monolith', 'microservices', 'custom'
    ];
    if (!validStructures.includes(config.projectStructure)) {
      errors.push(`Invalid project structure: ${config.projectStructure}. Must be one of: ${validStructures.join(', ')}`);
    }

    // Validate framework
    const validFrameworks: FrameworkType[] = ['nestjs', 'express', 'fastify', 'standalone'];
    if (!validFrameworks.includes(config.framework)) {
      errors.push(`Invalid framework: ${config.framework}. Must be one of: ${validFrameworks.join(', ')}`);
    }

    // Validate output directory
    if (!config.outputDir || typeof config.outputDir !== 'string') {
      errors.push('Output directory must be a non-empty string');
    }

    // Validate template directory
    if (!config.templateDir || typeof config.templateDir !== 'string') {
      errors.push('Template directory must be a non-empty string');
    }

    // Validate arrays
    if (!Array.isArray(config.patterns)) {
      errors.push('Patterns must be an array');
    }

    if (!Array.isArray(config.plugins)) {
      errors.push('Plugins must be an array');
    }

    if (errors.length > 0) {
      throw new ConfigError(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }
  }

  /**
   * Save configuration to file
   */
  static async saveConfiguration(config: CLIConfig, filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath || path.join(process.cwd(), 'vytches-ddd.config.yaml');

    try {
      const ext = path.extname(targetPath).toLowerCase();
      let content: string;

      if (ext === '.json') {
        content = JSON.stringify(config, null, 2);
      } else {
        // Default to JSON for now
        content = JSON.stringify(config, null, 2);
      }

      fs.writeFileSync(targetPath, content, 'utf-8');
      this.configPath = targetPath;

    } catch (error) {
      throw new ConfigError(`Failed to save configuration to ${targetPath}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  static reset(): void {
    this.config = null;
    this.configPath = null;
    this.actualSource = 'defaults';
  }

  /**
   * Get configuration summary for debugging
   */
  static getSummary(): {
    configPath: string | null;
    config: CLIConfig;
    source: 'file' | 'environment' | 'defaults';
  } {
    if (!this.config) {
      throw new ConfigError('Configuration not initialized.');
    }

    return {
      configPath: this.configPath,
      config: this.config,
      source: this.actualSource
    };
  }
}
