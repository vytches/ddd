import type { CompiledBinding, CompiledTarget } from './compile-bindings';
import { lookupExport, type OriginHost } from './origin';
import type { BindingProblem, ResolverFs } from './types';

interface CheckInput {
  readonly compiled: readonly CompiledBinding[];
  readonly cwd: string;
  readonly fs: ResolverFs;
  readonly host: OriginHost;
}

/**
 * Validation level (i), D11: every project binding must be resolvable. A missing file or a
 * name the file does not export would otherwise leave a rule silently dead.
 */
export function checkBindings({ compiled, fs, host }: CheckInput): BindingProblem[] {
  const problems: BindingProblem[] = [];
  for (const b of compiled) {
    if (!b.raw) continue;
    const role = b.role;
    if (b.bases.length === 0 && b.decorators.length === 0 && b.raw.files === undefined) {
      problems.push({
        code: 'empty-binding',
        role,
        message: `Binding for role "${role}" has no extends, implements, decorator or files entry, so it can never match.`,
      });
    }
    if (b.raw.files !== undefined && b.fileRe === null) {
      problems.push({
        code: 'invalid-glob',
        role,
        message: `Binding for role "${role}" has an invalid files glob: ${b.raw.files}`,
      });
    }
    for (const t of [...b.bases, ...b.decorators]) {
      if (t.kind === 'file') checkFileTarget(role, t, fs, host, problems);
    }
  }
  return problems;
}

function checkFileTarget(
  role: string,
  t: Extract<CompiledTarget, { kind: 'file' }>,
  fs: ResolverFs,
  host: OriginHost,
  problems: BindingProblem[]
): void {
  if (fs.stat(t.file)?.isFile !== true) {
    problems.push({
      code: 'file-not-found',
      role,
      message: `Binding for role "${role}": ${t.from} does not exist.`,
    });
    return;
  }
  if (lookupExport(host, t.file, [t.name], [], 0).length === 0) {
    problems.push({
      code: 'export-not-found',
      role,
      message: `Binding for role "${role}": ${t.from} does not export "${t.name}".`,
    });
  }
}
