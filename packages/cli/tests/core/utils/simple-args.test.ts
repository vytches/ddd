import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { SimpleArgsParser } from '../../../src/core/utils/simple-args';

describe('SimpleArgsParser', () => {
  describe('parse', () => {
    describe('basic parsing', () => {
      it('should handle empty arguments', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: {},
        });
      });

      it('should parse single command', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', 'generate']);
        expect(result).toEqual({
          command: 'generate',
          args: [],
          options: {},
        });
      });

      it('should parse command with positional arguments', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', 'generate', 'arg1', 'arg2']);
        expect(result).toEqual({
          command: 'generate',
          args: ['arg1', 'arg2'],
          options: {},
        });
      });

      it('should handle options without command', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--help']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { help: true },
        });
      });
    });

    describe('long options (--key format)', () => {
      it('should parse --key=value format', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--name=TestComponent']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { name: 'TestComponent' },
        });
      });

      it('should parse --key value format', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--name', 'TestComponent']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { name: 'TestComponent' },
        });
      });

      it('should parse boolean flag --key', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--verbose']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { verbose: true },
        });
      });

      it('should convert kebab-case to camelCase', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--dry-run']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { dryRun: true },
        });
      });

      it('should handle multiple long options', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          '--name=TestComponent',
          '--output=/src',
          '--with-tests',
        ]);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: {
            name: 'TestComponent',
            output: '/src',
            withTests: true,
          },
        });
      });

      it('should handle empty value after equals', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--name=']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { name: '' },
        });
      });
    });

    describe('short options (-f format)', () => {
      it('should parse -f value format', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '-n', 'TestComponent']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { name: 'TestComponent' },
        });
      });

      it('should parse boolean flag -f', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '-d']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { debug: true },
        });
      });

      it('should expand short flags correctly', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          '-t',
          'aggregate',
          '-n',
          'Order',
          '-o',
          '/src',
        ]);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: {
            type: 'aggregate',
            name: 'Order',
            output: '/src',
          },
        });
      });

      it('should handle unknown short flags', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '-x']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { x: true },
        });
      });
    });

    describe('component shortcuts', () => {
      it('should parse --specification as type', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--specification']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { type: 'specification' },
        });
      });

      it('should parse --aggregate Name as type and name', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--aggregate', 'Order']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: {
            type: 'aggregate',
            name: 'Order',
          },
        });
      });

      it('should handle all component shortcuts', () => {
        const shortcuts = [
          'specification',
          'aggregate',
          'entity',
          'value-object',
          'policy',
          'command',
          'query',
          'event',
          'repository',
          'domain-service',
        ];

        shortcuts.forEach(shortcut => {
          const result = SimpleArgsParser.parse(['node', 'script.js', `--${shortcut}`]);
          expect(result.options.type).toBe(shortcut);
        });
      });

      it('should not treat non-shortcut as component type', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--unknown', 'value']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { unknown: 'value' },
        });
      });
    });

    describe('type parsing', () => {
      it('should parse boolean true', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--enabled=true']);
        expect(result.options.enabled).toBe(true);
        expect(typeof result.options.enabled).toBe('boolean');
      });

      it('should parse boolean false', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--enabled=false']);
        expect(result.options.enabled).toBe(false);
        expect(typeof result.options.enabled).toBe('boolean');
      });

      it('should parse integers', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--port=3000']);
        expect(result.options.port).toBe(3000);
        expect(typeof result.options.port).toBe('number');
      });

      it('should parse floats', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--version=1.2']);
        expect(result.options.version).toBe(1.2);
        expect(typeof result.options.version).toBe('number');
      });

      it('should keep strings as strings', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--name=123abc']);
        expect(result.options.name).toBe('123abc');
        expect(typeof result.options.name).toBe('string');
      });
    });

    describe('complex scenarios', () => {
      it('should handle mixed options and arguments', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          'generate',
          '--type=aggregate',
          'Order',
          '-o',
          '/src',
          '--with-tests',
          'extra-arg',
        ]);
        expect(result).toEqual({
          command: 'generate',
          args: ['Order'],
          options: {
            type: 'aggregate',
            output: '/src',
            withTests: 'extra-arg',
          },
        });
      });

      it('should handle option-like values in arguments', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          'generate',
          '--name',
          '--not-a-value',
        ]);
        expect(result).toEqual({
          command: 'generate',
          args: [],
          options: {
            name: true,
            notAValue: true,
          },
        });
      });

      it('should handle empty strings in arguments', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', 'generate', '', '--help']);
        expect(result).toEqual({
          command: 'generate',
          args: [],
          options: { help: true },
        });
      });

      it('should handle special characters in values', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          '--path=/some/path with spaces/file.ts',
        ]);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { path: '/some/path with spaces/file.ts' },
        });
      });
    });

    describe('edge cases', () => {
      it('should handle single dash as positional argument', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '-']);
        expect(result).toEqual({
          command: undefined,
          args: ['-'],
          options: {},
        });
      });

      it('should handle double dash as positional argument', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '--']);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { '': true },
        });
      });

      it('should handle malformed short option', () => {
        const result = SimpleArgsParser.parse(['node', 'script.js', '-']);
        expect(result).toEqual({
          command: undefined,
          args: ['-'],
          options: {},
        });
      });

      it('should handle options with multiple equals signs', () => {
        const result = SimpleArgsParser.parse([
          'node',
          'script.js',
          '--url=http://example.com?a=b',
        ]);
        expect(result).toEqual({
          command: undefined,
          args: [],
          options: { url: 'http://example.com?a' },
        });
      });
    });
  });

  describe('showHelp', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });
    });

    it('should show general help when no command specified', () => {
      SimpleArgsParser.showHelp();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🎯 VytchesDDD CLI - Enterprise-Grade Domain Builder'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('generate'));
    });

    it('should show generate command help', () => {
      SimpleArgsParser.showHelp('generate');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: vytches-ddd generate')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--type'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--name'));
    });

    it('should show domain command help', () => {
      SimpleArgsParser.showHelp('domain');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: vytches-ddd domain')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--guided'));
    });
  });
});
