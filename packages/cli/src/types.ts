// Core CLI interfaces - simplified for JSDoc v2 and Repomix integration

export interface CLIConfig {
  debug: boolean;
  outputDir: string;
  templateDir: string;
  projectStructure: ProjectStructure;
  framework: FrameworkType;
  patterns: string[];
  plugins: string[];
}

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
  action: CommandAction;
  examples?: string[];
}

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: string | boolean;
  required?: boolean;
  choices?: string[];
}

export type CommandAction = (args: string[], options: Record<string, unknown>) => Promise<void>;

// Project structures

export type ProjectStructure =
  | 'clean-architecture'
  | 'hexagonal'
  | 'onion'
  | 'modular-monolith'
  | 'microservices'
  | 'custom';

export type FrameworkType = 'nestjs' | 'express' | 'fastify' | 'standalone';

// Template system

export interface Template {
  name: string;
  path: string;
  variables: Record<string, unknown>;
  conditions?: TemplateCondition[];
}

export interface TemplateCondition {
  variable: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'exists';
  value: unknown;
}

export interface TemplateContext {
  [key: string]: unknown;
  // Standard context variables (optional for flexibility)
  name?: string;
  className?: string;
  fileName?: string;
  packageName?: string;
  projectStructure?: ProjectStructure;
  framework?: FrameworkType;
  timestamp?: string;
  author?: string;
}

// Generator types

export interface GeneratorOptions {
  name: string;
  type: ComponentType;
  outputPath: string;
  template?: string;
  framework?: FrameworkType;
  patterns?: string[];
  interactive?: boolean;
  dryRun?: boolean;
}

export type ComponentType =
  | 'aggregate'
  | 'entity'
  | 'value-object'
  | 'specification'
  | 'policy'
  | 'command'
  | 'query'
  | 'event'
  | 'handler'
  | 'repository'
  | 'service'
  | 'middleware'
  | 'processor'
  | 'saga'
  | 'projection';

// Workflow system

// Simplified workflow types (legacy compatibility)
export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
}

// WorkflowContext simplified
export interface WorkflowContext {
  [key: string]: unknown;
}

// Plugin system

export interface Plugin {
  name: string;
  version: string;
  description: string;
  commands?: Command[];
  templates?: Template[];
  workflows?: WorkflowStep[];
  generators?: GeneratorOptions[];
}

// Analysis types

export interface AnalysisResult {
  score: number;
  category: AnalysisCategory;
  findings: Finding[];
  recommendations: Recommendation[];
  metrics: Record<string, number>;
}

export type AnalysisCategory =
  | 'domain-compliance'
  | 'performance'
  | 'security'
  | 'architecture'
  | 'complexity';

export interface Finding {
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: string;
}

// Validation types

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  metadata?: {
    componentType?: ComponentType;
    componentName?: string;
    projectContext?: ProjectContext;
    confidence?: number;
  };
}

export interface ValidationContext {
  projectPath: string;
  outputPath: string;
  framework?: FrameworkType;
  patterns?: string[];
  existingComponents?: ComponentInfo[];
}

export interface ComponentInfo {
  name: string;
  type: ComponentType;
  path: string;
  dependencies?: string[];
  exports?: string[];
}

export interface ValidationRule {
  name: string;
  description: string;
  validate: (
    name: string,
    context: ValidationContext,
    projectContext: ProjectContext
  ) => Promise<{
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }>;
}

// Context-aware prompt types

export interface PromptSuggestion {
  title: string;
  description: string;
  value: string;
  confidence: number;
  reasoning?: string;
}

export interface ContextAwarePrompt {
  type: string;
  message: string;
  analyzer?: (context: any) => Promise<PromptSuggestion[]>;
  dynamicDefault?: (context: any) => Promise<unknown>;
  conditionalShow?: (context: any) => boolean;
}

export interface SmartPromptEngine {
  analyzeContext: (context: any) => Promise<ProjectAnalysis>;
  generateSuggestions: (prompt: ContextAwarePrompt, context: any) => Promise<PromptSuggestion[]>;
  adaptPrompt: (prompt: ContextAwarePrompt, context: any) => Promise<ContextAwarePrompt>;
  displayAnalysis: (analysis: ProjectAnalysis) => void;
}

export interface ProjectContext {
  hasAggregates: boolean;
  hasEntities: boolean;
  hasValueObjects: boolean;
  hasEvents: boolean;
  hasCommands: boolean;
  hasQueries: boolean;
  hasRepositories: boolean;
  hasCommandHandlers: boolean;
  hasQueryHandlers: boolean;
  hasEventBus: boolean;
  hasEntityId: boolean;
  hasCQRS: boolean;
  hasReadModels: boolean;
  hasTypeORM: boolean;
  frameworks: string[];
  followsNamingConvention: boolean;
}

export interface ProjectAnalysis {
  structure: ProjectStructureInfo;
  patterns: DetectedPattern[];
  dependencies: DependencyInfo[];
  frameworks: FrameworkInfo[];
  conventions: NamingConvention[];
  suggestions: ProjectSuggestion[];
}

export interface ProjectStructureInfo {
  hasSourceDir: boolean;
  hasDomainDir: boolean;
  hasApplicationDir: boolean;
  hasInfrastructureDir: boolean;
  hasTestsDir: boolean;
  architecture: 'clean' | 'hexagonal' | 'onion' | 'layered' | 'unknown';
}

export interface DetectedPattern {
  name: string;
  confidence: number;
  evidence: string[];
  suggestions: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development';
  category: 'framework' | 'utility' | 'testing' | 'ddd' | 'database' | 'other';
}

export interface FrameworkInfo {
  name: string;
  version: string;
  capabilities: string[];
  conventions: NamingConvention[];
}

export interface NamingConvention {
  pattern: string;
  description: string;
  examples: string[];
  confidence: number;
}

export interface ProjectSuggestion {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: 'structure' | 'patterns' | 'dependencies' | 'conventions' | 'testing';
}

export interface CommandSuggestion {
  command: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'next-step' | 'improvement' | 'fix' | 'enhancement';
  confidence: number;
}

// Error types

export class CLIError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'CLI_ERROR') {
    super(message);
    this.name = 'CLIError';
    this.code = code;
  }
}

export class ValidationError extends CLIError {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class TemplateError extends CLIError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'TemplateError';
  }
}

export class ConfigError extends CLIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}
