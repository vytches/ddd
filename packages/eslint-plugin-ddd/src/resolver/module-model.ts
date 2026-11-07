/**
 * Minimal per-module facts the resolver needs: imports, top-level aliases, top-level classes
 * and interfaces with their heritage, and the export table. Built from an AST (the file being
 * linted) or from source text (every other project file), so both follow the same code path.
 */

/** `path` is the chain of names after the module: `[]` namespace, `['default']`, `['X']`. */
export interface ImportRef {
  readonly source: string;
  readonly path: readonly string[];
}

export interface Alias {
  readonly root: string;
  readonly rest: readonly string[];
}

export interface HeritageRef {
  readonly kind: 'extends' | 'implements' | 'decorator';
  readonly root: string;
  readonly rest: readonly string[];
}

export interface LocalDecl {
  readonly name: string;
  readonly heritage: readonly HeritageRef[];
}

export type ExportEntry =
  | { readonly kind: 'local'; readonly local: string }
  | { readonly kind: 'from'; readonly source: string; readonly path: readonly string[] };

export interface ModuleModel {
  readonly imports: Map<string, ImportRef>;
  readonly aliases: Map<string, Alias>;
  readonly locals: Map<string, LocalDecl>;
  readonly exports: Map<string, ExportEntry>;
  readonly stars: string[];
}

export function emptyModel(): ModuleModel {
  return {
    imports: new Map(),
    aliases: new Map(),
    locals: new Map(),
    exports: new Map(),
    stars: [],
  };
}
