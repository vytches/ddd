import { ESLint, type Linter } from 'eslint';
import { configs, PLUGIN_NAMESPACE } from '../configs';
import { resolverFromSettings, type ConfigIssue } from '../config';
import { toFindings } from './findings';
import type { AgentLinter, AgentLinterOptions, AgentLintResult, Resettable } from './types';

const DEFAULT_PREFIXES: readonly string[] = [`${PLUGIN_NAMESPACE}/`];
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const NO_PARSER_HINT =
  'No flat config was given and @typescript-eslint/parser is not installed. ' +
  'Install it or pass `config` (the project eslint.config export) to createAgentLinter.';

function toArray(config: Linter.Config | readonly Linter.Config[]): readonly Linter.Config[] {
  return Array.isArray(config)
    ? [...(config as readonly Linter.Config[])]
    : [config as Linter.Config];
}

async function defaultConfig(): Promise<readonly Linter.Config[]> {
  let parser: unknown;
  try {
    parser = await import('@typescript-eslint/parser');
  } catch {
    throw new Error(NO_PARSER_HINT);
  }
  return [
    {
      files: TS_FILES,
      languageOptions: {
        parser: parser as NonNullable<Linter.Config['languageOptions']>['parser'],
        parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
      },
    },
    configs.recommended,
  ];
}

/** `settings.ddd` problems carried by a thrown error, whichever copy of the class threw it. */
function configIssues(error: unknown): readonly ConfigIssue[] | undefined {
  if (!(error instanceof Error) || error.name !== 'DddConfigError') return undefined;
  const problems = (error as Error & { problems?: unknown }).problems;
  return Array.isArray(problems) ? (problems as readonly ConfigIssue[]) : undefined;
}

function configError(error: unknown): AgentLintResult {
  const issues = configIssues(error);
  const message = error instanceof Error ? error.message : String(error);
  return { status: 'config-error', message, ...(issues === undefined ? {} : { issues }) };
}

/**
 * Creates the lane project hooks use to give a coding agent feedback. It lints text with the
 * project's flat config, keeps only the plugin's own findings at the requested severity, and
 * reports what happened as data (`ok` | `skipped` | `parse-error` | `config-error`). It reads
 * nothing from the agent and decides nothing: whether a finding denies a write, blocks a turn
 * or only informs is the project's hook policy.
 *
 * Lane rules, fixed on purpose: unused-directive reporting is off (it would add rule-less
 * messages), only results whose rule id starts with one of `rulePrefixes` are analysed, and
 * resolver caches are dropped before each call so files created moments ago are found.
 *
 * @beta
 * @since 0.32.0
 */
export function createAgentLinter(options: AgentLinterOptions = {}): AgentLinter {
  const cwd = options.cwd ?? process.cwd();
  const prefixes = options.rulePrefixes ?? DEFAULT_PREFIXES;
  const minSeverity = options.minSeverity ?? 'error';
  const resettables: readonly Resettable[] = options.resettables ?? [resolverFromSettings];
  let eslint: Promise<ESLint> | undefined;

  const build = async (): Promise<ESLint> => {
    const base = options.config === undefined ? await defaultConfig() : toArray(options.config);
    const lane: Linter.Config = {
      linterOptions: {
        reportUnusedDisableDirectives: 'off',
        noInlineConfig: options.noInlineConfig ?? true,
      },
    };
    return new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [...base, lane],
      cache: false,
    });
  };

  // A failed build is not remembered: the next call retries (e.g. after the parser is installed).
  const instance = (): Promise<ESLint> => {
    const pending = (eslint ??= build());
    pending.catch(() => {
      if (eslint === pending) eslint = undefined;
    });
    return pending;
  };

  return {
    async lintText(text, filePath) {
      try {
        const linter = await instance();
        for (const r of resettables) r.reset();
        const results = await linter.lintText(text, { filePath, warnIgnored: false });
        const messages = results.flatMap(r => r.messages);
        if (results.length === 0) {
          return { status: 'skipped', reason: 'The configuration does not cover this file.' };
        }
        const fatal = messages.find(m => m.fatal);
        if (fatal) {
          return {
            status: 'parse-error',
            message: fatal.message,
            line: fatal.line,
            column: fatal.column,
          };
        }
        return { status: 'ok', findings: toFindings(messages, prefixes, minSeverity) };
      } catch (error) {
        return configError(error);
      }
    },
  };
}
