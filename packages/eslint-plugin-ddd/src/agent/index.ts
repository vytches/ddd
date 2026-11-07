// Entry of `@vytches/eslint-plugin-ddd/agent`: the feedback lane for project hooks (VF-043 D13).
// Pure data in, pure data out; no adapters for any agent runtime.
export { createAgentLinter } from './create-agent-linter';
export { newFindings } from './findings';
export {
  isAgentSeverity,
  isLintConfigError,
  isLintOk,
  isLintParseError,
  isLintSkipped,
} from './guards';
export type {
  AgentLintConfigError,
  AgentLintOk,
  AgentLintParseError,
  AgentLintSkipped,
} from './guards';
export type {
  AgentFinding,
  AgentLinter,
  AgentLinterOptions,
  AgentLintResult,
  AgentSeverity,
  Resettable,
} from './types';
