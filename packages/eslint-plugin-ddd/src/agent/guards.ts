import type { AgentLintResult, AgentSeverity } from './types';

/**
 * Narrowed variants of {@link AgentLintResult}, one per `status`.
 *
 * @beta
 * @since 0.32.0
 */
export type AgentLintOk = Extract<AgentLintResult, { readonly status: 'ok' }>;
/** @beta @since 0.32.0 */
export type AgentLintSkipped = Extract<AgentLintResult, { readonly status: 'skipped' }>;
/** @beta @since 0.32.0 */
export type AgentLintParseError = Extract<AgentLintResult, { readonly status: 'parse-error' }>;
/** @beta @since 0.32.0 */
export type AgentLintConfigError = Extract<AgentLintResult, { readonly status: 'config-error' }>;

/**
 * Type guard: is the value a valid {@link AgentSeverity}?
 *
 * @beta
 * @since 0.32.0
 */
export function isAgentSeverity(value: unknown): value is AgentSeverity {
  return value === 'error' || value === 'warn';
}

/**
 * Type guard: the file was linted (`status: 'ok'`); `findings` is available.
 *
 * @beta
 * @since 0.32.0
 */
export function isLintOk(result: AgentLintResult): result is AgentLintOk {
  return result.status === 'ok';
}

/**
 * Type guard: the configuration does not cover the file (`status: 'skipped'`).
 *
 * @beta
 * @since 0.32.0
 */
export function isLintSkipped(result: AgentLintResult): result is AgentLintSkipped {
  return result.status === 'skipped';
}

/**
 * Type guard: the text does not parse (`status: 'parse-error'`).
 *
 * @beta
 * @since 0.32.0
 */
export function isLintParseError(result: AgentLintResult): result is AgentLintParseError {
  return result.status === 'parse-error';
}

/**
 * Type guard: the lane could not run (`status: 'config-error'`).
 *
 * @beta
 * @since 0.32.0
 */
export function isLintConfigError(result: AgentLintResult): result is AgentLintConfigError {
  return result.status === 'config-error';
}
