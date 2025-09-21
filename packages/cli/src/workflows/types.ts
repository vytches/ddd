/**
 * Context object passed through workflow execution
 */
export interface WorkflowContext {
  workflowType: string;
  projectPath?: string;
  domainName?: string | undefined;
  step: number;
  totalSteps: number;
  data: Record<string, unknown>;
  metadata: {
    startedAt: Date;
    lastModified: Date;
    sessionId: string;
  };
  answers?: Record<string, unknown>;
  config?: Record<string, unknown>;
  outputPath?: string;
}

/**
 * Individual workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  execute: (context: WorkflowContext) => Promise<WorkflowContext>;
  canSkip?: boolean;
  condition?: (context: WorkflowContext) => boolean;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  context: WorkflowContext;
  generatedFiles: string[];
  plannedFiles: string[];
  boundedContexts: string[];
  patterns: string[];
  hasDatabase: boolean;
  hasMonitoring: boolean;
  error?: Error;
}

/**
 * Domain builder workflow options
 */
export interface DomainBuilderOptions {
  domainName?: string;
  structure: string;
  framework: string;
  guided: boolean;
  patterns: string[];
  boundedContexts: string[];
  compliance: string[];
  security: string[];
  monitoring: boolean;
  dryRun: boolean;
}

/**
 * Domain modeling workflow options
 */
export interface DomainModelingOptions {
  interactive?: boolean;
  outputPath?: string;
  framework?: string;
  patterns?: string[];
}

/**
 * Component generation workflow options
 */
export interface ComponentGenerationOptions {
  componentType: string;
  name: string;
  framework: string;
  patterns: string[];
  outputPath: string;
}
