import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { PromptOptions, SelectOptions } from '../../../src/core/utils/prompts';
import {
  Prompts,
  promptForInput,
  promptForChoice,
  promptForConfirmation,
  promptForMultiSelect,
  ConfirmOptions,
} from '../../../src/core/utils/prompts';
import { CLIError } from '../../../src/types';
import * as readline from 'readline';

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

// Mock process stdin/stdout
const mockStdin = {
  setRawMode: vi.fn(),
  resume: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

const mockStdout = {
  write: vi.fn(),
};

const mockReadlineInterface = {
  question: vi.fn(),
  close: vi.fn(),
};

describe('Prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    vi.mocked(readline.createInterface).mockReturnValue(mockReadlineInterface as any);

    // Mock process objects
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    });

    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      configurable: true,
    });

    // Reset readline interface
    Prompts.close();
  });

  describe('readline interface management', () => {
    it('should create readline interface when needed', async () => {
      const promptOptions: PromptOptions = {
        message: 'Test question',
      };

      // Mock the question callback to resolve immediately
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('test answer');
      });

      await Prompts.ask(promptOptions);

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      });
    });

    it('should reuse existing readline interface', async () => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('test answer');
      });

      await Prompts.ask({ message: 'Question 1' });
      await Prompts.ask({ message: 'Question 2' });

      expect(readline.createInterface).toHaveBeenCalledTimes(1);
    });

    it('should close readline interface', () => {
      Prompts.close();

      expect(mockReadlineInterface.close).toHaveBeenCalled();
    });
  });

  describe('ask method', () => {
    beforeEach(() => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('test answer');
      });
    });

    it('should ask question and return answer', async () => {
      const options: PromptOptions = {
        message: 'What is your name?',
      };

      const answer = await Prompts.ask(options);

      expect(answer).toBe('test answer');
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('What is your name?'),
        expect.any(Function)
      );
    });

    it('should use default value when answer is empty', async () => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback(''); // Empty answer
      });

      const options: PromptOptions = {
        message: 'What is your name?',
        default: 'John Doe',
      };

      const answer = await Prompts.ask(options);

      expect(answer).toBe('John Doe');
    });

    it('should validate input and re-ask on invalid input', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('invalid'); // First invalid answer
        } else {
          callback('valid'); // Second valid answer
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const options: PromptOptions = {
        message: 'Enter valid input',
        validate: input => input === 'valid' || 'Input must be "valid"',
      };

      const answer = await Prompts.ask(options);

      expect(answer).toBe('valid');
      expect(mockReadlineInterface.question).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Input must be "valid"'));
    });

    it('should validate with boolean return value', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('invalid');
        } else {
          callback('valid');
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const options: PromptOptions = {
        message: 'Enter valid input',
        validate: input => input === 'valid',
      };

      const answer = await Prompts.ask(options);

      expect(answer).toBe('valid');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
    });

    it('should format prompt with default value', async () => {
      const options: PromptOptions = {
        message: 'Enter name',
        default: 'John',
      };

      await Prompts.ask(options);

      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('(John)'),
        expect.any(Function)
      );
    });
  });

  describe('password method', () => {
    beforeEach(() => {
      // Setup stdin for raw mode
      Object.defineProperty(process, 'stdin', {
        value: {
          ...mockStdin,
          setRawMode: vi.fn(),
          resume: vi.fn(),
          on: vi.fn(),
          removeListener: vi.fn(),
        },
        configurable: true,
      });
    });

    it('should handle password input with enter key', async () => {
      const mockOnData = vi.fn();
      process.stdin.on = vi.fn().mockImplementation((event, callback) => {
        mockOnData.mockImplementation(callback);
      });

      const passwordPromise = Prompts.password({ message: 'Enter password' });

      // Simulate typing password and pressing enter
      mockOnData(Buffer.from('s'));
      mockOnData(Buffer.from('e'));
      mockOnData(Buffer.from('c'));
      mockOnData(Buffer.from('r'));
      mockOnData(Buffer.from('e'));
      mockOnData(Buffer.from('t'));
      mockOnData(Buffer.from('\n')); // Enter key

      const password = await passwordPromise;

      expect(password).toBe('secret');
      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
    });

    it('should handle backspace in password input', async () => {
      const mockOnData = vi.fn();
      process.stdin.on = vi.fn().mockImplementation((event, callback) => {
        mockOnData.mockImplementation(callback);
      });

      const passwordPromise = Prompts.password({ message: 'Enter password' });

      // Simulate typing with backspace
      mockOnData(Buffer.from('s'));
      mockOnData(Buffer.from('e'));
      mockOnData(Buffer.from('\u007f')); // Backspace
      mockOnData(Buffer.from('c'));
      mockOnData(Buffer.from('\n')); // Enter

      const password = await passwordPromise;

      expect(password).toBe('sc');
    });

    it('should handle Ctrl+C gracefully', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      const mockOnData = vi.fn();
      process.stdin.on = vi.fn().mockImplementation((event, callback) => {
        mockOnData.mockImplementation(callback);
      });

      const passwordPromise = Prompts.password({ message: 'Enter password' });

      expect(() => {
        mockOnData(Buffer.from('\u0003')); // Ctrl+C
      }).toThrow('Process exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('confirm method', () => {
    beforeEach(() => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('y');
      });
    });

    it('should return true for yes answers', async () => {
      const testCases = ['y', 'yes', 'Y', 'YES'];

      for (const answer of testCases) {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(answer);
        });

        const result = await Prompts.confirm({ message: 'Continue?' });
        expect(result).toBe(true);
      }
    });

    it('should return false for no answers', async () => {
      const testCases = ['n', 'no', 'N', 'NO'];

      for (const answer of testCases) {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(answer);
        });

        const result = await Prompts.confirm({ message: 'Continue?' });
        expect(result).toBe(false);
      }
    });

    it('should use default value when provided', async () => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback(''); // Empty answer
      });

      const result = await Prompts.confirm({
        message: 'Continue?',
        default: true,
      });

      expect(result).toBe(true);
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('(Y/n)'),
        expect.any(Function)
      );
    });

    it('should show proper default indicators', async () => {
      // Test default true
      await Prompts.confirm({ message: 'Continue?', default: true });
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('(Y/n)'),
        expect.any(Function)
      );

      // Test default false
      await Prompts.confirm({ message: 'Continue?', default: false });
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('(y/N)'),
        expect.any(Function)
      );

      // Test no default
      await Prompts.confirm({ message: 'Continue?' });
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.stringContaining('(y/n)'),
        expect.any(Function)
      );
    });

    it('should validate confirm input and re-ask on invalid', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('maybe'); // Invalid answer
        } else {
          callback('yes'); // Valid answer
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.confirm({ message: 'Continue?' });

      expect(result).toBe(true);
      expect(mockReadlineInterface.question).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please answer y/yes or n/no')
      );
    });
  });

  describe('select method', () => {
    const selectOptions: SelectOptions = {
      message: 'Choose an option',
      choices: [
        { name: 'Option 1', value: 'opt1', description: 'First option' },
        { name: 'Option 2', value: 'opt2' },
        { name: 'Option 3', value: 'opt3', description: 'Third option' },
      ],
    };

    beforeEach(() => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('1');
      });
    });

    it('should display choices and return selected value', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.select(selectOptions);

      expect(result).toBe('opt1');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Choose an option'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1. Option 1'));
    });

    it('should highlight default option', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const optionsWithDefault = { ...selectOptions, default: 1 };
      await Prompts.select(optionsWithDefault);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('❯ 2. Option 2'));
    });

    it('should show descriptions when provided', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      await Prompts.select(selectOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('First option'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Third option'));
    });

    it('should validate selection and re-ask on invalid', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('5'); // Invalid selection
        } else {
          callback('2'); // Valid selection
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.select(selectOptions);

      expect(result).toBe('opt2');
      expect(mockReadlineInterface.question).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please select a number between 1 and 3')
      );
    });

    it('should use default value when provided', async () => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback(''); // Empty answer
      });

      const optionsWithDefault = { ...selectOptions, default: 2 };
      const result = await Prompts.select(optionsWithDefault);

      expect(result).toBe('opt3');
    });
  });

  describe('multiSelect method', () => {
    const multiSelectOptions: SelectOptions = {
      message: 'Choose multiple options',
      choices: [
        { name: 'Option 1', value: 'opt1' },
        { name: 'Option 2', value: 'opt2' },
        { name: 'Option 3', value: 'opt3' },
      ],
    };

    beforeEach(() => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('1,3');
      });
    });

    it('should return array of selected values', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.multiSelect(multiSelectOptions);

      expect(result).toEqual(['opt1', 'opt3']);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('comma-separated numbers')
      );
    });

    it('should validate empty selection', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(''); // Empty selection
        } else {
          callback('1'); // Valid selection
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.multiSelect(multiSelectOptions);

      expect(result).toEqual(['opt1']);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please select at least one option')
      );
    });

    it('should validate invalid selections', async () => {
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('1,5'); // Invalid selection
        } else {
          callback('1,2'); // Valid selection
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const result = await Prompts.multiSelect(multiSelectOptions);

      expect(result).toEqual(['opt1', 'opt2']);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid selection: 5'));
    });

    it('should handle whitespace in selections', async () => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback(' 1 , 3 '); // With extra whitespace
      });

      const result = await Prompts.multiSelect(multiSelectOptions);

      expect(result).toEqual(['opt1', 'opt3']);
    });
  });

  describe('utility methods', () => {
    describe('spinner', () => {
      it('should create spinner with start/stop functionality', () => {
        const spinner = Prompts.spinner('Loading...');

        expect(spinner).toHaveProperty('start');
        expect(spinner).toHaveProperty('stop');
        expect(spinner).toHaveProperty('update');
        expect(typeof spinner.start).toBe('function');
        expect(typeof spinner.stop).toBe('function');
        expect(typeof spinner.update).toBe('function');
      });

      it('should update spinner message', () => {
        const spinner = Prompts.spinner('Loading...');

        const [error] = safeRun(() => {
          spinner.update('Processing...');
        });

        expect(error).toBeUndefined();
      });

      it('should handle multiple start calls gracefully', () => {
        const spinner = Prompts.spinner('Loading...');

        const [error] = safeRun(() => {
          spinner.start();
          spinner.start(); // Should not create duplicate intervals
          spinner.stop();
        });

        expect(error).toBeUndefined();
      });
    });

    describe('progressBar', () => {
      it('should display progress bar', () => {
        Prompts.progressBar(50, 100, 'Processing files');

        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('50%'));
        expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Processing files'));
      });

      it('should add newline when complete', () => {
        Prompts.progressBar(100, 100);

        expect(mockStdout.write).toHaveBeenCalledWith('\n');
      });
    });

    describe('cursor control', () => {
      it('should clear line', () => {
        Prompts.clearLine();

        expect(mockStdout.write).toHaveBeenCalledWith('\r\x1b[K');
      });

      it('should move cursor up', () => {
        Prompts.cursorUp(3);

        expect(mockStdout.write).toHaveBeenCalledWith('\x1b[3A');
      });

      it('should move cursor down', () => {
        Prompts.cursorDown(2);

        expect(mockStdout.write).toHaveBeenCalledWith('\x1b[2B');
      });

      it('should use default values for cursor movement', () => {
        Prompts.cursorUp();
        Prompts.cursorDown();

        expect(mockStdout.write).toHaveBeenCalledWith('\x1b[1A');
        expect(mockStdout.write).toHaveBeenCalledWith('\x1b[1B');
      });
    });
  });

  describe('convenience functions', () => {
    beforeEach(() => {
      mockReadlineInterface.question.mockImplementation((prompt, callback) => {
        callback('test input');
      });
    });

    describe('promptForInput', () => {
      it('should return input value', async () => {
        const result = await promptForInput('Enter name');

        expect(result).toBe('test input');
      });

      it('should use default value', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(''); // Empty input
        });

        const result = await promptForInput('Enter name', { defaultValue: 'John' });

        expect(result).toBe('John');
      });

      it('should throw error when required and empty', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(''); // Empty input
        });

        const [error] = await safeRun(
          async () => await promptForInput('Enter name', { required: true })
        );

        expect(error).toBeInstanceOf(CLIError);
        expect(error?.message).toBe('Input is required');
      });

      it('should apply custom validation', async () => {
        let callCount = 0;
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callCount++;
          if (callCount === 1) {
            callback('invalid');
          } else {
            callback('valid');
          }
        });

        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
          return;
        });

        const result = await promptForInput('Enter value', {
          validate: input => input === 'valid' || 'Must be valid',
        });

        expect(result).toBe('valid');
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe('promptForChoice', () => {
      it('should return selected choice value', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback('2');
        });

        const choices = [
          { name: 'Option 1', value: 'opt1' },
          { name: 'Option 2', value: 'opt2' },
        ];

        const result = await promptForChoice('Choose option', choices);

        expect(result).toBe('opt2');
      });

      it('should use default index', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(''); // Empty selection
        });

        const choices = [
          { name: 'Option 1', value: 'opt1' },
          { name: 'Option 2', value: 'opt2' },
        ];

        const result = await promptForChoice('Choose option', choices, 0);

        expect(result).toBe('opt1');
      });
    });

    describe('promptForConfirmation', () => {
      it('should return confirmation result', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback('yes');
        });

        const result = await promptForConfirmation('Continue?');

        expect(result).toBe(true);
      });

      it('should use default value', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback(''); // Empty input
        });

        const result = await promptForConfirmation('Continue?', false);

        expect(result).toBe(false);
      });
    });

    describe('promptForMultiSelect', () => {
      it('should return array of selected values', async () => {
        mockReadlineInterface.question.mockImplementation((prompt, callback) => {
          callback('1,2');
        });

        const choices = [
          { name: 'Option 1', value: 'opt1' },
          { name: 'Option 2', value: 'opt2' },
          { name: 'Option 3', value: 'opt3' },
        ];

        const result = await promptForMultiSelect('Choose options', choices);

        expect(result).toEqual(['opt1', 'opt2']);
      });
    });
  });
});
