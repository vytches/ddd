/**
 * One problem found in the plugin configuration. `code` is stable and machine-readable;
 * `path` points into `settings.ddd` for shape problems; `role` is set for binding problems.
 *
 * @beta
 * @since 0.32.0
 */
export interface ConfigIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly role?: string;
}

/**
 * Thrown when `settings.ddd` is malformed or a project binding cannot be resolved. Failing
 * loudly is deliberate (D11): a binding that points nowhere would otherwise leave a rule
 * silently dead, which is indistinguishable from a clean codebase.
 *
 * @beta
 * @since 0.32.0
 */
export class DddConfigError extends Error {
  readonly problems: readonly ConfigIssue[];

  constructor(problems: readonly ConfigIssue[]) {
    super(formatMessage(problems));
    this.name = 'DddConfigError';
    this.problems = problems;
  }
}

function formatMessage(problems: readonly ConfigIssue[]): string {
  const lines = problems.map(p => `  - ${p.message}`);
  const noun = problems.length === 1 ? 'problem' : 'problems';
  return `Invalid @vytches/eslint-plugin-ddd configuration (${problems.length} ${noun}):\n${lines.join('\n')}`;
}
