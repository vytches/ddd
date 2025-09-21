#!/usr/bin/env node

/**
 * Rollup configuration for bundling TypeScript declarations for meta-packages
 * Uses rollup-plugin-dts to bundle all type definitions into single files
 */

import path from 'path';
import dts from 'rollup-plugin-dts';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const config = [
  // Bundle @vytches/ddd (enterprise meta-package)
  {
    input: path.join(rootDir, 'packages/enterprise/src/index.ts'),
    output: [{ 
      file: path.join(rootDir, 'packages/enterprise/dist/index.d.ts'), 
      format: 'es' 
    }],
    plugins: [
      dts({
        respectExternal: false,
        compilerOptions: {
          paths: {
            '@vytches/ddd-*': ['./packages/*/src/index.ts']
          }
        }
      })
    ],
  }
];

export default config;