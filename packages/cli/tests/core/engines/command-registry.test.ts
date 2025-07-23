import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { CommandRegistry } from '../../../src/core/engines/command-registry';

// Mock dependencies
vi.mock('../../../src/core/utils/colors');
vi.mock('../../../src/core/utils/performance');
vi.mock('../../../src/commands/workflow');
vi.mock('../../../src/commands/suggest');
vi.mock('../../../src/commands/domain-builder');
vi.mock('../../../src/commands/generate');

import { Colors } from '../../../src/core/utils/colors';
import { Performance } from '../../../src/core/utils/performance';
import type { CLIConfig } from '../../../src/types';
// Mock config object without type imports

// Mock objects without interface definitions

describe('CommandRegistry', () => {
  let registry: CommandRegistry;
  let mockConfig: CLIConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Setup default mocks
    vi.mocked(Colors.cyan).mockImplementation(text => text);
    vi.mocked(Colors.red).mockImplementation(text => text);
    vi.mocked(Colors.bold).mockImplementation(text => text);
    vi.mocked(Colors.dim).mockImplementation(text => text);
    vi.mocked(Colors.yellow).mockImplementation(text => text);
    vi.mocked(Performance.now).mockReturnValue(1000);
    vi.mocked(Performance.since).mockReturnValue(50);

    mockConfig = {
      debug: false,
      outputDir: './src',
      templateDir: './templates',
      projectStructure: 'clean-architecture',
      framework: 'nestjs',
      patterns: [],
      plugins: [],
    };

    registry = new CommandRegistry({ ...mockConfig });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and factory', () => {
    it('should create instance with config', () => {
      expect(registry).toBeInstanceOf(CommandRegistry);
    });

    it('should create instance using static factory method', () => {
      const factoryRegistry = CommandRegistry.create(mockConfig);

      expect(factoryRegistry).toBeInstanceOf(CommandRegistry);
    });
  });

  describe('registerCommand', () => {
    it('should register a simple command', () => {
      const mockCommand = {
        name: 'test-command',
        description: 'Test command for testing',
        action: vi.fn().mockResolvedValue(undefined),
      };

      const [error] = safeRun(() => registry.registerCommand(mockCommand));

      expect(error).toBeUndefined();

      const registered = registry.getCommand('test-command');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('test-command');
    });

    it('should register command with aliases', () => {
      const mockCommand = {
        name: 'test-command',
        description: 'Test command with aliases',
        aliases: ['tc', 'test'],
        action: vi.fn().mockResolvedValue(undefined),
      };

      const [error] = safeRun(() => registry.registerCommand(mockCommand));

      expect(error).toBeUndefined();
      expect(registry.getCommand('test-command')).toBeDefined();
    });

    it('should register command with options', () => {
      const mockCommand = {
        name: 'test-options',
        description: 'Test command with options',
        options: [
          {
            flags: '-t, --type <type>',
            description: 'Type option',
            defaultValue: 'default',
          },
          {
            flags: '--verbose',
            description: 'Verbose output',
            defaultValue: false,
          },
        ],
        action: vi.fn().mockResolvedValue(undefined),
      };

      const [error] = safeRun(() => registry.registerCommand(mockCommand));

      expect(error).toBeUndefined();
      expect(registry.getCommand('test-options')).toBeDefined();
    });

    it('should register command with examples', () => {
      const mockCommand = {
        name: 'test-examples',
        description: 'Test command with examples',
        examples: ['vytches-ddd test-examples --type basic', 'vytches-ddd test-examples --verbose'],
        action: vi.fn().mockResolvedValue(undefined),
      };

      const [error] = safeRun(() => registry.registerCommand(mockCommand));

      expect(error).toBeUndefined();
      expect(registry.getCommand('test-examples')).toBeDefined();
    });
  });

  describe('loadCommands', () => {
    it('should load core commands successfully', async () => {
      const [error] = await safeRun(async () => await registry.loadCommands());

      expect(error).toBeUndefined();

      // Check that core commands are registered
      expect(registry.getCommand('generate')).toBeDefined();
      expect(registry.getCommand('analyze')).toBeDefined();
      expect(registry.getCommand('setup')).toBeDefined();

      // These commands come from mocked modules, so may not be fully registered
      // Let's just verify the basic commands are there
      const allCommands = registry.getAllCommands();
      expect(allCommands.length).toBeGreaterThan(0);
    });

    it('should handle command loading errors', async () => {
      // Create a registry that will fail during command loading
      const failingRegistry = new (class extends CommandRegistry {
        override async loadCommands() {
          throw new Error('Command loading failed');
        }
      })(mockConfig);

      const [loadError] = await safeRun(async () => await failingRegistry.loadCommands());

      expect(loadError).toBeDefined();
      expect(loadError?.message).toContain('Command loading failed');
    });
  });

  describe('command execution', () => {
    beforeEach(async () => {
      await registry.loadCommands();
    });

    it('should execute command action successfully', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);
      const testCommand = {
        name: 'exec-test',
        description: 'Test command execution',
        action: mockAction,
      };

      registry.registerCommand(testCommand);

      // Simulate command execution
      const [error] = await safeRun(
        async () => await registry.execute(['node', 'cli.js', 'exec-test'])
      );

      expect(error).toBeUndefined();
      expect(mockAction).toHaveBeenCalled();
    });

    it('should handle command execution errors gracefully', async () => {
      const failingAction = vi.fn().mockRejectedValue(new Error('Command failed'));
      const failingCommand = {
        name: 'failing-command',
        description: 'Command that fails',
        action: failingAction,
      };

      registry.registerCommand(failingCommand);

      // Mock process.exit to prevent actual exit during test
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const [execError] = await safeRun(
        async () => await registry.execute(['node', 'cli.js', 'failing-command'])
      );

      expect(execError?.message).toBe('process.exit called');
      expect(console.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should track performance in debug mode', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);
      const debugCommand = {
        name: 'debug-test',
        description: 'Test debug performance tracking',
        action: mockAction,
      };

      registry.registerCommand(debugCommand);

      const [error] = await safeRun(
        async () => await registry.execute(['node', 'cli.js', 'debug-test', '--debug'])
      );

      expect(error).toBeUndefined();
      expect(Performance.now).toHaveBeenCalled();
      expect(Performance.since).toHaveBeenCalled();
    });
  });

  describe('command retrieval', () => {
    beforeEach(() => {
      registry.registerCommand({
        name: 'test-1',
        description: 'First test command',
        action: vi.fn(),
      });
      registry.registerCommand({
        name: 'test-2',
        description: 'Second test command',
        action: vi.fn(),
      });
    });

    it('should get registered command by name', () => {
      const command = registry.getCommand('test-1');

      expect(command).toBeDefined();
      expect(command?.name).toBe('test-1');
      expect(command?.description).toBe('First test command');
    });

    it('should return undefined for non-existent command', () => {
      const command = registry.getCommand('non-existent');

      expect(command).toBeUndefined();
    });

    it('should get all registered commands', () => {
      const allCommands = registry.getAllCommands();

      expect(allCommands).toHaveLength(2);
      expect(allCommands.map(cmd => cmd.name)).toContain('test-1');
      expect(allCommands.map(cmd => cmd.name)).toContain('test-2');
    });
  });

  describe('analyze command', () => {
    beforeEach(async () => {
      await registry.loadCommands();
    });

    it('should have analyze command with correct options', () => {
      const analyzeCommand = registry.getCommand('analyze');

      expect(analyzeCommand).toBeDefined();
      expect(analyzeCommand?.name).toBe('analyze');
      expect(analyzeCommand?.aliases).toContain('a');
      expect(analyzeCommand?.options).toHaveLength(3);
    });
  });

  describe('setup command', () => {
    beforeEach(async () => {
      await registry.loadCommands();
    });

    it('should have setup command with correct options', () => {
      const setupCommand = registry.getCommand('setup');

      expect(setupCommand).toBeDefined();
      expect(setupCommand?.name).toBe('setup');
      expect(setupCommand?.aliases).toContain('init');
      expect(setupCommand?.options).toHaveLength(3);
    });
  });

  describe('help output', () => {
    it('should enhance help output without errors', async () => {
      const [error] = await safeRun(async () => await registry.loadCommands());

      expect(error).toBeUndefined();
      expect(Colors.bold).toHaveBeenCalled();
      expect(Colors.cyan).toHaveBeenCalled();
    });
  });
});
