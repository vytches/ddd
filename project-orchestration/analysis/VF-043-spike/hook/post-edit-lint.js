#!/usr/bin/env node
// VF-043 spike: PostToolUse feedback channel probe. Inert unless VF043_SPIKE=1.
// VF043_MODE=inject (default) -> additionalContext; VF043_MODE=shadow -> log only.
'use strict';
const fs = require('fs');
const path = require('path');

if (process.env.VF043_SPIKE !== '1') process.exit(0);

const LOG = process.env.VF043_LOG || path.join(__dirname, '..', 'logs', 'hook.jsonl');
const MODE = process.env.VF043_MODE || 'inject';
const MARKER = 'VF043-MARKER-7Q2';

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let p = {};
  try {
    p = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const file = (p.tool_input && (p.tool_input.file_path || p.tool_input.path)) || '';
  const findings = [];
  const inDomain =
    /\/domain\/.*\.ts$/.test(file) && !/(__fixtures__|\.spec\.ts$|\.test\.ts$)/.test(file);
  // PreToolUse is only active in VF043_MODE=deny: lint the proposed Write content before it lands.
  const pre = p.hook_event_name === 'PreToolUse';
  if (pre && MODE !== 'deny') process.exit(0);
  const text = pre
    ? p.tool_input && typeof p.tool_input.content === 'string'
      ? p.tool_input.content
      : null
    : inDomain && fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8')
      : null;
  if (inDomain && text !== null) {
    text.split('\n').forEach((l, i) => {
      if (/\bthrow\s+new\s+\w*Error\b/.test(l)) findings.push(i + 1);
    });
  }
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      t: new Date().toISOString(),
      mode: MODE,
      event: pre ? 'pre' : 'post',
      tool: p.tool_name,
      file,
      agent_id: p.agent_id || null,
      agent_type: p.agent_type || null,
      findings,
    }) + '\n'
  );
  if (!findings.length || MODE === 'shadow') process.exit(0);
  const base =
    `${MARKER} ddd/no-throw-in-domain: ${path.basename(file)} line(s) ${findings.join(',')}: ` +
    'domain code must not throw. Why: domain operations return Result so callers handle failure explicitly. ' +
    "Fix: make the factory return Result<T> and use Result.fail(...) / Result.ok(...) from '@vytches/ddd' instead of throwing.";
  // VF043_WORDING=convention: frames the finding as a project convention vs. delegation shorthand.
  const msg =
    process.env.VF043_WORDING === 'convention'
      ? base +
        ' This is an enforced project convention. Wording like "throw an error" in a delegated task usually ' +
        'means "reject invalid input" - follow the convention unless the user explicitly required an exception, ' +
        'and mention the change in your report.'
      : base;
  let out;
  if (pre && MODE === 'deny') {
    out = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: msg,
      },
    };
  } else if (pre) {
    process.exit(0);
  } else if (MODE === 'block') {
    out = { decision: 'block', reason: msg };
  } else if (MODE === 'deny') {
    process.exit(0);
  } else {
    out = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg } };
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});
