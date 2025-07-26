import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { WorkflowEngine } from '../../../src/core/engines/workflow-engine';
import type { WorkflowStep } from '../../../src/types';
import { CLIError } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/core/utils/prompts');
vi.mock('../../../src/core/utils/colors');
vi.mock('../../../src/core/utils/performance');

import { Prompts } from '../../../src/core/utils/prompts';
import { Colors } from '../../../src/core/utils/colors';
import { Performance } from '../../../src/core/utils/performance';

describe('WorkflowEngine', () => {
  let workflow: WorkflowEngine;
  let mockStep: WorkflowStep;

  beforeEach(() => {
    vi.clearAllMocks();
    workflow = new WorkflowEngine();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });

    // Setup default mocks
    vi.mocked(Colors.bold).mockImplementation(text => text);
    vi.mocked(Colors.cyan).mockImplementation(text => text);
    vi.mocked(Colors.success).mockImplementation(text => text);
    vi.mocked(Colors.error).mockImplementation(text => text);
    vi.mocked(Colors.info).mockImplementation(text => text);
    vi.mocked(Colors.dim).mockImplementation(text => text);
    vi.mocked(Performance.now).mockReturnValue(1000);
    vi.mocked(Performance.since).mockReturnValue(50);
    vi.mocked(Prompts.close).mockImplementation(() => {
      return;
    });

    // Mock spinner
    const mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
      update: vi.fn(),
    };
    vi.mocked(Prompts.spinner).mockReturnValue(mockSpinner);

    mockStep = {
      id: 'test-step',
      title: 'Test Step',
      type: 'action',
      action: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default context', () => {
      const engine = new WorkflowEngine();
      const context = engine.getContext();

      expect(context.workflowType).toBe('default');
      expect(context.step).toBe(0);
      expect(context.totalSteps).toBe(0);
      expect(context.data).toEqual({});
      expect(context.answers).toEqual({});
      expect(context.outputPath).toBe('./src');
    });

    it('should create instance with custom context', () => {
      const customContext = {
        workflowType: 'custom' as const,
        outputPath: './custom',
      };

      const engine = new WorkflowEngine(customContext);
      const context = engine.getContext();

      expect(context.workflowType).toBe('custom');
      expect(context.outputPath).toBe('./custom');
    });
  });

  describe('create', () => {
    it('should create workflow instance using static method', () => {
      const engine = WorkflowEngine.create();

      expect(engine).toBeInstanceOf(WorkflowEngine);
    });

    it('should create workflow instance with initial context', () => {
      const initialContext = { outputPath: './test' };
      const engine = WorkflowEngine.create(initialContext);

      expect(engine.getContext().outputPath).toBe('./test');
    });
  });

  describe('registerStep', () => {
    it('should register a single step', () => {
      workflow.registerStep(mockStep);

      // Verify step is registered by checking if we can start it
      expect(() => workflow.start('test-step')).not.toThrow();
    });
  });

  describe('registerSteps', () => {
    it('should register multiple steps', () => {
      const steps: WorkflowStep[] = [
        mockStep,
        {
          id: 'step-2',
          title: 'Step 2',
          type: 'completion',
        },
      ];

      workflow.registerSteps(steps);

      const progress = workflow.getProgress();
      expect(progress.total).toBe(2);
    });
  });

  describe('start', () => {
    it('should start workflow successfully', async () => {
      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerStep({
        ...mockStep,
        next: 'completion',
      });
      workflow.registerStep(completionStep);

      const [error, result] = await safeRun(async () => await workflow.start('test-step'));

      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(mockStep.action).toHaveBeenCalled();
    });

    it('should throw error for non-existent start step', async () => {
      const [error] = await safeRun(async () => await workflow.start('non-existent'));

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toContain('Workflow step not found: non-existent');
    });

    it('should handle workflow execution errors', async () => {
      const failingStep: WorkflowStep = {
        id: 'failing-step',
        title: 'Failing Step',
        type: 'action',
        action: vi.fn().mockRejectedValue(new Error('Step failed')),
      };

      workflow.registerStep(failingStep);

      const [error] = await safeRun(async () => await workflow.start('failing-step'));

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toContain('Failed to execute step');
    });
  });

  describe('prompt steps', () => {
    beforeEach(() => {
      vi.mocked(Prompts.ask).mockResolvedValue('test-answer');
      vi.mocked(Prompts.select).mockResolvedValue('selected-option');
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['option1', 'option2']);
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.password).mockResolvedValue('secret');
    });

    it('should execute input prompt step', async () => {
      const promptStep: WorkflowStep = {
        id: 'input-step',
        title: 'Input Step',
        type: 'prompt',
        prompt: {
          type: 'input',
          message: 'Enter value',
        },
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([promptStep, completionStep]);

      const [error, result] = await safeRun(async () => await workflow.start('input-step'));

      expect(error).toBeUndefined();
      expect(Prompts.ask).toHaveBeenCalledWith({
        message: 'Enter value',
      });
      expect((await result)?.answers?.['input-step']).toBe('test-answer');
    });

    it('should execute select prompt step', async () => {
      const promptStep: WorkflowStep = {
        id: 'select-step',
        title: 'Select Step',
        type: 'prompt',
        prompt: {
          type: 'select',
          message: 'Choose option',
          choices: ['option1', 'option2'],
        },
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([promptStep, completionStep]);

      const [error] = await safeRun(async () => await workflow.start('select-step'));

      expect(error).toBeUndefined();
      expect(Prompts.select).toHaveBeenCalledWith({
        message: 'Choose option',
        choices: [
          { name: 'option1', value: 'option1' },
          { name: 'option2', value: 'option2' },
        ],
        default: undefined,
      });
    });

    it('should execute multiselect prompt step', async () => {
      const promptStep: WorkflowStep = {
        id: 'multiselect-step',
        title: 'Multi Select Step',
        type: 'prompt',
        prompt: {
          type: 'multiselect',
          message: 'Choose options',
          choices: [
            { name: 'Option 1', value: 'opt1' },
            { name: 'Option 2', value: 'opt2' },
          ],
        },
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([promptStep, completionStep]);

      const [error] = await safeRun(async () => await workflow.start('multiselect-step'));

      expect(error).toBeUndefined();
      expect(Prompts.multiSelect).toHaveBeenCalled();
    });

    it('should execute confirm prompt step', async () => {
      const promptStep: WorkflowStep = {
        id: 'confirm-step',
        title: 'Confirm Step',
        type: 'prompt',
        prompt: {
          type: 'confirm',
          message: 'Are you sure?',
          default: false,
        },
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([promptStep, completionStep]);

      const [error] = await safeRun(async () => await workflow.start('confirm-step'));

      expect(error).toBeUndefined();
      expect(Prompts.confirm).toHaveBeenCalledWith({
        message: 'Are you sure?',
        default: false,
      });
    });

    it('should execute password prompt step', async () => {
      const promptStep: WorkflowStep = {
        id: 'password-step',
        title: 'Password Step',
        type: 'prompt',
        prompt: {
          type: 'password',
          message: 'Enter password',
        },
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([promptStep, completionStep]);

      const [error] = await safeRun(async () => await workflow.start('password-step'));

      expect(error).toBeUndefined();
      expect(Prompts.password).toHaveBeenCalledWith({
        message: 'Enter password',
      });
    });
  });

  describe('action steps', () => {
    it('should execute action step with spinner', async () => {
      const actionStep: WorkflowStep = {
        id: 'action-step',
        title: 'Action Step',
        type: 'action',
        action: vi.fn().mockResolvedValue(undefined),
        next: 'completion',
      };

      const completionStep: WorkflowStep = {
        id: 'completion',
        title: 'Complete',
        type: 'completion',
      };

      workflow.registerSteps([actionStep, completionStep]);

      const [error] = await safeRun(async () => await workflow.start('action-step'));

      expect(error).toBeUndefined();
      expect(Prompts.spinner).toHaveBeenCalled();
      expect(actionStep.action).toHaveBeenCalled();
    });

    it('should handle action step errors', async () => {
      const actionStep: WorkflowStep = {
        id: 'failing-action',
        title: 'Failing Action',
        type: 'action',
        action: vi.fn().mockRejectedValue(new Error('Action failed')),
      };

      workflow.registerStep(actionStep);

      const [error] = await safeRun(async () => await workflow.start('failing-action'));

      expect(error).toBeInstanceOf(CLIError);
    });
  });

  describe('updateContext', () => {
    it('should update workflow context', () => {
      const updates = { outputPath: './updated' };

      workflow.updateContext(updates);

      const context = workflow.getContext();
      expect(context.outputPath).toBe('./updated');
    });
  });

  describe('getProgress', () => {
    it('should return workflow progress', () => {
      workflow.registerSteps([mockStep]);

      const progress = workflow.getProgress();

      expect(progress.total).toBe(1);
      expect(progress.completed).toBe(0);
      expect(progress.current).toBeNull();
      expect(progress.percentage).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset workflow state', () => {
      workflow.updateContext({ answers: { test: 'value' } });

      workflow.reset();

      const context = workflow.getContext();
      expect(context.answers).toEqual({});
    });
  });

  describe('static workflow factories', () => {
    it('should create domain modeling workflow', () => {
      const domainWorkflow = WorkflowEngine.createDomainModelingWorkflow();

      expect(domainWorkflow).toBeInstanceOf(WorkflowEngine);

      const progress = domainWorkflow.getProgress();
      expect(progress.total).toBeGreaterThan(0);
    });

    it('should create component workflow', () => {
      const componentWorkflow = WorkflowEngine.createComponentWorkflow();

      expect(componentWorkflow).toBeInstanceOf(WorkflowEngine);

      const progress = componentWorkflow.getProgress();
      expect(progress.total).toBeGreaterThan(0);
    });
  });
});
