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

Pre-release (0.8). Brief workflow, method recording, parallel safety,
decision rationale, lineage navigation, LaTeX/Markdown table export,
and human-in-the-loop execution mode are all shipping. See
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

## Execution modes

Cairn supports two execution patterns for each experiment:

- **Agent mode** (default): The agent runs training autonomously.
  Use when training fits in an agent session (minutes to hours).
- **Human mode**: The agent designs the experiment and prepares the
  code; you run the training and report results back. Use when
  training is long (hours to days), needs special hardware, or you
  want manual control over execution.

The mode is selected when creating each brief. Cairn adapts the
agent prompt and brief instructions accordingly.

## Using Cairn in an existing workspace

Cairn is designed to be added to existing project repositories
without disruption. To use Cairn in an existing project:

1. Open your project folder in VS Code (or in a Cairn dev host —
   see Quick Start below)
2. Click the Cairn icon in the activity bar
3. The panel will show "No experiments yet" — click `+` to create
   your first brief

Cairn only creates three things in your workspace root:
`experiments.jsonl`, `briefs/`, and `methods/`. It does not touch
your existing code, datasets, checkpoints, or other artifacts.

Cairn does not currently import past ad-hoc experiments. Tracking
starts from your first brief; previous work stays in whatever
format you had it in.

## Quick start

Cairn is currently development-version only. To use it:

1. Clone this repo and run `npm install`
2. Open the repo in VS Code and press F5 to launch an Extension
   Development Host
3. In the dev host, open any folder as your Cairn workspace
   (your existing project folder works — see "Using Cairn in an
   existing workspace" above)
4. Click the Cairn icon in the activity bar
5. Click `+` to create a brief — Cairn walks you through 7 prompts
6. Right-click the experiment row → "Copy Agent Prompt"
7. Paste the prompt to your agent (Claude Code, Cursor, etc.)
8. After the agent (or you, in human mode) completes the run,
   `experiments.jsonl` and `methods/exp_NNN.md` are populated

## Design philosophy

Cairn does the mechanical work; the researcher does the thinking. See
[docs/architecture.md](docs/architecture.md) for the boundary between
Cairn's responsibilities and the researcher's.

## License

MIT — see [LICENSE](LICENSE).