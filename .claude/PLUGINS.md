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

## Also enabled: claude-mem and headroom (need local setup)

Both are switched on in `settings.json`. `settings.json` also sets
`DO_NOT_TRACK=1`, `CLAUDE_MEM_TELEMETRY=0`, `HEADROOM_TELEMETRY=off` and
`HEADROOM_BEACON=off`, so their analytics stay off in sessions started from this repo.

### claude-mem (persistent memory across sessions)
- First run auto-installs Bun and starts a local worker. Data stays in
  `~/.claude-mem` on your machine. If the hooks complain, run `npx claude-mem doctor`.
- It records every tool call Claude makes and summarises it with an extra
  model call. Do not use it while handling real child or parent data.
- Keep Cloud Sync and TeamBrain OFF (both are opt-in). For extra safety also run
  `npx claude-mem telemetry disable` once, since the env vars only apply inside
  Claude Code sessions.

### headroom (token compression proxy)
- The plugin only works once the CLI is installed on your machine:
  `uv tool install headroom-ai` (or `pip install headroom-ai`). Without it the
  hook prints a warning and does nothing.
- For full compression launch Claude with `headroom wrap claude`
  (undo with `headroom unwrap claude`).
- Add `export HEADROOM_TELEMETRY=off` to your shell profile so the beacon also
  stays off when you run `headroom` outside Claude Code.

## Added from the reel: Supabase, Vercel, Chrome DevTools MCP, oh-my-claudecode

| Plugin | From | Needs on your side |
|---|---|---|
| supabase | claude-plugins-official | Sign in to Supabase when Claude first uses it. Use a dev project, never one with real child data. |
| vercel | claude-plugins-official | Sign in to Vercel when Claude first uses it. |
| chrome-devtools-mcp | claude-plugins-official | Node.js and Google Chrome installed. It opens and controls a Chrome window. |
| oh-my-claudecode | Yeachan-Heo/oh-my-claudecode | Node.js. Optional `omc` CLI and tmux for its multi-CLI "team" mode. |

### Things to know about oh-my-claudecode
- Very heavy: it adds about 30 hooks (every prompt, tool call, stop and
  compaction), its own MCP server and many agents and skills. It changes how
  Claude behaves in every session in this repo.
- It has a `PermissionRequest` hook that auto-approves Bash commands it
  considers safe, so you will see fewer permission prompts than you expect.
- `/ask codex`, `/ask gemini` and `omc team` send your code to other AI
  providers (OpenAI, Google, etc.). Do not use them on anything with real
  user data.
- If sessions feel slow or noisy, turn it off in `.claude/settings.json` by
  setting `"oh-my-claudecode@omc": false`.
