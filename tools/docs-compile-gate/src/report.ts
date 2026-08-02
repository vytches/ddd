/**
 * VD-005 (AC11) — human-readable report formatting, mirroring
 * tools/ddd-lint's `formatResult()` grouped-by-file style.
 */

import type { FenceDiagnostic } from './types.js';

export interface RunResult {
  ok: boolean;
  filesScanned: number;
  fencesFound: number;
  fencesChecked: number;
  diagnostics: FenceDiagnostic[];
}

export function formatReport(result: RunResult): string {
  if (result.diagnostics.length === 0) {
    return (
      `docs-compile-gate: clean — scanned ${result.filesScanned} file(s), ` +
      `found ${result.fencesFound} fence(s), type-checked ${result.fencesChecked} ` +
      `marked (\`compile-check\`) fence(s).`
    );
  }

  const grouped = new Map<string, FenceDiagnostic[]>();
  for (const diagnostic of result.diagnostics) {
    const list = grouped.get(diagnostic.fence.file) ?? [];
    list.push(diagnostic);
    grouped.set(diagnostic.fence.file, list);
  }

  const lines: string[] = [];
  for (const [file, fileDiagnostics] of [...grouped.entries()].sort()) {
    lines.push(file);
    for (const diagnostic of fileDiagnostics) {
      lines.push(
        `  ${diagnostic.line}:${diagnostic.column}  fence #${diagnostic.fence.index}  ${diagnostic.message}`
      );
    }
  }

  lines.push('');
  lines.push(
    `docs-compile-gate: ${result.diagnostics.length} error(s) across ${grouped.size} file(s) ` +
      `(${result.fencesChecked}/${result.fencesFound} marked fence(s) checked, ` +
      `${result.filesScanned} file(s) scanned).`
  );

  return lines.join('\n');
}
