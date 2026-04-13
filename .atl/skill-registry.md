# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Creating a GitHub issue, reporting a bug, or requesting a feature | issue-creation | /home/vlongo/.qwen/skills/issue-creation/SKILL.md |
| Creating a pull request, opening a PR, or preparing changes for review | branch-pr | /home/vlongo/.qwen/skills/branch-pr/SKILL.md |
| Creating a new skill, adding agent instructions, or documenting patterns for AI | skill-creator | /home/vlongo/.qwen/skills/skill-creator/SKILL.md |
| "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | judgment-day | /home/vlongo/.qwen/skills/judgment-day/SKILL.md |
| Writing Go tests, using teatest, or adding test coverage | go-testing | /home/vlongo/.qwen/skills/go-testing/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### issue-creation
- Blank issues are disabled — MUST use a template (bug report or feature request)
- Every issue gets `status:needs-review` automatically on creation
- A maintainer MUST add `status:approved` before any PR can be opened
- Questions go to Discussions, not issues
- Pre-flight checkboxes required: no duplicate + understands approval workflow

### branch-pr
- Every PR MUST link an approved issue with `status:approved`
- Every PR MUST have exactly one `type:*` label
- Branch names MUST match: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- Commit messages MUST follow conventional commits regex
- Run shellcheck on modified scripts before pushing
- PR body must contain: linked issue, PR type, summary, changes table, test plan, contributor checklist

### skill-creator
- Skill name: lowercase, hyphens; project-specific: `{project}-{component}`
- SKILL.md required with frontmatter: name, description (includes "Trigger:"), license, metadata.author, metadata.version
- Structure: `skills/{skill-name}/SKILL.md` + optional `assets/` (templates) + `references/` (local docs)
- DO start with critical patterns, use tables for decision trees, keep examples minimal
- DON'T add Keywords section, duplicate docs, lengthy explanations, or troubleshooting sections
- References point to LOCAL files, not web URLs

### judgment-day
- Launch TWO sub-agents in parallel (delegate async) — neither knows about the other
- Both receive identical target + Project Standards block
- Orchestrator synthesizes: Confirmed (both), Suspect A/B (one only), Contradiction (disagree)
- WARNING classification: "real" if normal user can trigger it; "theoretical" otherwise (reported as INFO, not fixed)
- After Fix Agent returns, IMMEDIATELY re-launch both judges — do NOT push/commit before re-judgment
- After 2 fix iterations with remaining issues, ASK user before continuing
- NEVER declare APPROVED until 0 confirmed CRITICALs + 0 confirmed real WARNINGs
- Orchestrator NEVER reviews code itself — only launches judges, reads results, synthesizes

### go-testing
- Table-driven tests are the standard pattern for Go unit tests
- Bubbletea TUI testing: test Model.Update() directly for state changes, use teatest for full flows
- Golden file testing for visual output comparisons — use `t.TempDir()` and `-update` flag
- Test files named `{component}_test.go` alongside source, in same package
- Test organization mirrors source directory structure with `testdata/` for golden files
- Use `t.Run()` for subtests, mock dependencies via interfaces, skip integration with `-short`

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | /media/vlongo/Archivos/Projectos/reloj/AGENTS.md | Index — Next.js agent rules |

### AGENTS.md Content
- Next.js 16.2.3 has breaking changes from standard Next.js — read `node_modules/next/dist/docs/` before writing code
- APIs, conventions, and file structure may all differ from training data
- Heed deprecation notices
