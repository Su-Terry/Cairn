# Cairn Architecture

Design charter for Cairn — a research workflow management tool for
AI-assisted experimentation.

Last updated: 2026-05-10 (after Pass 1-5 + Paper-centric framing)

## What Cairn is

Cairn is a **substrate** for the experimental research workflow. It is
not the research itself, and it does not replace research thinking.

Concretely, Cairn manages:

- The brief that initiates an experiment
- The agent prompt that hands off the brief to an executor
- The metadata trail (status, metrics, commit hash, method file) that
  makes experiments reproducible and queryable
- The lineage between experiments (parent, sibling group, question)
- The artifacts produced (brief.md, method.md, jsonl row)

Cairn is a VS Code extension. It can also be used through file-format
conventions alone (jsonl + markdown), allowing programmatic actors to
participate without the UI.

## Design boundary

Cairn automates the mechanical work of running experiments. It does
not perform research thinking.

**Cairn does (automate):**

1. Brief creation workflow
2. Agent prompt standardization
3. Experiment metadata recording (status, metrics, commit, method file)
4. Parallel safety (jsonl append-only with fold-by-id)
5. Lineage tracking (planned: question, parent, sibling group)
6. Report draft generation (planned: from jsonl + methods/)
7. LaTeX/markdown table export (planned)
8. Cross-experiment query (planned)
9. Decision rationale capture (method.md "Design rationale" section)
10. Workspace navigation (panel UI, tree view)

**Cairn does not (researcher retains):**

1. Deciding hypothesis, variant, or success criterion
2. Interpreting results and writing narrative judgment
3. Planning the next experiment or paper thesis
4. Submission decisions (venue choice, readiness)
5. Paper structure, figure design, story arc
6. Cross-paper citation (use academic citation system, not Cairn)

The principle is: Cairn surfaces raw materials and reduces friction.
Insight stays with the actor.

## Three-tier actor model

Cairn does not assume the actor is human. The same workflow supports
three usage tiers:

| Tier | Actor pattern | Affordance |
|------|--------------|-----------|
| **Diligent** | PI ↔ Cairn directly | UI flows: InputBox prompts, right-click menus, tree view |
| **Lazy** | PI → LLM → Cairn (LLM as intermediary) | LLM produces brief markdown; Cairn imports via command (planned) |
| **Unchained** | LLM/agent ↔ Cairn fully autonomous | Programmatic API: CLI, file conventions (planned) |

All three tiers share the same schema (jsonl + briefs/ + methods/). The
actor varies; the artifact does not.

## Workspace = paper

A workspace is a strict 1:1 mapping to a paper.

- Workspace root contains the paper file (`paper.md`, `paper.tex`, or
  another format chosen by the researcher).
- Cairn does not impose a paper format.
- Experiments inside the workspace serve this one paper.
- Cross-paper references use academic citation in the paper file
  (`\cite{he2015resnet}`), not Cairn-managed dependencies.

Cairn does not manage paper-to-paper relationships. Workspace fork
(e.g., for a follow-up paper) is a future feature; for now, a new paper
means a new workspace.

## Schema overview

Three artifact types, all in the workspace root:

### `experiments.jsonl`

Append-only event log. Multiple lines may share an `id`; readers fold
by id (last entry wins).

Fields (current as of Pass 5):

- `id` — `exp_NNN` format, monotonically assigned
- `date` — ISO 8601
- `hypothesis`, `variant`, `successCriterion`, `completionChecklist`
- `method` — short label for results table (e.g., `dit-s2-wd`)
- `metrics` — flat dict of numbers
- `status` — one of `pending`, `running`, `success`, `partial`,
  `failed`, `inconclusive`
- `notes` — free-form post-run summary
- `brief` — path to brief.md
- `baseline` — id of the direct parent experiment (the experiment this one forks from), if any. Cairn renders a Lineage section in the brief that traverses parent → grandparent → ... recursively, allowing agents to navigate the chain without re-running baselines.
- `methodFile` — path to method.md (Pass 3)
- `commitHash` — git SHA at experiment completion (Pass 3)
- `executionMode` — `agent` (default) or `human`. Determines whether the agent runs training autonomously or hands off to the user. Pass 6-C.
- `config` — path to config used

### `briefs/exp_NNN.md`

Frozen at brief creation. Contains hypothesis, variant, success
criterion, completion checklist, and a 7-step instructions block for
the agent (covering implementation, completion verification, method
file, commit, jsonl update, and append protocol).

### `methods/exp_NNN.md`

Written by the agent after experiment completion. Six required
sections (Pass 3 + Pass 5-B):

1. Architecture
2. Hyperparameters
3. What is specifically different from baseline
4. Design rationale (with explicit justification of any parameter
   choices not dictated by the brief)
5. Design decisions worth noting
6. Notable observations

Sections cannot be omitted; agents write "N/A" if a section does not
apply.

Method files are encouraged to embed paths to key visual artifacts
(sample images, loss curves, comparison plots) using standard markdown
image syntax. This makes the method file self-contained when reading
a report or paper section that references this experiment.

## Append-only protocol

`experiments.jsonl` is treated as an append-only event log.

- Cairn writes use `fs.appendFile` (Linux O_APPEND, atomic up to
  PIPE_BUF for typical row sizes)
- Agents are instructed to append via shell `echo '<json>' >>` and
  explicitly forbidden from using the Edit tool on the file
- Readers fold by id (last entry wins) to compute current state
- Status updates and metric updates produce new rows, not in-place
  mutation

This makes the workflow safe under multi-actor concurrency (verified
via parallel test in Pass 4).

## Future direction

Items below are candidates. Priorities will be revisited as dogfood
surfaces real friction; the order here reflects current best guess
rather than a fixed plan.

### High priority (next dogfood cycle is likely to need these)

- **Sibling group and question layer** — explicit grouping for
  ablation batches (currently rely on naming conventions like
  exp_002a/002b/002c) and the research question being answered by
  a group of experiments. Lineage navigation (parent chain) is
  already shipping as of Pass 6-A; sibling and question are the
  remaining structural concepts.
- **Question layer** — explicit grouping for ablation batches, which
  currently rely on naming conventions (e.g., exp_002a/002b/002c).
- **Baseline reference mechanism** — anchor metrics to a frozen
  baseline run rather than rerunning the baseline in every ablation.
- **Engineering vs scientific criterion split** — separate the
  "implementation passes" check from the "scientific claim holds"
  check; the current single `successCriterion` field conflates them.
- **Artifact linking** — experiments produce visual outputs (sample
  images, loss curves, plots) that currently live on disk without
  being surfaced in the schema. Method files should embed these paths
  via markdown image syntax. Schema may add an explicit `artifacts`
  field listing relevant file paths for queryability. Resolves the
  "data is easy to find, images are hard to view" friction.

### Medium priority (cleanup of known friction)

- **`cairn.importBrief` command** — minimum viable for Lazy tier;
  accepts an LLM-produced markdown brief without going through the
  InputBox flow.
- **CLI / programmatic API** — minimum viable for Unchained tier;
  decouples Cairn from VS Code extension dependency.
- **Report draft generation** — automated dump of jsonl + methods/ to
  a markdown report skeleton, with TL;DR/Setup/Conclusion sections
  left blank for the researcher.
- **Brief clarity for "do not fork training scripts"** — agents have
  twice rationalized this as creating new entry-point files.
  Instruction may need stronger wording or schema-level designation
  of which existing entry point to use.

### Low priority (cosmetic or speculative)

- **Mode hint generic-ization** — current brief mentions Shift+Tab
  for Claude Code 2.0.42; will date as Claude Code evolves.
- **Subjective criterion handling** — agents self-judge subjective
  criteria like "visually indistinguishable" rather than deferring
  to human review. Schema may need to mark which criteria require
  human reviewer sign-off.
- **Workspace fork mechanism** — for paper v2 or splitting a
  rejected paper into two submissions. Edge case for now.
- **Domain-knowledge push-back from agent** — when the brief
  specifies a parameter that violates standard practice, agent
  should surface the conflict before executing. Difficult to
  enforce through prompting alone.

### Out of scope (not Cairn's job)

- Cross-paper citation graph (use academic citation systems)
- Paper formatting / typesetting (use LaTeX, Pandoc, etc.)
- Figure design / teaser figures (researcher's narrative work)
- Code package management (use pip, git submodule, etc.)
- Compute scheduling / GPU allocation (use SLURM, etc.)
- **Data storage and hosting** — Cairn manages metadata (jsonl) and
  narrative (markdown). It does not store raw datasets, model
  checkpoints, or large binary artifacts. Use DVC, NAS, S3, or
  similar for those. Cairn's reproducibility unit is "commit hash +
  reported metrics", not byte-level dataset versioning, by design.

## Versioning

Cairn 0.11 (current as of 2026-05-10) — Pass 1-5 + Pass 6-A + Pass 6-B
+ Pass 6-C + Pass 6-D + Pass 6-E complete; brief workflow, method
recording, parallel safety, decision rationale, lineage navigation,
LaTeX/Markdown table export, human-in-the-loop execution mode,
codebase exploration protocol, and Auto-Brief (LLM-augmented brief
drafting via Claude Agent SDK) all shipping.