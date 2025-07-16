/**
 * @llm-summary Contract for c l i config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CLIConfig interface implementing infrastructure service for c l i config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCLIConfig implements CLIConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */

// Core CLI interfaces
export interface CLIConfig {
  debug: boolean;
  outputDir: string;
  templateDir: string;
  projectStructure: ProjectStructure;
  framework: FrameworkType;
  patterns: string[];
  plugins: string[];
}

/**
 * @llm-summary Contract for command functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Command interface implementing infrastructure service for command operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommand implements Command {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
  action: CommandAction;
  examples?: string[];
}

/**
 * @llm-summary Contract for command option functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CommandOption interface implementing infrastructure service for command option operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommandOption implements CommandOption {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: string | boolean;
  required?: boolean;
  choices?: string[];
}

/**
 * @llm-summary Type definition for command action
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * CommandAction type implementing infrastructure service for command action operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CommandAction = {} as CommandAction;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type CommandAction = (args: string[], options: Record<string, any>) => Promise<void>;

// Project structures

/**
 * @llm-summary Type definition for project structure
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ProjectStructure type implementing infrastructure service for project structure operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ProjectStructure = {} as ProjectStructure;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ProjectStructure =
  | 'clean-architecture'
  | 'hexagonal'
  | 'onion'
  | 'modular-monolith'
  | 'microservices'
  | 'custom';

/**
 * @llm-summary Type definition for framework type
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * FrameworkType type implementing infrastructure service for framework type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: FrameworkType = {} as FrameworkType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type FrameworkType = 'nestjs' | 'express' | 'fastify' | 'standalone';

// Template system

/**
 * @llm-summary Contract for template functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Template interface implementing infrastructure service for template operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTemplate implements Template {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Template {
  name: string;
  path: string;
  variables: Record<string, any>;
  conditions?: TemplateCondition[];
}

/**
 * @llm-summary Contract for template condition functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TemplateCondition interface implementing infrastructure service for template condition operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTemplateCondition implements TemplateCondition {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TemplateCondition {
  variable: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'exists';
  value: any;
}

/**
 * @llm-summary Contract for template context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TemplateContext interface implementing infrastructure service for template context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTemplateContext implements TemplateContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TemplateContext {
  [key: string]: any;
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

/**
 * @llm-summary Contract for generator options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * GeneratorOptions interface implementing infrastructure service for generator options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteGeneratorOptions implements GeneratorOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Type definition for component type
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ComponentType type implementing infrastructure service for component type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ComponentType = {} as ComponentType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for workflow step functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * WorkflowStep interface implementing infrastructure service for workflow step operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteWorkflowStep implements WorkflowStep {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  type: WorkflowStepType;
  prompt?: PromptConfig;
  action?: WorkflowAction;
  next?: string | ((context: WorkflowContext) => string);
}

/**
 * @llm-summary Type definition for workflow step type
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * WorkflowStepType type implementing infrastructure service for workflow step type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: WorkflowStepType = {} as WorkflowStepType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type WorkflowStepType = 'prompt' | 'action' | 'decision' | 'completion';

/**
 * @llm-summary Contract for prompt config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * PromptConfig interface implementing infrastructure service for prompt config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePromptConfig implements PromptConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PromptConfig {
  type: 'input' | 'select' | 'multiselect' | 'confirm' | 'password';
  message: string;
  choices?: string[] | ChoiceOption[] | ((context: WorkflowContext) => string[] | ChoiceOption[]);
  default?: any;
  validate?: (input: any) => boolean | string;
}

/**
 * @llm-summary Contract for choice option functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ChoiceOption interface implementing infrastructure service for choice option operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteChoiceOption implements ChoiceOption {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ChoiceOption {
  name: string;
  value: any;
  description?: string;
}

/**
 * @llm-summary Type definition for workflow action
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * WorkflowAction type implementing infrastructure service for workflow action operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: WorkflowAction = {} as WorkflowAction;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type WorkflowAction = (context: WorkflowContext) => Promise<void>;

/**
 * @llm-summary Contract for workflow context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * WorkflowContext interface implementing infrastructure service for workflow context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteWorkflowContext implements WorkflowContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface WorkflowContext {
  [key: string]: any;
  answers: Record<string, any>;
  config: CLIConfig;
  outputPath: string;
}

// Plugin system

/**
 * @llm-summary Contract for plugin functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Plugin interface implementing infrastructure service for plugin operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePlugin implements Plugin {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for analysis result functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * AnalysisResult interface implementing infrastructure service for analysis result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAnalysisResult implements AnalysisResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface AnalysisResult {
  score: number;
  category: AnalysisCategory;
  findings: Finding[];
  recommendations: Recommendation[];
  metrics: Record<string, number>;
}

/**
 * @llm-summary Type definition for analysis category
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * AnalysisCategory type implementing infrastructure service for analysis category operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AnalysisCategory = {} as AnalysisCategory;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type AnalysisCategory =
  | 'domain-compliance'
  | 'performance'
  | 'security'
  | 'architecture'
  | 'complexity';

/**
 * @llm-summary Contract for finding functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Finding interface implementing infrastructure service for finding operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteFinding implements Finding {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Finding {
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

/**
 * @llm-summary Contract for recommendation functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Recommendation interface implementing infrastructure service for recommendation operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRecommendation implements Recommendation {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: string;
}

// Validation types

/**
 * @llm-summary Contract for validation result functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ValidationResult interface implementing infrastructure service for validation result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationResult implements ValidationResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for validation context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ValidationContext interface implementing infrastructure service for validation context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationContext implements ValidationContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ValidationContext {
  projectPath: string;
  outputPath: string;
  framework?: FrameworkType;
  patterns?: string[];
  existingComponents?: ComponentInfo[];
}

/**
 * @llm-summary Contract for component info functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ComponentInfo interface implementing infrastructure service for component info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteComponentInfo implements ComponentInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ComponentInfo {
  name: string;
  type: ComponentType;
  path: string;
  dependencies?: string[];
  exports?: string[];
}

/**
 * @llm-summary Contract for validation rule functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ValidationRule interface implementing infrastructure service for validation rule operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteValidationRule implements ValidationRule {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for prompt suggestion functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * PromptSuggestion interface implementing infrastructure service for prompt suggestion operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePromptSuggestion implements PromptSuggestion {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PromptSuggestion {
  title: string;
  description: string;
  value: string;
  confidence: number;
  reasoning?: string;
}

/**
 * @llm-summary Contract for context aware prompt functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ContextAwarePrompt interface implementing infrastructure service for context aware prompt operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteContextAwarePrompt implements ContextAwarePrompt {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ContextAwarePrompt extends PromptConfig {
  analyzer?: (context: WorkflowContext) => Promise<PromptSuggestion[]>;
  dynamicDefault?: (context: WorkflowContext) => Promise<unknown>;
  conditionalShow?: (context: WorkflowContext) => boolean;
}

/**
 * @llm-summary Contract for smart prompt engine functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * SmartPromptEngine interface implementing infrastructure service for smart prompt engine operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSmartPromptEngine implements SmartPromptEngine {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface SmartPromptEngine {
  analyzeContext: (context: WorkflowContext) => Promise<ProjectAnalysis>;
  generateSuggestions: (
    prompt: ContextAwarePrompt,
    context: WorkflowContext
  ) => Promise<PromptSuggestion[]>;
  adaptPrompt: (prompt: ContextAwarePrompt, context: WorkflowContext) => Promise<PromptConfig>;
  displayAnalysis: (analysis: ProjectAnalysis) => void;
}

/**
 * @llm-summary Contract for project context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ProjectContext interface implementing infrastructure service for project context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectContext implements ProjectContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for project analysis functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ProjectAnalysis interface implementing infrastructure service for project analysis operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectAnalysis implements ProjectAnalysis {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ProjectAnalysis {
  structure: ProjectStructureInfo;
  patterns: DetectedPattern[];
  dependencies: DependencyInfo[];
  frameworks: FrameworkInfo[];
  conventions: NamingConvention[];
  suggestions: ProjectSuggestion[];
}

/**
 * @llm-summary Contract for project structure info functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ProjectStructureInfo interface implementing infrastructure service for project structure info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectStructureInfo implements ProjectStructureInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ProjectStructureInfo {
  hasSourceDir: boolean;
  hasDomainDir: boolean;
  hasApplicationDir: boolean;
  hasInfrastructureDir: boolean;
  hasTestsDir: boolean;
  architecture: 'clean' | 'hexagonal' | 'onion' | 'layered' | 'unknown';
}

/**
 * @llm-summary Contract for detected pattern functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * DetectedPattern interface implementing infrastructure service for detected pattern operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDetectedPattern implements DetectedPattern {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface DetectedPattern {
  name: string;
  confidence: number;
  evidence: string[];
  suggestions: string[];
}

/**
 * @llm-summary Contract for dependency info functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * DependencyInfo interface implementing infrastructure service for dependency info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDependencyInfo implements DependencyInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development';
  category: 'framework' | 'utility' | 'testing' | 'ddd' | 'database' | 'other';
}

/**
 * @llm-summary Contract for framework info functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * FrameworkInfo interface implementing infrastructure service for framework info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteFrameworkInfo implements FrameworkInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface FrameworkInfo {
  name: string;
  version: string;
  capabilities: string[];
  conventions: NamingConvention[];
}

/**
 * @llm-summary Contract for naming convention functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * NamingConvention interface implementing infrastructure service for naming convention operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteNamingConvention implements NamingConvention {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface NamingConvention {
  pattern: string;
  description: string;
  examples: string[];
  confidence: number;
}

/**
 * @llm-summary Contract for project suggestion functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ProjectSuggestion interface implementing infrastructure service for project suggestion operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectSuggestion implements ProjectSuggestion {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ProjectSuggestion {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: 'structure' | 'patterns' | 'dependencies' | 'conventions' | 'testing';
}

/**
 * @llm-summary Contract for command suggestion functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CommandSuggestion interface implementing infrastructure service for command suggestion operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommandSuggestion implements CommandSuggestion {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CommandSuggestion {
  command: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'next-step' | 'improvement' | 'fix' | 'enhancement';
  confidence: number;
}

// Error types

/**
 * @llm-summary CLIError class for c l i error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * CLIError class implementing infrastructure service for c l i error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CLIError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CLIError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CLIError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'CLI_ERROR') {
    super(message);
    this.name = 'CLIError';
    this.code = code;
  }
}

/**
 * @llm-summary ValidationError class for validation error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ValidationError class implementing infrastructure service for validation error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ValidationError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ValidationError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ValidationError extends CLIError {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * @llm-summary TemplateError class for template error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TemplateError class implementing infrastructure service for template error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TemplateError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TemplateError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TemplateError extends CLIError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'TemplateError';
  }
}

/**
 * @llm-summary ConfigError class for config error operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ConfigError class implementing infrastructure service for config error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ConfigError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ConfigError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ConfigError extends CLIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}
