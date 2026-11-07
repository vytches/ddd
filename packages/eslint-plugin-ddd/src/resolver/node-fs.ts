import { readFileSync, statSync } from 'node:fs';
import type { ResolverFs } from './types';

/** Default `ResolverFs` backed by `node:fs`. Errors mean "absent", never thrown. */
export const nodeFs: ResolverFs = {
  readFile(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  },
  stat(path) {
    try {
      const s = statSync(path);
      return { isFile: s.isFile(), mtimeMs: s.mtimeMs };
    } catch {
      return undefined;
    }
  },
};
