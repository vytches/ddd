import type { BindingTarget, RoleName } from '../roles';

/**
 * Loose ESTree-shaped node. The resolver reads ESLint/typescript-estree ASTs, whose TS-specific
 * node types (`TSAsExpression`, `TSClassImplements`, ...) are not part of `@types/estree`.
 */
export interface AstNode {
  type: string;
  range?: readonly [number, number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * File system access used by the resolver; injected so tests need no disk.
 *
 * @beta
 * @since 0.32.0
 */
export interface ResolverFs {
  /** File content, or `undefined` when the file is missing or unreadable. */
  readFile(path: string): string | undefined;
  /** Entry kind and modification time, or `undefined` when the path does not exist. */
  stat(path: string): { readonly isFile: boolean; readonly mtimeMs: number } | undefined;
}

/**
 * A project binding: classes matching it carry `role`. `extends` and `implements` are
 * matched against both clauses of a class alike. A custom `role` may declare library roles it
 * also implies (e.g. a project `AuditedAggregate` implies `Aggregate`).
 *
 * @beta
 * @since 0.32.0
 */
export interface RoleBinding {
  readonly role: RoleName;
  readonly extends?: BindingTarget | readonly BindingTarget[];
  readonly implements?: BindingTarget | readonly BindingTarget[];
  readonly decorator?: BindingTarget | readonly BindingTarget[];
  /** Glob (relative to `cwd`, `/` separators): every class in a matching file gets the role. */
  readonly files?: string;
  readonly implies?: readonly RoleName[];
}

/** @beta @since 0.32.0 */
export type ResolverWarning =
  | { readonly code: 'max-depth'; readonly file: string; readonly name: string }
  | { readonly code: 'tsconfig'; readonly file: string; readonly message: string };

/** @beta @since 0.32.0 */
export interface RoleResolverOptions {
  readonly cwd: string;
  readonly bindings?: readonly RoleBinding[];
  /** tsconfig path relative to `cwd` (default `tsconfig.json`), or `false` to ignore tsconfig. */
  readonly tsconfig?: string | false;
  /** Set to `false` to skip the built-in library vocabulary (default `true`). */
  readonly includeLibraryRoles?: boolean;
  /** Maximum inheritance depth followed through project classes (default 6). */
  readonly maxDepth?: number;
  readonly fs?: ResolverFs;
  readonly onWarning?: (warning: ResolverWarning) => void;
}

/** A class and the roles it carries. */
export interface ClassRoles {
  readonly node: AstNode;
  readonly name: string;
  readonly roles: ReadonlySet<RoleName>;
}

/** @beta @since 0.32.0 */
export type BindingProblemCode =
  | 'empty-binding'
  | 'invalid-glob'
  | 'file-not-found'
  | 'export-not-found';

/** @beta @since 0.32.0 */
export interface BindingProblem {
  readonly code: BindingProblemCode;
  readonly role: RoleName;
  readonly message: string;
}

/** @beta @since 0.32.0 */
export interface RoleResolver {
  /** Roles of every class in `program`. `sourceText` enables the cheap "no class" prefilter. */
  classify(program: AstNode, filename: string, sourceText?: string): readonly ClassRoles[];
  /** Level (i) of config validation: bindings whose file or export cannot be found. */
  checkBindings(): readonly BindingProblem[];
  /** Drops all caches (file contents, negative lookups). Call between independent runs. */
  reset(): void;
  readonly warnings: readonly ResolverWarning[];
}
