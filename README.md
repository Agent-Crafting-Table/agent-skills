# agent-skills

Skill library management for Claude Code agents. Create markdown skill files with YAML frontmatter, auto-generate a searchable INDEX.md, and track invocation outcomes so skills with recurring failures get flagged for refinement.

> Part of [The Agent Crafting Table](https://github.com/Agent-Crafting-Table) — standalone Claude Code agent components.

## The pattern

Skills are reusable procedures your agent has learned — how to fix a specific error, how to run a deployment, how to handle a recurring task. Instead of re-explaining from scratch each session, the agent loads `skills/INDEX.md` (summaries only) at startup and pulls the full skill on demand.

```
skills/
  INDEX.md              ← auto-generated from all skill files
  fix-merge-conflict.md
  deploy-to-staging.md
  recover-db-backup.md
skill-outcomes.json     ← outcome log (auto-created)
```

## Setup

No dependencies — uses only Node.js built-ins.

```bash
node skill-create.js --refresh-index  # initialize INDEX.md
```

Add to your `CLAUDE.md`:
```markdown
**Skills**: Read `skills/INDEX.md` at session start. Load full skill file on-demand when relevant.
After invoking a skill: `node skill-log.js --skill <slug> --outcome success|failure|partial`
```

## Creating skills

```bash
node skill-create.js \
  --name "Fix merge conflict" \
  --summary "Resolve git rebase conflicts when staging branch is behind main" \
  --body "## Steps\n1. git fetch origin\n2. git rebase origin/main\n3. git checkout --theirs . for binary conflicts\n4. git add . && git rebase --continue"

# From stdin
cat my-procedure.md | node skill-create.js --name "Deploy to prod" --summary "Full production deploy"

# Sources: manual, self-healing, session-summary, discord-triage, variant-review
node skill-create.js --name "..." --summary "..." --source self-healing

# Skip if exists
node skill-create.js --name "..." --summary "..." --if-missing

# Rebuild index only
node skill-create.js --refresh-index

# Custom skills directory
node skill-create.js --name "..." --summary "..." --skills-dir /my/agent/skills
```

## Logging outcomes

```bash
node skill-log.js --skill fix-merge-conflict --outcome success
node skill-log.js --skill deploy-to-staging --outcome failure --note "SSH timeout on step 3"
node skill-log.js --skill recover-db-backup --outcome partial --context "partial restore only"

node skill-log.js --report                         # all skills
node skill-log.js --report --skill fix-merge-conflict  # one skill
node skill-log.js --flag-recurring                 # skills with 3+ consecutive failures
```

## Skill file format

```markdown
---
name: Fix merge conflict
summary: Resolve git rebase conflicts when staging branch is behind main
source: manual
created: 2026-04-19
last_used: 2026-04-19
use_count: 1
---

## Steps

1. `git fetch origin`
2. `git rebase origin/main`
...
```
