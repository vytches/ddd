// Internal barrel of the message layer. Not a public export of the package.
export { guideUrl, REPO_BLOB_URL, ruleDocsUrl } from './docs-links';
export {
  interpolate,
  MESSAGE_OVERRIDES_SCHEMA,
  messageData,
  renderTemplate,
  renderTemplates,
} from './format';
export type { MessageOverrides, MessageSpec } from './format';
export { RULE_MESSAGES } from './catalog';
