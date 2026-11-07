# VF-043 Phase 1 dogfood harness

Scratch ESLint 9 flat configs used to run `@vytches/eslint-plugin-ddd` (built
`dist/`) against a checkout of the primary consumer, which itself still uses
ESLint 8 + eslintrc. Read-only: nothing is written to the consumer.
Consumer-specific base-class names are replaced by `ProjectBase*`; adjust the
binding file paths in the configs to the real ones.

```bash
export CONSUMER_DIR=<consumer checkout> REPO_DIR=/opt/projects/vytches-ddd
# rule coverage on the meta-package and aliases (8 cases)
node probe.mjs ./eslint.config.mjs
# full run, JSON output (uses eslint 9 from this repo)
cd $CONSUMER_DIR && node $REPO_DIR/node_modules/eslint/bin/eslint.js -c $REPO_DIR/project-orchestration/analysis/VF-043-phase1-dogfood/eslint.config.mjs 'src/**/*.ts' -f json > out.json
# role resolution counts via a probe rule per role
... same with roles.config.mjs
```

`settings.ddd.tsconfig: 'tsconfig.json'` is required when the consumer imports
through path aliases.
