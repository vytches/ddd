// Documentation links used by rule metadata and messages (VF-043 AC-MESSAGES).

/** Base URL of the repository tree on the default branch. */
export const REPO_BLOB_URL = 'https://github.com/vytches/ddd/blob/main';

/** URL of the documentation page of a rule (`docs/rules/<rule>.md`); the file must exist. */
export function ruleDocsUrl(rule: string): string {
  return `${REPO_BLOB_URL}/packages/eslint-plugin-ddd/docs/rules/${rule}.md`;
}

/**
 * URL of a heading in a package's `LLMGUIDE.md`.
 *
 * @param pkg directory name under `packages/` (e.g. `utils`)
 * @param anchor GitHub heading anchor without the leading `#` (e.g. `anti-patterns`)
 */
export function guideUrl(pkg: string, anchor: string): string {
  return `${REPO_BLOB_URL}/packages/${pkg}/LLMGUIDE.md#${anchor}`;
}
