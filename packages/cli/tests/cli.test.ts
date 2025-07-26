import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { main } from '../src/cli';

// Mock dependencies
vi.mock('../src/core/utils/simple-args');
vi.mock('../src/core/engines/config-manager');
vi.mock('../src/core/utils/colors');
vi.mock('../src/core/utils/performance');
vi.mock('../src/commands/generate');
vi.mock('../src/commands/domain-builder');
vi.mock('../src/commands/examples');

import { SimpleArgsParser } from '../src/core/utils/simple-args';
import { ConfigManager } from '../src/core/engines/config-manager';
import { Colors } from '../src/core/utils/colors';
import { Performance } from '../src/core/utils/performance';
import { generateCommand } from '../src/commands/generate';
import { domainBuilderCommand } from '../src/commands/domain-builder';
import { examplesCommand } from '../src/commands/examples';
import type { CLIConfig } from '../src/types';
// Mock config object without type imports

describe('CLI', () => {
  const mockConfig = {
    debug: false,
    outputDir: './src',
    templateDir: './templates',
    projectStructure: 'clean-architecture',
    framework: 'nestjs',
    patterns: [],
    plugins: [],
  };
  const mockParsed = {
    command: '',
    args: [],
    options: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Setup default mocks
    vi.mocked(SimpleArgsParser.parse).mockReturnValue(mockParsed);
    vi.mocked(ConfigManager.initialize).mockResolvedValue(mockConfig as CLIConfig);
    vi.mocked(Performance.now).mockReturnValue(1000);
    vi.mocked(Performance.since).mockReturnValue(50);
    vi.mocked(Colors.yellow).mockImplementation(text => text);
    vi.mocked(Colors.red).mockImplementation(text => text);
    vi.mocked(Colors.dim).mockImplementation(text => text);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('help and version flags', () => {
    it('should show help when --help flag is provided', async () => {
      const parsed = { ...mockParsed, options: { help: true } };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(SimpleArgsParser.showHelp).mockImplementation(() => {
        return;
      });

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(SimpleArgsParser.showHelp).toHaveBeenCalledWith('');
    });

    it('should show help when -h flag is provided', async () => {
      const parsed = { ...mockParsed, options: { h: true } };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(SimpleArgsParser.showHelp).mockImplementation(() => {
        return;
      });

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(SimpleArgsParser.showHelp).toHaveBeenCalledWith('');
    });

    it('should show version when --version flag is provided', async () => {
      const parsed = { ...mockParsed, options: { version: true } };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('🎯 VytchesDDD CLI v0.3.0');
    });

    it('should show version when -v flag is provided', async () => {
      const parsed = { ...mockParsed, options: { v: true } };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith('🎯 VytchesDDD CLI v0.3.0');
    });
  });

  describe('configuration', () => {
    it('should initialize configuration', async () => {
      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(ConfigManager.initialize).toHaveBeenCalled();
    });

    it('should enable debug mode when --debug flag is provided', async () => {
      const config = { debug: false };
      const parsed = { ...mockParsed, options: { debug: true } };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(ConfigManager.initialize).mockResolvedValue(config as CLIConfig);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(config.debug).toBe(true);
    });
  });

  describe('command routing', () => {
    it('should route to generate command', async () => {
      const parsed = {
        command: 'generate',
        args: ['entity'],
        options: { name: 'User' },
      };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(generateCommand.action).mockResolvedValue();

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(generateCommand.action).toHaveBeenCalledWith(['entity'], { name: 'User' });
    });

    it('should route to generate command with "g" alias', async () => {
      const parsed = {
        command: 'g',
        args: ['value-object'],
        options: {},
      };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(generateCommand.action).mockResolvedValue();

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(generateCommand.action).toHaveBeenCalledWith(['value-object'], {});
    });

    it('should route to domain-builder command', async () => {
      const parsed = {
        command: 'domain-builder',
        args: ['user-management'],
        options: {},
      };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(domainBuilderCommand.action).mockResolvedValue();

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(domainBuilderCommand.action).toHaveBeenCalledWith(['user-management'], {});
    });

    it('should route to domain-builder command with "domain" alias', async () => {
      const parsed = {
        command: 'domain',
        args: [],
        options: {},
      };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(domainBuilderCommand.action).mockResolvedValue();

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(domainBuilderCommand.action).toHaveBeenCalledWith([], {});
    });

    it('should route to examples command', async () => {
      const parsed = {
        command: 'examples',
        args: ['list'],
        options: {},
      };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(examplesCommand.action).mockResolvedValue();

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(examplesCommand.action).toHaveBeenCalledWith(['list'], {});
    });
  });

  describe('default behavior', () => {
    it('should show available commands when no command is provided', async () => {
      const parsed = { command: '', args: [], options: {} };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        '🎯 VytchesDDD CLI - Enterprise-Grade Domain Builder'
      );
      expect(console.log).toHaveBeenCalledWith('Available commands:');
      expect(console.log).toHaveBeenCalledWith('  generate, g      Generate DDD components');
      expect(console.log).toHaveBeenCalledWith('  domain           Build complete domains');
      expect(console.log).toHaveBeenCalledWith('  examples         Manage and work with examples');
    });

    it('should show error for unknown command', async () => {
      const parsed = { command: 'unknown', args: [], options: {} };
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);

      const [error] = await safeRun(async () => await main());

      expect(error?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ Unknown command: unknown');
      expect(console.log).toHaveBeenCalledWith('Use --help to see available commands');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('performance tracking', () => {
    it('should track performance when debug is enabled', async () => {
      const config = { debug: true };
      vi.mocked(ConfigManager.initialize).mockResolvedValue(config as CLIConfig);
      vi.mocked(Performance.since).mockReturnValue(42);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(Performance.now).toHaveBeenCalled();
      expect(Performance.since).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('\n⚡ Completed in 42ms');
    });

    it('should not show performance when debug is disabled', async () => {
      const config = { debug: false };
      vi.mocked(ConfigManager.initialize).mockResolvedValue(config as CLIConfig);

      const [error] = await safeRun(async () => await main());

      expect(error).toBeUndefined();
      expect(Performance.now).toHaveBeenCalled();
      expect(Performance.since).toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Completed in'));
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const parseError = new Error('Invalid arguments');
      vi.mocked(SimpleArgsParser.parse).mockImplementation(() => {
        throw parseError;
      });

      const [error] = await safeRun(async () => await main());

      expect(error?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ CLI Error:', 'Invalid arguments');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle configuration initialization errors', async () => {
      const configError = new Error('Config load failed');
      vi.mocked(ConfigManager.initialize).mockRejectedValue(configError);

      const [error] = await safeRun(async () => await main());

      expect(error?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ CLI Error:', 'Config load failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle command execution errors', async () => {
      const parsed = { command: 'generate', args: [], options: {} };
      const commandError = new Error('Generation failed');
      vi.mocked(SimpleArgsParser.parse).mockReturnValue(parsed);
      vi.mocked(generateCommand.action).mockRejectedValue(commandError);

      const [error] = await safeRun(async () => await main());

      expect(error?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ CLI Error:', 'Generation failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      vi.mocked(SimpleArgsParser.parse).mockImplementation(() => {
        throw 'String error';
      });

      const [error] = await safeRun(async () => await main());

      expect(error?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalledWith('❌ CLI Error:', 'String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
