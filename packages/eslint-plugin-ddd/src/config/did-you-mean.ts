/** Levenshtein distance, bounded to short identifiers (settings keys). */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = row;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

/** Closest allowed key within edit distance 2, or `undefined`. */
export function suggestKey(key: string, allowed: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of allowed) {
    const d = distance(key.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}
