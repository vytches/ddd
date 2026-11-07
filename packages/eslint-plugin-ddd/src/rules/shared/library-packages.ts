// What counts as a package of the library, by import specifier (never by file layout).

const LIBRARY_SPECIFIER = /^(@vytches\/ddd(?:-[a-z0-9-]+)?)(\/.*)?$/;

/** An import specifier split into the library package and the subpath behind it. */
export interface LibrarySpecifier {
  /** Package name, e.g. `@vytches/ddd-contracts`. */
  readonly pkg: string;
  /** `''` for the package entry, otherwise the subpath with its leading slash (`/internal`). */
  readonly subpath: string;
}

/** Splits `spec` when it names a package of the library (or the `@vytches/ddd` meta-package). */
export function parseLibrarySpecifier(spec: string): LibrarySpecifier | undefined {
  const match = LIBRARY_SPECIFIER.exec(spec);
  if (!match) return undefined;
  return { pkg: match[1] as string, subpath: match[2] ?? '' };
}

/** True for the name of a library package itself (`package.json#name`). */
export function isLibraryPackageName(name: string): boolean {
  const parsed = parseLibrarySpecifier(name);
  return parsed !== undefined && parsed.subpath === '';
}
