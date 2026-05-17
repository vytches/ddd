// Domain primitives - externalizes workspace deps so npm resolves them at runtime
import { createPatternConfig } from '../utils/build-configs';
export default createPatternConfig(__dirname, {
  jsdocExamples: {
    enabled: true,
    verbose: true,
    fallbackBehavior: 'skip',
    include: ['**/*.ts'],
    exclude: ['**/*.test.ts', '**/*.spec.ts'],
  },
});
