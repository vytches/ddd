import type { Linter } from 'eslint';
import type { ConfigIssue } from '../config';

/**
 * Severity of a finding; the lane reports `error` only unless asked for `warn` too.
 *
 * @beta
 * @since 0.32.0
 */
export type AgentSeverity = 'error' | 'warn';

/**
 * One rule violation, reduced to the fields an agent (or a hook) needs.
 *
 * @beta
 * @since 0.32.0
 */
export interface AgentFinding {
  /** Full rule id, e.g. `ddd/no-instanceof-result`. */
  readonly ruleId: string;
  readonly severity: AgentSeverity;
  /** Agent-format message: what is wrong, why, `Fix:` and `See:`. */
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

/**
 * Outcome of one `lintText` call. The library never throws for a bad input file or a bad
 * configuration; it says which of these happened and the project decides what to do (deny,
 * block, inform, ignore).
 *
 * - `ok`: the file was linted; `findings` holds the matching results (possibly none).
 * - `skipped`: the configuration does not cover the file (ignored, or no matching config).
 * - `parse-error`: the text does not parse; no rule ran, so no finding can be trusted either way.
 * - `config-error`: the lane could not run (invalid `settings.ddd`, unresolvable binding, no
 *   parser available, ESLint failed to load the configuration).
 *
 * @beta
 * @since 0.32.0
 */
export type AgentLintResult =
  | { readonly status: 'ok'; readonly findings: readonly AgentFinding[] }
  | { readonly status: 'skipped'; readonly reason: string }
  | {
      readonly status: 'parse-error';
      readonly message: string;
      readonly line?: number;
      readonly column?: number;
    }
  | {
      readonly status: 'config-error';
      readonly message: string;
      /** Present when the cause is an invalid or unresolvable `settings.ddd`. */
      readonly issues?: readonly ConfigIssue[];
    };

/**
 * Anything with a `reset()` that drops cached resolution state (e.g. a settings resolver).
 *
 * @beta
 * @since 0.32.0
 */
export interface Resettable {
  reset(): void;
}

/**
 * Options of {@link createAgentLinter}.
 *
 * @beta
 * @since 0.32.0
 */
export interface AgentLinterOptions {
  /**
   * Flat config the lane lints with, as exported by the project's `eslint.config.*`. When
   * omitted, the lane uses `configs.recommended` with `@typescript-eslint/parser` (optional
   * peer) for `.ts`/`.tsx`/`.mts`/`.cts` files; without that parser the result is `config-error`.
   */
  readonly config?: Linter.Config | readonly Linter.Config[];
  /** Only findings whose rule id starts with one of these are reported. Default `['ddd/']`. */
  readonly rulePrefixes?: readonly string[];
  /** Lowest severity reported. Default `'error'` (warnings never reach the agent). */
  readonly minSeverity?: AgentSeverity;
  /** Project root used to resolve the config and relative file paths. Default `process.cwd()`. */
  readonly cwd?: string;
  /**
   * Whether inline `eslint-disable` comments are ignored. Default `true`: a lane that can be
   * silenced from the file under test is not a gate. The price is that an agent has no way out
   * of a finding it believes is a false positive; set `false` to give it one.
   */
  readonly noInlineConfig?: boolean;
  /**
   * Resolvers whose caches are dropped before every `lintText`, so a file created a moment ago is
   * seen by the next call. Default: the settings resolver the plugin's rules share.
   */
  readonly resettables?: readonly Resettable[];
}

/**
 * A linter bound to one configuration; reuse it across calls to keep ESLint's config warm.
 *
 * @beta
 * @since 0.32.0
 */
export interface AgentLinter {
  /**
   * Lints `text` as if it were the content of `filePath` (absolute, or relative to `cwd`). The
   * file does not have to exist, so a hook can lint the proposed content of a write before it
   * lands.
   */
  lintText(text: string, filePath: string): Promise<AgentLintResult>;
}
