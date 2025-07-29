// Domain primitives package - foundation layer with new optimized config
import { createPackageConfig } from '../utils/build-configs';
export default createPackageConfig(__dirname, {
  packageType: 'foundation',
  bundleStrategy: 'bundle-all',
  jsdocExamples: { 
    enabled: true,
    verbose: true,
    fallbackBehavior: 'error', // Error to see what's wrong
    include: ['**/*.ts'], // Simplified include pattern
    exclude: ['**/*.test.ts', '**/*.spec.ts']
  }
});
