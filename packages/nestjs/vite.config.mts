// NestJS adapter - requires SWC instead of esbuild for decorator metadata emission
// esbuild does NOT support emitDecoratorMetadata, which NestJS relies on for DI
import swc from 'unplugin-swc';
import { createArchitectureConfig } from '../utils/build-configs';

const baseConfig = createArchitectureConfig(__dirname);

// Add SWC plugin and disable esbuild for TS files
baseConfig.plugins = [
  // SWC handles TypeScript with full decorator + metadata support
  swc.vite({
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
      target: 'es2020',
    },
  }),
  // Keep existing plugins (DTS generation etc.)
  ...(baseConfig.plugins || []),
];

// Disable esbuild for TS files - let SWC handle them
baseConfig.esbuild = false;

export default baseConfig;
