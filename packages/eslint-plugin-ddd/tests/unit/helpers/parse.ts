import * as tsParser from '@typescript-eslint/parser';
import type { AstNode } from '../../../src/resolver';

/** Parses TypeScript source into an ESTree `Program` with ranges, like ESLint hands it to rules. */
export function parseProgram(text: string, filePath = '/virtual/src/file.ts'): AstNode {
  return tsParser.parseForESLint(text, {
    filePath,
    sourceType: 'module',
    range: true,
    loc: true,
  }).ast as unknown as AstNode;
}
