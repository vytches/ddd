import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { workflowCommand } from '../../src/commands/workflow';
import { DomainModelingWorkflow } from '../../src/workflows';
import { WorkflowEngine } from '../../src/core/engines/workflow-engine';
import { ConfigManager } from '../../src/core/engines/config-manager';
import { chatHistory } from '../../src/core/utils/chat-history';
import { Colors } from '../../src/core/utils/colors';

// Mock all dependencies
vi.mock('../../src/workflows');
vi.mock('../../src/core/engines/workflow-engine');
vi.mock('../../src/core/engines/config-manager');
vi.mock('../../src/core/utils/chat-history');
vi.mock('../../src/core/utils/colors', () => ({
  Colors: {
    bold: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    error: vi.fn((text) => text),
    info: vi.fn((text) => text),
    success: vi.fn((text) => text),
    warning: vi.fn((text) => text),
    dim: vi.fn((text) => text),
    green: vi.fn((text) => text),
    blue: vi.fn((text) => text),
  },
}));

// Mock types with proper typing to avoid Jest issues
const mockDomainModelingWorkflow = DomainModelingWorkflow;
const mockWorkflowEngine = WorkflowEngine;
const mockConfigManager = ConfigManager;
const mockChatHistory = chatHistory;

describe('workflowCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (mockConfigManager as any).getConfig = vi.fn().mockReturnValue({
      debug: false,
      projectPath: '/mock/project',
    });

    // Mock workflow instances
    const mockDomainWorkflowInstance = {
      start: vi.fn().mockResolvedValue({
        workflowType: 'domain-modeling',
        completed: true,
        results: {},
      }),
    };

    const mockComponentWorkflowInstance = {
      start: vi.fn().mockResolvedValue({
        workflowType: 'component-generation',
        completed: true,
        results: {},
      }),
    };

    (mockDomainModelingWorkflow as any).mockImplementation(() => mockDomainWorkflowInstance);
    
    (mockWorkflowEngine as any).createComponentWorkflow = vi.fn().mockReturnValue(mockComponentWorkflowInstance);

    // Mock chatHistory methods
    (mockChatHistory as any).getSessionHistory = vi.fn().mockReturnValue([]);
    (mockChatHistory as any).exportSession = vi.fn().mockResolvedValue({
      json: '/mock/export.json',
      markdown: '/mock/export.md',
    });
    (mockChatHistory as any).resumeSession = vi.fn().mockResolvedValue(true);
    (mockChatHistory as any).getCurrentSession = vi.fn().mockReturnValue(null);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => { return });
    vi.spyOn(console, 'error').mockImplementation(() => { return });

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('command configuration', () => {
    it('should have correct name and description', () => {
      expect(workflowCommand.name).toBe('workflow');
      expect(workflowCommand.description).toBe('Start interactive AI-powered workflows for domain modeling and generation');
      expect(workflowCommand.aliases).toEqual(['w', 'interactive']);
    });

    it('should have required options', () => {
      const options: any[] = workflowCommand.options || [];
      expect(options).toBeDefined();
      expect(options.length).toBeGreaterThan(0);

      // Check for key options
      const typeOption = options.find((opt: any) => opt.flags.includes('--type'));
      const resumeOption = options.find((opt: any) => opt.flags.includes('--resume'));
      const listOption = options.find((opt: any) => opt.flags.includes('--list-sessions'));
      const exportOption = options.find((opt: any) => opt.flags.includes('--export'));

      expect(typeOption).toBeDefined();
      expect(typeOption.choices).toEqual([
        'domain-modeling',
        'component-generation',
        'enterprise-setup',
        'migration-planning',
      ]);
      expect(typeOption.defaultValue).toBe('domain-modeling');

      expect(resumeOption).toBeDefined();
      expect(listOption).toBeDefined();
      expect(exportOption).toBeDefined();
    });

    it('should have examples', () => {
      expect(workflowCommand.examples).toBeDefined();
      expect((workflowCommand.examples as any[] || []).length).toBeGreaterThan(0);
    });
  });

  describe('workflow execution', () => {
    it('should start domain-modeling workflow by default', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainModelingWorkflow).toHaveBeenCalled();
      const instance = (mockDomainModelingWorkflow as any).mock.results[0].value;
      expect(instance.start).toHaveBeenCalled();
    });

    it('should start domain-modeling workflow when explicitly specified', async () => {
      const args: string[] = [];
      const options = { type: 'domain-modeling' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainModelingWorkflow).toHaveBeenCalled();
    });

    it('should start component-generation workflow', async () => {
      const args: string[] = [];
      const options = { type: 'component-generation' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect((mockWorkflowEngine as any).createComponentWorkflow).toHaveBeenCalled();
      const instance = (mockWorkflowEngine as any).createComponentWorkflow.mock.results[0].value;
      expect(instance.start).toHaveBeenCalledWith('component-type');
    });

    it('should show warning for enterprise-setup workflow', async () => {
      const args: string[] = [];
      const options = { type: 'enterprise-setup' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(Colors.warning).toHaveBeenCalledWith('Enterprise Setup workflow coming soon!');
    });

    it('should show warning for migration-planning workflow', async () => {
      const args: string[] = [];
      const options = { type: 'migration-planning' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(Colors.warning).toHaveBeenCalledWith('Migration Planning workflow coming soon!');
    });

    it('should handle unknown workflow type', async () => {
      const args: string[] = [];
      const options = { type: 'unknown-workflow' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown workflow type')
      );
    });

    it('should show debug context when debug is enabled', async () => {
      (mockConfigManager as any).getConfig.mockReturnValue({
        debug: true,
        projectPath: '/mock/project',
      });

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Final context:')
      );
    });
  });

  describe('session management', () => {
    it('should list sessions when --list-sessions is provided', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          title: 'Domain Modeling Session',
          startedAt: new Date(),
          messages: [
            { role: 'user', content: 'Test message' },
            { role: 'assistant', content: 'Test response' },
          ],
          context: {
            workflowType: 'domain-modeling',
            projectPath: '/test/project',
          },
        },
      ];

      (mockChatHistory as any).getSessionHistory.mockReturnValue(mockSessions);

      const args: string[] = [];
      const options = { listSessions: true };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect((mockChatHistory as any).getSessionHistory).toHaveBeenCalledWith(10);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Available Chat Sessions')
      );
    });

    it('should show message when no sessions found', async () => {
      (mockChatHistory as any).getSessionHistory.mockReturnValue([]);

      const args: string[] = [];
      const options = { listSessions: true };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No chat sessions found')
      );
    });

    it('should export session when --export is provided', async () => {
      (mockChatHistory as any).exportSession.mockResolvedValue({
        json: '/mock/export.json',
        markdown: '/mock/export.md',
      });

      const args: string[] = [];
      const options = { export: 'session-123' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect((mockChatHistory as any).exportSession).toHaveBeenCalledWith('session-123', 'json');
      expect((mockChatHistory as any).exportSession).toHaveBeenCalledWith('session-123', 'markdown');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Session exported successfully')
      );
    });

    it('should handle export session errors', async () => {
      (mockChatHistory as any).exportSession.mockRejectedValue(new Error('Export failed'));

      const args: string[] = [];
      const options = { export: 'session-123' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to export session')
      );
    });

    it('should resume session when --resume is provided', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Test Session',
        startedAt: new Date(),
        messages: [
          { role: 'user', content: 'Test message' },
          { role: 'assistant', content: 'Test response' },
        ],
        context: {
          workflowType: 'domain-modeling',
        },
      };

      (mockChatHistory as any).resumeSession.mockResolvedValue(true);
      (mockChatHistory as any).getCurrentSession.mockReturnValue(mockSession);

      const args: string[] = [];
      const options = { resume: 'session-123' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect((mockChatHistory as any).resumeSession).toHaveBeenCalledWith('session-123');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Resumed session')
      );
    });

    it('should handle resume session not found', async () => {
      (mockChatHistory as any).resumeSession.mockResolvedValue(false);

      const args: string[] = [];
      const options = { resume: 'non-existent' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Session not found')
      );
    });

    it('should handle resume session load failure', async () => {
      (mockChatHistory as any).resumeSession.mockResolvedValue(true);
      (mockChatHistory as any).getCurrentSession.mockReturnValue(null);

      const args: string[] = [];
      const options = { resume: 'session-123' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load session')
      );
    });

    it('should show recent conversation when resuming session', async () => {
      const mockSession = {
        id: 'session-123',
        title: 'Test Session',
        startedAt: new Date(),
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
          { role: 'assistant', content: 'Second response' },
          { role: 'user', content: 'Third message that is very long and should be truncated after 100 characters to show ellipsis in the output' },
        ],
        context: {
          workflowType: 'domain-modeling',
        },
      };

      (mockChatHistory as any).resumeSession.mockResolvedValue(true);
      (mockChatHistory as any).getCurrentSession.mockReturnValue(mockSession);

      const args: string[] = [];
      const options = { resume: 'session-123' };

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Recent Conversation')
      );
      // Check that long messages are truncated
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('...')
      );
    });
  });

  describe('error handling', () => {
    it('should handle workflow errors gracefully', async () => {
      const mockError = new Error('Workflow failed');
      const mockDomainWorkflowInstance = {
        start: vi.fn().mockRejectedValue(mockError),
      };

      (mockDomainModelingWorkflow as any).mockImplementation(() => mockDomainWorkflowInstance);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow failed: Workflow failed')
      );
    });

    it('should handle non-Error exceptions', async () => {
      const mockDomainWorkflowInstance = {
        start: vi.fn().mockRejectedValue('String error'),
      };

      (mockDomainModelingWorkflow as any).mockImplementation(() => mockDomainWorkflowInstance);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await workflowCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow failed: String error')
      );
    });
  });
});