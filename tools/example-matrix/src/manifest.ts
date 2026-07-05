/**
 * VD-006a — loads the ONE hand-maintained artifact in this mechanism,
 * `expected-combinations.yaml` (D-4). Everything else (matrix.json,
 * docs/COVERAGE-MATRIX.md) is generated and must never be hand-edited.
 */

import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

import type { ExampleLevel, ExpectedCombination } from './types.js';

const VALID_LEVELS: ReadonlySet<ExampleLevel> = new Set([
  'quick-start',
  'intermediate',
  'advanced',
]);

interface RawManifestEntry {
  name?: unknown;
  level?: unknown;
  packages?: unknown;
  file?: unknown;
  planned?: unknown;
  description?: unknown;
}

/**
 * Parse and validate `expected-combinations.yaml`. Throws with a precise
 * message on any structurally invalid entry — this manifest is small and
 * hand-edited, so fail loudly rather than silently skip a malformed entry.
 */
export function loadManifest(path: string): ExpectedCombination[] {
  const raw = readFileSync(path, 'utf8');
  const parsed = yaml.load(raw);
  return parseManifest(parsed, path);
}

export function parseManifest(parsed: unknown, sourcePath: string): ExpectedCombination[] {
  if (!parsed || typeof parsed !== 'object' || !('combinations' in parsed)) {
    throw new Error(`${sourcePath}: expected a top-level "combinations" list`);
  }

  const combinations = (parsed as { combinations: unknown }).combinations;
  if (!Array.isArray(combinations)) {
    throw new Error(`${sourcePath}: "combinations" must be a list`);
  }

  return combinations.map((entry, index) =>
    parseEntry(entry as RawManifestEntry, index, sourcePath)
  );
}

function parseEntry(
  entry: RawManifestEntry,
  index: number,
  sourcePath: string
): ExpectedCombination {
  const where = `${sourcePath}: combinations[${index}]`;

  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    throw new Error(`${where}: "name" must be a non-empty string`);
  }
  if (typeof entry.level !== 'string' || !VALID_LEVELS.has(entry.level as ExampleLevel)) {
    throw new Error(
      `${where} ("${entry.name}"): "level" must be one of ${[...VALID_LEVELS].join(', ')}`
    );
  }
  if (
    !Array.isArray(entry.packages) ||
    entry.packages.length === 0 ||
    !entry.packages.every(p => typeof p === 'string')
  ) {
    throw new Error(`${where} ("${entry.name}"): "packages" must be a non-empty string list`);
  }
  if (entry.file !== null && typeof entry.file !== 'string') {
    throw new Error(`${where} ("${entry.name}"): "file" must be a string or null`);
  }
  if (entry.planned !== undefined && typeof entry.planned !== 'boolean') {
    throw new Error(`${where} ("${entry.name}"): "planned" must be a boolean if present`);
  }
  if (entry.description !== undefined && typeof entry.description !== 'string') {
    throw new Error(`${where} ("${entry.name}"): "description" must be a string if present`);
  }

  return {
    name: entry.name,
    level: entry.level as ExampleLevel,
    packages: [...(entry.packages as string[])].sort(),
    file: entry.file,
    planned: entry.planned as boolean | undefined,
    description: entry.description as string | undefined,
  };
}
