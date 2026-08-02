// Events package - architecture layer with new optimized config
import { createArchitectureConfig } from '../utils/build-configs';
// VF-024 (AC4): `internal` is a second build entry backing the
// `@vytches/ddd-events/internal` subpath export (CUSTOM_MIDDLEWARE_SYMBOL) —
// see src/internal.ts.
export default createArchitectureConfig(__dirname, {
  additionalEntries: { internal: 'src/internal.ts' },
});
