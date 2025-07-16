/**
 * @fileoverview Interactive Workflow Command
 * AI-powered interactive workflows for domain modeling and generation
 */

import type { Command, WorkflowContext, CLIConfig } from '../types';
import { Colors } from '../core/utils/colors';
import { DomainModelingWorkflow } from '../workflows';
import { WorkflowEngine } from '../core/engines/workflow-engine';
import { ConfigManager } from '../core/engines/config-manager';
import { chatHistory } from '../core/utils/chat-history';

/**
 * @llm-summary workflowCommand constant
 * @llm-domain Infrastructure
 *
 * @description
 * workflowCommand constant implementing infrastructure service for workflow command operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(workflowCommand);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const workflowCommand: Command = {
  name: 'workflow',
  description: 'Start interactive AI-powered workflows for domain modeling and generation',
  aliases: ['w', 'interactive'],
  options: [
    {
      flags: '-t, --type <type>',
      description: 'Workflow type to start',
      choices: [
        'domain-modeling',
        'component-generation',
        'enterprise-setup',
        'migration-planning',
      ],
      defaultValue: 'domain-modeling',
    },
    {
      flags: '--resume <sessionId>',
      description: 'Resume a previous chat session',
    },
    {
      flags: '--list-sessions',
      description: 'List available chat sessions',
    },
    {
      flags: '--export <sessionId>',
      description: 'Export chat session to file',
    },
  ],
  examples: [
    'vytches-ddd workflow',
    'vytches-ddd workflow --type domain-modeling',
    'vytches-ddd workflow --resume session-123',
    'vytches-ddd workflow --list-sessions',
    'vytches-ddd workflow --export session-123',
  ],
  action: async (_args: string[], options: Record<string, unknown>) => {
    try {
      const config = ConfigManager.getConfig();

      // Handle list sessions
      if (options.listSessions) {
        await handleListSessions();
        return;
      }

      // Handle export session
      if (options.export) {
        await handleExportSession(options.export as string);
        return;
      }

      // Handle resume session
      if (options.resume) {
        await handleResumeSession(options.resume as string);
        return;
      }

      // Start workflow
      const workflowType = (options.type as string) || 'domain-modeling';
      await startWorkflow(workflowType, config);
    } catch (error) {
      console.error(
        Colors.error(`Workflow failed: ${error instanceof Error ? error.message : error}`)
      );
      process.exit(1);
    }
  },
};

/**
 * Start specified workflow type
 */
async function startWorkflow(type: string, config: CLIConfig): Promise<void> {
  console.log(Colors.bold(Colors.cyan('🎯 VytchesDDD Interactive Workflow')));
  console.log('');

  let context: WorkflowContext;

  switch (type) {
    case 'domain-modeling': {
      console.log(Colors.info('Starting Domain Modeling Workflow...'));
      console.log('');

      const domainWorkflow = new DomainModelingWorkflow();
      context = await domainWorkflow.start();
      break;
    }

    case 'component-generation': {
      console.log(Colors.info('Starting Component Generation Workflow...'));
      console.log('');

      const componentWorkflow = WorkflowEngine.createComponentWorkflow();
      context = await componentWorkflow.start('component-type');
      break;
    }

    case 'enterprise-setup':
      console.log(Colors.warning('Enterprise Setup workflow coming soon!'));
      console.log(Colors.info('Use: vytches-ddd workflow --type domain-modeling'));
      return;

    case 'migration-planning':
      console.log(Colors.warning('Migration Planning workflow coming soon!'));
      console.log(Colors.info('Use: vytches-ddd workflow --type domain-modeling'));
      return;

    default:
      throw new Error(
        `Unknown workflow type: ${type}. Available: domain-modeling, component-generation, enterprise-setup, migration-planning`
      );
  }

  // Show completion summary
  console.log('');
  console.log(Colors.success('🎉 Workflow completed successfully!'));

  if (config.debug) {
    console.log('');
    console.log(Colors.dim('Final context:'));
    console.log(Colors.dim(JSON.stringify(context, null, 2)));
  }
}

/**
 * Handle list sessions command
 */
async function handleListSessions(): Promise<void> {
  console.log(Colors.bold('💬 Available Chat Sessions:'));
  console.log('');

  const sessions = chatHistory.getSessionHistory(10);

  if (sessions.length === 0) {
    console.log(
      Colors.dim('No chat sessions found. Start a workflow to create your first session.')
    );
    return;
  }

  sessions.forEach((session, index) => {
    const status = index === 0 ? Colors.green('(Current)') : '';
    console.log(`${Colors.cyan(`${index + 1}.`)} ${Colors.bold(session.title)} ${status}`);
    console.log(`   ${Colors.dim(`ID: ${session.id}`)}`);
    console.log(`   ${Colors.dim(`Started: ${session.startedAt.toLocaleString()}`)}`);
    console.log(`   ${Colors.dim(`Messages: ${session.messages.length}`)}`);

    if (session.context) {
      const contextInfo = [];
      if (session.context.workflowType) contextInfo.push(`Type: ${session.context.workflowType}`);
      if (session.context.projectPath) contextInfo.push(`Project: ${session.context.projectPath}`);

      if (contextInfo.length > 0) {
        console.log(`   ${Colors.dim(contextInfo.join(', '))}`);
      }
    }

    console.log('');
  });

  console.log(Colors.info('Commands:'));
  console.log(`  ${Colors.cyan('Resume:')} vytches-ddd workflow --resume <sessionId>`);
  console.log(`  ${Colors.cyan('Export:')} vytches-ddd workflow --export <sessionId>`);
}

/**
 * Handle export session command
 */
async function handleExportSession(sessionId: string): Promise<void> {
  try {
    console.log(Colors.info(`Exporting session: ${sessionId}`));

    const jsonPath = await chatHistory.exportSession(sessionId, 'json');
    const markdownPath = await chatHistory.exportSession(sessionId, 'markdown');

    console.log('');
    console.log(Colors.success('📄 Session exported successfully:'));
    console.log(`  ${Colors.cyan('JSON:')} ${jsonPath}`);
    console.log(`  ${Colors.cyan('Markdown:')} ${markdownPath}`);
  } catch (error) {
    throw new Error(`Failed to export session: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Handle resume session command
 */
async function handleResumeSession(sessionId: string): Promise<void> {
  try {
    console.log(Colors.info(`Resuming session: ${sessionId}`));

    const resumed = await chatHistory.resumeSession(sessionId);

    if (!resumed) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = chatHistory.getCurrentSession();
    if (!session) {
      throw new Error('Failed to load session');
    }

    console.log('');
    console.log(Colors.success(`📱 Resumed session: ${session.title}`));
    console.log(`   ${Colors.dim(`Started: ${session.startedAt.toLocaleString()}`)}`);
    console.log(`   ${Colors.dim(`Messages: ${session.messages.length}`)}`);
    console.log('');

    // Show recent conversation context
    if (session.messages.length > 0) {
      console.log(Colors.bold('💬 Recent Conversation:'));
      const recentMessages = session.messages.slice(-3);

      recentMessages.forEach(message => {
        const roleIcon =
          message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
        const roleColor =
          message.role === 'user'
            ? Colors.blue
            : message.role === 'assistant'
              ? Colors.green
              : Colors.dim;

        console.log(
          `${roleIcon} ${roleColor(message.role)}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`
        );
      });

      console.log('');
    }

    // Determine next action based on session context
    if (session.context?.workflowType) {
      console.log(Colors.info(`🔄 Ready to continue ${session.context.workflowType} workflow`));
      console.log(
        Colors.dim(
          'Note: Currently resuming workflows requires restarting. Use the context above to continue manually.'
        )
      );
    } else {
      console.log(Colors.info('📝 Session loaded. You can continue from where you left off.'));
    }
  } catch (error) {
    throw new Error(`Failed to resume session: ${error instanceof Error ? error.message : error}`);
  }
}
