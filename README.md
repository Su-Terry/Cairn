# Cairn

A research workflow management tool for AI-assisted experimentation.

Cairn is a VS Code extension that manages the mechanical work of
running experiments — brief creation, agent prompt standardization,
metadata recording, and parallel-safe append-only logging — so that
researchers can spend their time on the parts that need human
judgment.

Designed for three usage tiers:

- **Diligent**: PI uses Cairn UI directly
- **Lazy**: PI describes intent to an LLM, which produces Cairn-ready files
- **Unchained**: An LLM/agent uses Cairn fully autonomously

## Status

Pre-release (0.6). Brief workflow, method recording, parallel safety,
and decision rationale are all shipping. See
[docs/architecture.md](docs/architecture.md) for the design charter
and future direction.

## Concepts

A Cairn workspace is a paper. The workspace contains:

- `experiments.jsonl` — append-only event log of all experiments
- `briefs/exp_NNN.md` — frozen brief for each experiment
- `methods/exp_NNN.md` — implementation notes written by the agent
  after each run
- `paper.md` or `paper.tex` — the paper this workspace is for
  (researcher writes this; Cairn does not impose format)

Cairn does not manage cross-paper relationships, raw datasets, or
paper formatting. Use academic citation, DVC, and LaTeX respectively
for those.

## Quick start

Cairn is currently development-version only. To use it:

1. Clone this repo and run `npm install`
2. Open the repo in VS Code and press F5 to launch an Extension
   Development Host
3. In the dev host, open any folder as your Cairn workspace
4. Click the Cairn icon in the activity bar
5. Click `+` to create a brief — Cairn walks you through 6 prompts
6. Right-click the experiment row → "Copy Agent Prompt"
7. Paste the prompt to your agent (Claude Code, Cursor, etc.)
8. After the agent completes, `experiments.jsonl` and
   `methods/exp_NNN.md` are populated

## Design philosophy

Cairn does the mechanical work; the researcher does the thinking. See
[docs/architecture.md](docs/architecture.md) for the boundary between
Cairn's responsibilities and the researcher's.

## License

MIT — see [LICENSE](LICENSE).