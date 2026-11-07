import type { ResolverFs } from '../../../src/resolver';

/** In-memory `ResolverFs` that counts how often each file is read and stat-ed. */
export interface MemoryFs extends ResolverFs {
  readonly reads: Map<string, number>;
  readonly stats: Map<string, number>;
  /** Replaces the content of a file and moves its modification time forward. */
  write(path: string, text: string): void;
  totalReads(): number;
}

export function createMemoryFs(initial: Readonly<Record<string, string>>): MemoryFs {
  const files = new Map<string, { text: string; mtimeMs: number }>();
  let clock = 1;
  for (const [path, text] of Object.entries(initial)) files.set(path, { text, mtimeMs: clock });
  const reads = new Map<string, number>();
  const stats = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  return {
    reads,
    stats,
    readFile(path) {
      bump(reads, path);
      return files.get(path)?.text;
    },
    stat(path) {
      bump(stats, path);
      const hit = files.get(path);
      return hit ? { isFile: true, mtimeMs: hit.mtimeMs } : undefined;
    },
    write(path, text) {
      clock += 1;
      files.set(path, { text, mtimeMs: clock });
    },
    totalReads() {
      let sum = 0;
      for (const n of reads.values()) sum += n;
      return sum;
    },
  };
}
