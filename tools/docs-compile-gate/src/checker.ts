/**
 * VD-005 (AC11) — type-checks `compileCheck` fences (Correlate + Verify
 * phase).
 *
 * v1 constraint (documented in README.md): each `compile-check` fence is
 * checked as an INDEPENDENT, self-contained compilation unit. A fence does
 * not see declarations from a sibling fence earlier in the same doc — if a
 * tutorial needs multi-step state, either repeat the setup inside the
 * marked fence or keep that step unmarked (illustrative only).
 *
 * Implementation: every marked fence becomes a synthetic in-memory `.ts`
 * file; a single `ts.Program` is built over all of them sharing one
 * `CompilerHost` that layers the virtual files on top of the REAL
 * filesystem (via `ts.sys`) — so a fence's `import { X } from
 * '@vytches/ddd-aggregates'` resolves through the caller-supplied
 * `compilerOptions.paths` to the actual package source, not a mock.
 */

import ts from 'typescript';

import type { CodeFence, FenceDiagnostic } from './types.js';

export interface CheckerOptions {
  /** Compiler options used to type-check every marked fence. Callers own
   * where these come from — production usage loads the repo's
   * `tsconfig.base.json` (see compiler-options.ts); tests can pass a
   * minimal, hermetic set with no `paths` at all. */
  compilerOptions: ts.CompilerOptions;
}

export interface CheckResult {
  ok: boolean;
  /** Number of `compileCheck` fences actually compiled (0 if the input had
   * none — a clean, non-failing no-op, matching the opt-in design: a repo
   * with zero marked fences is a valid, passing state). */
  checkedCount: number;
  diagnostics: FenceDiagnostic[];
}

const VIRTUAL_ROOT = '/__docs-compile-gate__';

function virtualFileName(fence: CodeFence): string {
  const slug = fence.file
    .replace(/\\/g, '/')
    .replace(/\//g, '__')
    .replace(/\.[^./]+$/, '');
  return `${VIRTUAL_ROOT}/${slug}.fence${fence.index}.ts`;
}

function createVirtualHost(
  compilerOptions: ts.CompilerOptions,
  virtualFiles: ReadonlyMap<string, string>
): ts.CompilerHost {
  const realHost = ts.createCompilerHost(compilerOptions, true);

  return {
    ...realHost,
    fileExists: fileName => virtualFiles.has(fileName) || realHost.fileExists(fileName),
    readFile: fileName => virtualFiles.get(fileName) ?? realHost.readFile(fileName),
    getSourceFile: (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
      const virtualText = virtualFiles.get(fileName);
      if (virtualText !== undefined) {
        return ts.createSourceFile(fileName, virtualText, languageVersionOrOptions, true);
      }
      return realHost.getSourceFile(
        fileName,
        languageVersionOrOptions,
        onError,
        shouldCreateNewSourceFile
      );
    },
  };
}

/** Type-check every `compileCheck` fence in `fences`. Fences without the
 * marker are ignored entirely — they are never even parsed as TypeScript. */
export function checkFences(fences: readonly CodeFence[], options: CheckerOptions): CheckResult {
  const marked = fences.filter(f => f.compileCheck);
  if (marked.length === 0) {
    return { ok: true, checkedCount: 0, diagnostics: [] };
  }

  const virtualFiles = new Map<string, string>();
  const fenceByVirtualPath = new Map<string, CodeFence>();
  for (const fence of marked) {
    const virtualPath = virtualFileName(fence);
    virtualFiles.set(virtualPath, fence.code);
    fenceByVirtualPath.set(virtualPath, fence);
  }

  const host = createVirtualHost(options.compilerOptions, virtualFiles);
  const program = ts.createProgram({
    rootNames: [...virtualFiles.keys()],
    options: options.compilerOptions,
    host,
  });

  const diagnostics: FenceDiagnostic[] = [];
  for (const [virtualPath, fence] of fenceByVirtualPath) {
    const sourceFile = program.getSourceFile(virtualPath);
    if (!sourceFile) {
      diagnostics.push({
        fence,
        message: 'docs-compile-gate: internal error — virtual source file could not be created.',
        line: fence.startLine,
        column: 1,
      });
      continue;
    }

    const fileDiagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];

    for (const diagnostic of fileDiagnostics) {
      diagnostics.push(toFenceDiagnostic(fence, diagnostic));
    }
  }

  // Deterministic order for reporting/tests: by file, then fence index, then line.
  diagnostics.sort(
    (a, b) =>
      a.fence.file.localeCompare(b.fence.file) ||
      a.fence.index - b.fence.index ||
      a.line - b.line ||
      a.column - b.column
  );

  return { ok: diagnostics.length === 0, checkedCount: marked.length, diagnostics };
}

function toFenceDiagnostic(fence: CodeFence, diagnostic: ts.Diagnostic): FenceDiagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

  if (diagnostic.file && diagnostic.start !== undefined) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return {
      fence,
      message,
      // pos.line is 0-based and counts from the fence body's first line —
      // map it back onto the original Markdown file's 1-based line number.
      line: fence.startLine + pos.line,
      column: pos.character + 1,
    };
  }

  return { fence, message, line: fence.startLine, column: 1 };
}
