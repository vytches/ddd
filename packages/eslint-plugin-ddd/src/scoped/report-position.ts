import type { Rule, SourceCode } from 'eslint';

/**
 * Source index of the start of a report, or `undefined` when the descriptor carries neither
 * a location nor a node with a range/location. ESLint itself rejects such a descriptor.
 *
 * Precedence mirrors ESLint's own report translation: an explicit `loc` wins over `node`.
 */
export function reportStartIndex(
  sourceCode: SourceCode,
  descriptor: Rule.ReportDescriptor
): number | undefined {
  if ('loc' in descriptor && descriptor.loc) {
    const loc = descriptor.loc;
    return sourceCode.getIndexFromLoc('start' in loc ? loc.start : loc);
  }
  if ('node' in descriptor && descriptor.node) {
    const range = (descriptor.node as { range?: readonly [number, number] }).range;
    if (range) return range[0];
    const nodeLoc = descriptor.node.loc;
    return nodeLoc ? sourceCode.getIndexFromLoc(nodeLoc.start) : undefined;
  }
  return undefined;
}
