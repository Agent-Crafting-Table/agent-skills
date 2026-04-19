#!/usr/bin/env node
/**
 * skill-log.js — Log skill invocation outcomes so skills can be refined over time
 *
 * Usage:
 *   node skill-log.js --skill <slug> --outcome success
 *   node skill-log.js --skill <slug> --outcome failure --note "reason"
 *   node skill-log.js --skill <slug> --outcome partial --context "<where>"
 *
 *   node skill-log.js --report                 # summary of all skills
 *   node skill-log.js --report --skill <slug>  # one skill detail
 *   node skill-log.js --flag-recurring         # emit slugs needing refinement (3+ consecutive failures)
 *
 * Options:
 *   --skills-dir <path>   — skills directory (default: ./skills)
 *   --outcomes-file <path>— where to write outcomes JSON (default: ./skill-outcomes.json)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_SKILLS_DIR   = path.join(process.cwd(), 'skills');
const DEFAULT_OUTCOMES_FILE = path.join(process.cwd(), 'skill-outcomes.json');

const MAX_INVOCATIONS_PER_SKILL = 100;
const RECURRING_FAILURE_THRESHOLD = 3;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skill')         out.skill        = argv[++i];
    if (a === '--outcome')       out.outcome      = argv[++i];
    if (a === '--note')          out.note         = argv[++i];
    if (a === '--context')       out.context      = argv[++i];
    if (a === '--skills-dir')    out.skillsDir    = argv[++i];
    if (a === '--outcomes-file') out.outcomesFile = argv[++i];
    if (a === '--report')        out.report       = true;
    if (a === '--flag-recurring') out.flagRecurring = true;
  }
  return out;
}

function loadStore(outcomesFile) {
  if (!fs.existsSync(outcomesFile)) return {};
  try { return JSON.parse(fs.readFileSync(outcomesFile, 'utf8')); }
  catch { return {}; }
}

function saveStore(store, outcomesFile) {
  fs.mkdirSync(path.dirname(outcomesFile), { recursive: true });
  fs.writeFileSync(outcomesFile, JSON.stringify(store, null, 2));
}

function skillExists(slug, skillsDir) {
  return fs.existsSync(path.join(skillsDir, `${slug}.md`));
}

function logInvocation({ skill, outcome, context, note }, skillsDir, outcomesFile) {
  if (!skill || !outcome) {
    console.error('Usage: skill-log.js --skill <slug> --outcome success|failure|partial [--note ...] [--context ...]');
    process.exit(1);
  }
  if (!['success', 'failure', 'partial'].includes(outcome)) {
    console.error(`--outcome must be one of: success, failure, partial (got: ${outcome})`);
    process.exit(1);
  }
  if (!skillExists(skill, skillsDir)) {
    console.error(`Warning: skill file not found at ${path.join(skillsDir, skill + '.md')} — logging anyway`);
  }

  const store = loadStore(outcomesFile);
  const now = new Date().toISOString();

  if (!store[skill]) {
    store[skill] = {
      invocations: [],
      success_count: 0,
      failure_count: 0,
      partial_count: 0,
      first_used: now,
      last_used: now,
    };
  }

  store[skill].invocations.push({ ts: now, outcome, context: context || null, note: note || null });
  store[skill].last_used = now;
  store[skill][`${outcome}_count`] = (store[skill][`${outcome}_count`] || 0) + 1;

  if (store[skill].invocations.length > MAX_INVOCATIONS_PER_SKILL) {
    store[skill].invocations = store[skill].invocations.slice(-MAX_INVOCATIONS_PER_SKILL);
  }

  saveStore(store, outcomesFile);
  console.log(`Logged ${outcome} for skill "${skill}" (total: ${store[skill].success_count}✅ / ${store[skill].failure_count}❌ / ${store[skill].partial_count}~)`);
}

function report(slug, outcomesFile) {
  const store = loadStore(outcomesFile);
  const entries = slug ? (store[slug] ? [[slug, store[slug]]] : []) : Object.entries(store);

  if (entries.length === 0) {
    console.log(slug ? `No invocation data for "${slug}"` : 'No skill invocations logged yet');
    return;
  }

  for (const [s, data] of entries) {
    const total = data.success_count + data.failure_count + data.partial_count;
    const successRate = total > 0 ? Math.round(100 * data.success_count / total) : 0;
    const last = data.invocations[data.invocations.length - 1];
    console.log(`\n${s}`);
    console.log(`  invocations: ${total} (${successRate}% success) — ${data.success_count}✅ ${data.failure_count}❌ ${data.partial_count}~`);
    console.log(`  last_used: ${data.last_used} — ${last ? last.outcome : 'n/a'}${last?.note ? ': ' + last.note : ''}`);
  }
}

function flagRecurring(outcomesFile) {
  const store = loadStore(outcomesFile);
  const flagged = [];
  for (const [slug, data] of Object.entries(store)) {
    const recent = data.invocations.slice(-RECURRING_FAILURE_THRESHOLD);
    if (recent.length === RECURRING_FAILURE_THRESHOLD && recent.every(i => i.outcome === 'failure')) {
      flagged.push({
        slug,
        consecutive_failures: RECURRING_FAILURE_THRESHOLD,
        last_notes: recent.map(i => i.note).filter(Boolean),
      });
    }
  }
  for (const f of flagged) {
    console.log(`${f.slug}\t${f.consecutive_failures}\t${f.last_notes.join(' | ')}`);
  }
  if (flagged.length === 0) console.log('# No skills with recurring failures');
}

const args = parseArgs(process.argv.slice(2));
const skillsDir = args.skillsDir ? path.resolve(args.skillsDir) : DEFAULT_SKILLS_DIR;
const outcomesFile = args.outcomesFile ? path.resolve(args.outcomesFile) : DEFAULT_OUTCOMES_FILE;

if (args.flagRecurring) {
  flagRecurring(outcomesFile);
} else if (args.report) {
  report(args.skill, outcomesFile);
} else {
  logInvocation(args, skillsDir, outcomesFile);
}
