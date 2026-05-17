---
'@vytches/ddd-messaging': patch
---

fix(messaging): repair broken declaration file caused by JSDoc inline block
comments

The published `@vytches/ddd-messaging@0.25.0-beta.2` declaration file
(`outbox-repository.interface.d.ts`) contained `/* ... */` inline comments
inside a JSDoc `@example` block. These comments terminated the outer `/** */`
JSDoc block early, causing TypeScript to report:

```
error TS1160: Unterminated template literal
```

**Root cause**: At the time `v0.25.0-beta.2` was tagged, the build pipeline
included an `EnhancedMetadataSystem V2` plugin (`createJSDocExamplesPlugin`)
that auto-generated elaborate JSDoc `@example` blocks with `/* ... */`
placeholder stubs. The plugin has since been disabled; rebuilding from current
source produces clean, safe declaration files.

**Affected file**: `dist/outbox/outbox-repository.interface.d.ts`, line ~244, in
the `saveBatch()` method JSDoc example.

**Fix**: Rebuild from current source (JSDoc plugin is disabled) generates
correct declaration files without the problematic inline block comments.
