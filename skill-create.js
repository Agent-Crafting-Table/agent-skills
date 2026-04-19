#!/usr/bin/env node
/**
 * skill-create.js — Create a new skill file and refresh the skills index
 *
 * Usage:
 *   node skill-create.js --name "Fix Thing" --summary "One-line summary" --body "Procedure steps..."
 *   node skill-create.js --name "Fix Thing" --summary "One-line" < procedure.md
 *   node skill-create.js --refresh-index
 *
 * Optional flags:
 *   --source <tag>   — where this skill came from (self-healing, session-summary,
 *                      discord-triage, manual). Stored in frontmatter.
 *   --if-missing     — skip silently if the skill already exists (instead of exit 1)
 *   --skills-dir     — path to skills directory (default: ./skills)
 *
 * Skills are stored in <skills-dir>/<slug>.md with YAML frontmatter.
 * INDEX.md is always regenerated from disk after any create to prevent drift.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_SKILLS_DIR = path.join(process.cwd(), 'skills');

const VALID_SOURCES = new Set([
  'self-healing',
  'session-summary',
  'discord-triage',
  'manual',
  'variant-review',
  'unknown',
]);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name')          args.name          = argv[++i];
    if (argv[i] === '--summary')       args.summary       = argv[++i];
    if (argv[i] === '--body')          args.body          = argv[++i];
    if (argv[i] === '--source')        args.source        = argv[++i];
    if (argv[i] === '--skills-dir')    args.skillsDir     = argv[++i];
    if (argv[i] === '--if-missing')    args.ifMissing     = true;
    if (argv[i] === '--refresh-index') args.refreshIndex  = true;
  }
  return args;
}

function readStdin() {
  return new Promise(resolve => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function refreshIndex(skillsDir) {
  if (!fs.existsSync(skillsDir)) {
    console.log(`${skillsDir} does not exist — nothing to index`);
    return 0;
  }

  const files = fs.readdirSync(skillsDir)
    .filter(f => f.endsWith('.md') && f !== 'INDEX.md')
    .sort();

  const entries = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(skillsDir, f), 'utf8');
    const fm = parseFrontmatter(content);
    const summary = fm.summary || '(no summary)';
    entries.push(`- \`${f}\` — ${summary}`);
  }

  const header = `# Skills Index

Reusable procedures auto-extracted from successful complex operations or unusual recoveries.
Load this file at session start (summaries only). Load the full skill file on-demand when relevant.

Auto-generated from skills/*.md. Do not edit by hand — run \`node skill-create.js --refresh-index\` to regenerate.

## Active Skills

`;

  fs.writeFileSync(path.join(skillsDir, 'INDEX.md'), header + entries.join('\n') + '\n');
  console.log(`INDEX.md refreshed — ${entries.length} skill(s) indexed`);
  return entries.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillsDir = args.skillsDir ? path.resolve(args.skillsDir) : DEFAULT_SKILLS_DIR;

  if (args.refreshIndex) {
    refreshIndex(skillsDir);
    return;
  }

  if (!args.name || !args.summary) {
    console.error('Usage: skill-create.js --name "Skill Name" --summary "One-line" [--body "..."] [--source <tag>] [--if-missing] [--skills-dir <path>]');
    console.error('   or: skill-create.js --refresh-index [--skills-dir <path>]');
    process.exit(1);
  }

  const source = args.source || 'manual';
  if (!VALID_SOURCES.has(source)) {
    console.error(`--source must be one of: ${[...VALID_SOURCES].join(', ')}`);
    process.exit(1);
  }

  const body = args.body || (await readStdin()) || '## Steps\n\nTODO: document procedure steps here.';
  const slug = slugify(args.name);
  const today = new Date().toISOString().slice(0, 10);
  const skillFile = path.join(skillsDir, `${slug}.md`);

  if (fs.existsSync(skillFile)) {
    if (args.ifMissing) {
      console.log(`Skill already exists: ${slug}.md — skipping (--if-missing)`);
      refreshIndex(skillsDir);
      return;
    }
    console.error(`Skill already exists: ${skillFile}`);
    console.error('Use --if-missing to skip silently, or delete and re-create.');
    process.exit(1);
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  const content = `---
name: ${args.name}
summary: ${args.summary}
source: ${source}
created: ${today}
last_used: ${today}
use_count: 1
---

${body}
`;
  fs.writeFileSync(skillFile, content);
  console.log(`Created: ${path.relative(process.cwd(), skillFile)} (source: ${source})`);
  refreshIndex(skillsDir);
}

main().catch(e => {
  console.error('skill-create.js error:', e.message);
  process.exit(1);
});
