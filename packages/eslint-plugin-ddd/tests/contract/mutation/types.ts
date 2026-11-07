import type { RuleName } from '../../../src';

/**
 * One mutation: a tiny project (files on disk) and the file the rule runs on. `violation` cases
 * must be reported exactly `expected` times, `valid` cases must not be reported at all.
 */
export interface MutationCase {
  readonly id: string;
  readonly rule: RuleName;
  readonly kind: 'violation' | 'valid';
  /** Shape of the reference to the library symbol (direct import, alias, facade, cast, ...). */
  readonly variant: string;
  /** Project files, relative path to text. Written to a fresh directory per case. */
  readonly files: Readonly<Record<string, string>>;
  /** The file that is linted. */
  readonly entry: string;
  /** Number of reports expected from `rule` on `entry` (0 for valid cases). */
  readonly expected: number;
}

/** Result of running the corpus: anything non-empty is a defect of the plugin (or of the corpus). */
export interface SuiteReport {
  readonly total: number;
  readonly violations: number;
  readonly valid: number;
  /** Violation cases the rule did not report (or reported the wrong number of times). */
  readonly missed: readonly string[];
  /** Valid cases the rule reported. */
  readonly falseAlarms: readonly string[];
  /** Cases whose entry file did not parse: the case itself is broken. */
  readonly parseErrors: readonly string[];
}
