// Enterprise meta-package - thin re-export layer
// This package should NOT bundle dependencies, only re-export them
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
      // Transform paths to use package names instead of relative paths
      afterBuild: async () => {
        const fs = await import('fs');
        const path = await import('path');
        
        const indexDtsPath = path.resolve(__dirname, 'dist/index.d.ts');
        if (fs.existsSync(indexDtsPath)) {
          let content = fs.readFileSync(indexDtsPath, 'utf-8');
          
          // Replace relative paths with package names
          content = content.replace(/from '\.\.\/\.\.\/([^\/]+)\/src\/index\.ts'/g, "from '@vytches/ddd-$1'");
          content = content.replace(/from "\.\.\/\.\.\/([^\/]+)\/src\/index\.ts"/g, 'from "@vytches/ddd-$1"');
          
          fs.writeFileSync(indexDtsPath, content);
        }
      },
    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDD',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      // CRITICAL: All @vytches/ddd-* packages must be EXTERNAL
      // This creates a thin re-export layer instead of bundling everything
      external: id => {
        // External all workspace dependencies
        if (id.startsWith('@vytches/ddd-')) return true;
        
        // External all npm packages (uuid, etc.)
        if (!id.startsWith('.') && !id.startsWith('/')) return true;
        
        // Bundle only local files
        return false;
      },
      output: {
        // Preserve the export structure
        preserveModules: false,
        // Use named exports
        exports: 'named',
      },
    },
    sourcemap: false,
    target: 'ES2020',
    emptyOutDir: true,
    // Minimize the re-export layer
    minify: false, // Keep readable for debugging
  },
});