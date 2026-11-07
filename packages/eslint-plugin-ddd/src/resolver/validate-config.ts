import { resolve } from 'node:path';
import type { RoleName } from '../roles';
import { nodeFs } from './node-fs';
import { createRoleResolver } from './role-resolver';
import type { AstNode, BindingProblem, RoleResolverOptions } from './types';
import { listSourceFiles } from './walk-files';

/** @beta @since 0.32.0 */
export type ConfigProblem =
  | BindingProblem
  | { readonly code: 'role-matches-nothing'; readonly role: RoleName; readonly message: string };

/** @beta @since 0.32.0 */
export interface ValidateRoleConfigOptions extends RoleResolverOptions {
  /** Files to scan (default: every `.ts`/`.tsx` file under `cwd`, minus build output). */
  readonly files?: readonly string[];
  /** Parser returning an ESTree `Program`; defaults to `@typescript-eslint/parser` (optional peer). */
  readonly parse?: (text: string, filename: string) => AstNode;
}

/** @beta @since 0.32.0 */
export interface ValidateRoleConfigResult {
  readonly ok: boolean;
  readonly problems: readonly ConfigProblem[];
  readonly scannedFiles: number;
  readonly unparsedFiles: number;
}

async function defaultParser(): Promise<(text: string, filename: string) => AstNode> {
  let mod: typeof import('@typescript-eslint/parser');
  try {
    mod = await import('@typescript-eslint/parser');
  } catch {
    throw new Error(
      'validateRoleConfig needs a parser: install @typescript-eslint/parser or pass options.parse.'
    );
  }
  return (text, filename) =>
    mod.parseForESLint(text, {
      filePath: filename,
      sourceType: 'module',
      range: true,
      loc: true,
      ecmaFeatures: { jsx: filename.endsWith('x') },
    }).ast as unknown as AstNode;
}

/**
 * Validation level (ii), D11: for gates and CI, not for per-file hooks. Reports project
 * bindings that cannot be resolved (level i) and project-declared roles that match no class
 * in the scanned files. The built-in vocabulary is never reported.
 *
 * @beta
 * @since 0.32.0
 */
export async function validateRoleConfig(
  options: ValidateRoleConfigOptions
): Promise<ValidateRoleConfigResult> {
  const cwd = resolve(options.cwd);
  const fs = options.fs ?? nodeFs;
  const resolver = createRoleResolver({ ...options, cwd, fs });
  const problems: ConfigProblem[] = [...resolver.checkBindings()];
  const declared = new Set<RoleName>((options.bindings ?? []).map(b => b.role));
  const pending = new Set(declared);
  let scanned = 0;
  let unparsed = 0;
  if (pending.size > 0) {
    const parse = options.parse ?? (await defaultParser());
    for (const file of options.files ?? listSourceFiles(cwd)) {
      if (pending.size === 0) break;
      const abs = resolve(cwd, file);
      const text = fs.readFile(abs);
      if (text === undefined || !/\bclass\b/.test(text)) continue;
      scanned++;
      try {
        for (const c of resolver.classify(parse(text, abs), abs, text)) {
          for (const r of c.roles) pending.delete(r);
        }
      } catch {
        unparsed++;
      }
    }
    for (const role of pending) {
      problems.push({
        code: 'role-matches-nothing',
        role,
        message: `Role "${role}" matches no class in ${scanned} scanned file(s). Check its bindings, or remove the role.`,
      });
    }
  }
  return { ok: problems.length === 0, problems, scannedFiles: scanned, unparsedFiles: unparsed };
}
