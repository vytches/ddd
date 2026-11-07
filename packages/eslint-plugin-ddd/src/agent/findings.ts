import type { Linter } from 'eslint';
import type { AgentFinding, AgentSeverity } from './types';

const RANK: Readonly<Record<AgentSeverity, number>> = { warn: 1, error: 2 };

function toSeverity(value: number): AgentSeverity | undefined {
  if (value === 2) return 'error';
  if (value === 1) return 'warn';
  return undefined;
}

/**
 * Keeps the messages of the plugin's rules (rule id with one of `rulePrefixes`) at or above
 * `minSeverity`. Messages without a rule id (unused directives, parse noise) never pass.
 */
export function toFindings(
  messages: readonly Linter.LintMessage[],
  rulePrefixes: readonly string[],
  minSeverity: AgentSeverity
): readonly AgentFinding[] {
  const out: AgentFinding[] = [];
  for (const m of messages) {
    const ruleId = m.ruleId;
    const severity = toSeverity(m.severity);
    if (!ruleId || severity === undefined || m.fatal) continue;
    if (RANK[severity] < RANK[minSeverity]) continue;
    if (!rulePrefixes.some(prefix => ruleId.startsWith(prefix))) continue;
    out.push({
      ruleId,
      severity,
      message: m.message,
      line: m.line,
      column: m.column,
      ...(m.endLine === undefined ? {} : { endLine: m.endLine }),
      ...(m.endColumn === undefined ? {} : { endColumn: m.endColumn }),
    });
  }
  return out;
}

// Line numbers shift when an agent edits above a pre-existing violation, so identity is the rule
// and the (interpolated) message, counted as a multiset.
const identity = (f: AgentFinding): string => `${f.ruleId}\u0000${f.message}`;

/**
 * Ratchet: the findings in `after` that `before` does not account for. Two identical findings
 * before and three after yield one new finding. Pure; both arguments are left untouched.
 *
 * @beta
 * @since 0.32.0
 */
export function newFindings(
  before: readonly AgentFinding[],
  after: readonly AgentFinding[]
): readonly AgentFinding[] {
  const remaining = new Map<string, number>();
  for (const f of before) remaining.set(identity(f), (remaining.get(identity(f)) ?? 0) + 1);
  const fresh: AgentFinding[] = [];
  for (const f of after) {
    const key = identity(f);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else fresh.push(f);
  }
  return fresh;
}
