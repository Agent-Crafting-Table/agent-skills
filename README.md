# agent-skills

Skill library management for Claude Code agents. Create markdown skill files with YAML frontmatter, auto-generate a searchable INDEX.md, and track invocation outcomes so skills with recurring failures get flagged for refinement.

> Part of [The Agent Crafting Table](https://github.com/Agent-Crafting-Table) — standalone Claude Code agent components.

## Drop-in

```bash
# Copy scripts to your agent workspace
cp skill-create.js /your/workspace/scripts/skill-create.js
cp skill-log.js    /your/workspace/scripts/skill-log.js

# Create your skills directory and initialize the index
mkdir -p /your/workspace/memory/skills
node scripts/skill-create.js --refresh-index
```

Add to your `CLAUDE.md` (or `AGENTS.md`):

```markdown
## Skills
- Read `memory/skills/INDEX.md` at session start (summaries only)
- Load the full skill file on-demand when one becomes relevant
- After invoking a skill: `node scripts/skill-log.js --skill <slug> --outcome success|failure|partial`
```

## The pattern

Skills are reusable procedures your agent has learned — how to fix a specific error, how to run a deployment, how to handle a recurring task. Instead of re-explaining from scratch each session, the agent loads `memory/skills/INDEX.md` (summaries only) at startup and pulls the full skill on demand.

```
memory/skills/
  INDEX.md              ← auto-generated from all skill files
  fix-merge-conflict.md
  deploy-to-staging.md
  recover-db-backup.md
data/skill-outcomes.json  ← outcome log (auto-created)
```

## Creating skills

```bash
node scripts/skill-create.js \
  --name "Fix merge conflict" \
  --summary "Resolve git rebase conflicts when staging branch is behind main" \
  --body "## Steps\n1. git fetch origin\n2. git rebase origin/main\n3. git checkout --theirs . for binary conflicts\n4. git add . && git rebase --continue"

# From stdin
cat my-procedure.md | node scripts/skill-create.js --name "Deploy to prod" --summary "Full production deploy"

# Rebuild index only
node scripts/skill-create.js --refresh-index
```

## Logging outcomes

```bash
node scripts/skill-log.js --skill fix-merge-conflict --outcome success
node scripts/skill-log.js --skill deploy-to-staging  --outcome failure --note "npm build failed"
node scripts/skill-log.js --skill recover-db-backup  --outcome partial --context "partial restore only"

# Summary report
node scripts/skill-log.js --report

# Flag skills that keep failing
node scripts/skill-log.js --flag-recurring
```

## Requirements

- Node.js 16+
- Zero runtime dependencies
