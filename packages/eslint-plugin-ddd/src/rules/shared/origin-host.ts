import { nodeFs } from '../../resolver/node-fs';
import type { OriginHost } from '../../resolver/origin';
import type { ModuleModel } from '../../resolver/module-model';
import { modelFromText } from '../../resolver/scan-model';
import { resolveProjectFile } from '../../resolver/specifier';
import { loadTsconfigPaths, type TsconfigPaths } from '../../resolver/tsconfig';

interface Shared {
  readonly models: Map<string, { readonly mtimeMs: number; readonly model: ModuleModel }>;
  paths: TsconfigPaths | undefined;
}

const shared = new Map<string, Shared>();

/**
 * Drops the caches shared by the rules (file models, tsconfig paths).
 *
 * Limit: the caches are not evicted while the process lives, so memory grows with the number of
 * distinct project files a long-lived process (editor, LSP) resolves; call this to release it.
 */
export function resetOriginCaches(): void {
  shared.clear();
}

/**
 * Origin host for one linted file. Parsed project files and tsconfig `paths` are cached across
 * files (a model is revalidated by modification time); lookups that found nothing are not, so a
 * file created between two runs is seen by the next one.
 */
export function createOriginHost(cwd: string, tsconfig: string | false | undefined): OriginHost {
  const key = `${cwd}\0${tsconfig === undefined ? '' : String(tsconfig)}`;
  let state = shared.get(key);
  if (!state) {
    state = { models: new Map(), paths: undefined };
    shared.set(key, state);
  }
  const cache = state;
  const missing = new Set<string>();
  const specCache = new Map<string, string | undefined>();

  const paths = (): TsconfigPaths =>
    (cache.paths ??= loadTsconfigPaths(cwd, nodeFs, tsconfig, () => undefined));

  return {
    model(file) {
      if (missing.has(file)) return undefined;
      const stat = nodeFs.stat(file);
      if (!stat?.isFile) {
        missing.add(file);
        cache.models.delete(file);
        return undefined;
      }
      const hit = cache.models.get(file);
      if (hit && hit.mtimeMs === stat.mtimeMs) return hit.model;
      const text = nodeFs.readFile(file);
      if (text === undefined) {
        missing.add(file);
        return undefined;
      }
      const model = modelFromText(text);
      cache.models.set(file, { mtimeMs: stat.mtimeMs, model });
      return model;
    },
    resolve(spec, fromFile) {
      return resolveProjectFile(spec, fromFile, paths(), nodeFs, specCache);
    },
  };
}
