# Claude Code plugins for this project

`.claude/settings.json` registers four plugin marketplaces. When you open this
repo in Claude Code and trust the folder, it offers to install the enabled ones.

## Enabled for everyone working on the repo

| Plugin | From | What it does |
|---|---|---|
| frontend-design | anthropics/claude-plugins-official | Better UI/UX output for the app screens |
| security-guidance | anthropics/claude-plugins-official | Warns about risky patterns in code Claude writes |
| code-review | anthropics/claude-plugins-official | Multi-agent PR review (`/code-review`) |
| feature-dev | anthropics/claude-plugins-official | Explore, design, build workflow for features |
| claude-md-management | anthropics/claude-plugins-official | Keeps CLAUDE.md useful |
| task-observer | rebelytics/one-skill-to-rule-them-all | Logs corrections and suggests skill updates. Local files only, you approve every change |

Browse the rest of the official catalogue with `/plugin` (for example `expo`
or `typescript-lsp` once the app stack is settled).

## Registered but NOT enabled (install on your own machine if you want them)

These run background services on your computer and have telemetry on by
default, so they are opt-in per developer rather than switched on for the repo.

### claude-mem (persistent memory across sessions)
- Runs a local worker (auto-installs Bun), stores every tool call and summary
  in `~/.claude-mem`, and uses an extra model call to summarise sessions.
- Anonymous usage analytics are ON by default. Optional cloud sync to cmem.ai.
- Install: `/plugin install claude-mem@thedotmack`, then run
  `npx claude-mem telemetry disable`. Leave Cloud Sync and TeamBrain off.
- Do not use it while handling real child or parent data: it records
  everything Claude reads.

### headroom (token compression proxy)
- Needs the Python CLI: `uv tool install headroom-ai` (or `pip install headroom-ai`).
- Then either `headroom wrap claude` or `/plugin install headroom@headroom-marketplace`.
- Anonymous beacon is ON by default. Disable with `export HEADROOM_TELEMETRY=off`
  (or `DO_NOT_TRACK=1`) in your shell profile.
- Routes your Claude API traffic through a local proxy; compression runs locally.
