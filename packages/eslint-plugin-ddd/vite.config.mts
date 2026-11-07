// ESLint plugin package - no runtime dependencies: every bare import (eslint,
// node:fs, ...) is externalized, relative sources are bundled.
import { createPatternConfig } from '../utils/build-configs';

// `agent` is a second build entry backing the `@vytches/eslint-plugin-ddd/agent`
// subpath export (lintText lane for project hooks), kept out of the root barrel.
const baseConfig = createPatternConfig(__dirname, {
  additionalEntries: { agent: 'src/agent/index.ts' },
});

// `src/configs/plugin.ts` reads name/version from `package.json`. The shared config would
// leave that import external (`import pkg from "../package.json"`), which Node rejects in an
// ESM flat config without a `type: "json"` import attribute (ERR_IMPORT_ATTRIBUTE_MISSING).
// Inline the JSON instead, so dist carries plain values and works for ESM and CJS consumers.
const sharedExternal = baseConfig.build?.rollupOptions?.external;
const config = {
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      external:
        typeof sharedExternal === 'function'
          ? (id: string, ...rest: [string | undefined, boolean]) =>
              /(^|\/)package\.json$/.test(id) ? false : sharedExternal(id, ...rest)
          : sharedExternal,
    },
  },
};

// Cold-process measurement (target `perf`) lives outside the `test` gate: it is
// timing-based and unstable under parallel pre-commit runs (VF-043 D17).
export default process.env['DDD_PLUGIN_PERF'] === '1'
  ? { ...config, test: { ...config.test, include: ['tests/perf/**/*.perf.ts'] } }
  : config;
