# Cairn 0.12 — Release Context & Behavior Reference

**Purpose**: Reference doc for understanding Cairn 0.12's work-type-aware Auto-Brief routing. Read when:
- Cairn behavior seems unexpected → check if it's by design here before treating as bug
- Onboarding a new collaborator → point them here after they finish `ONBOARDING.md`
- Months from now you want to remember why 0.12 was designed this way

**Scope**: This documents 0.12 behavior, not Cairn's overall philosophy. For onboarding, read `ONBOARDING.md` in the repo root.

---

## 1. What 0.12 added on top of 0.11

| Capability | Status |
|---|---|
| Work-type-aware Auto-Brief routing (4 base modes + 2 retroactive composites) | New in 0.12 |
| InputBox field labels adapt by detected work-type | New in 0.12 |
| Brief markdown gets mode preamble line | New in 0.12 |
| Brief markdown gets composite_notes block (when applicable) | New in 0.12 |
| `cairn.autoBriefFromFile` command — markdown seed via file picker | New in 0.12 |
| `experiments.jsonl` schema | Unchanged (forward-compatible) |
| `method.md` 6 canonical sections | Unchanged (content emphasis shifts, names stable) |
| Brief markdown section headers | Unchanged (canonical `## Hypothesis`, `## Variant`, etc.) |
| Bug fix: `expSummary` now shows existing experiments' `executionMode` to LLM | Side fix in 0.12 |

**Key invariant**: schema is unchanged. All adaptation happens at the **prompt / UI layer**, not the **persisted data layer**. Downstream tools (`cairn.exportTable`, lineage navigation, future Phase 1 features) continue to read canonical fields.

---

## 2. Detected mode taxonomy

Auto-Brief classifies user input into one of 6 `detected_mode` values:

```
ablation                      — default; hypothesis-driven experiment
retroactive                   — logging completed work (no shape signal)
retroactive_infrastructure    — retroactive + build signals
retroactive_codebase          — retroactive + learn signals
infrastructure                — building a component (no comparison)
codebase                      — onboarding to existing code
```

**First-match priority** (top of list wins):

1. **Retroactive** — past-tense + outcome, or explicit "retroactive" keyword
2. **Ablation (explicit)** — comparative signals: "compare", "vs", "benchmark", "outperform", "ablate"
3. **Codebase** — learning verbs: "understand", "explore", "walk through"
4. **Infrastructure** — build verbs: "build", "implement", "DataLoader", "pipeline"
5. **Ablation (default)** — no explicit trigger, hypothesis-style language

**Composite rules**:

- Retroactive + infra → `retroactive_infrastructure` (retroactive defaults + infra emphasis)
- Retroactive + codebase → `retroactive_codebase` (retroactive defaults + codebase emphasis)
- Retroactive + comparative → `retroactive` (standard ablation shape, retroactive defaults)
- Ablation (position 2) + build signals → `ablation` mode + composite_note suggesting separate infra brief
- Codebase + build signals → `codebase` mode + composite_note about exploration scaffolding

---

## 3. What changes per mode

### InputBox field labels

| Mode | Field 1 | Field 2 | Field 3 |
|---|---|---|---|
| ablation | Hypothesis (what is being tested) | Variant (what changes from baseline) | Success criterion (when do we call this a win) |
| retroactive | Hypothesis (what was tested) | Variant (what was run) | Success criterion (historical target) |
| infrastructure | **Purpose** (what this infra enables downstream) | **What's built** (component, interfaces, design) | **Acceptance criteria** (observable signals, not metric thresholds) |
| codebase | **Learning goal** (what you want to be able to explain/modify after) | **Files / modules to explore** | **method.md must contain** (default: module summaries, data flow, key abstractions, gotchas) |

### Brief markdown render

- **Mode preamble line** at the top (before header table):
  - ablation: no preamble
  - retroactive_*: `> **Retroactive registration** — capturing completed work. Agent will not re-run anything.`
  - infrastructure: `> **Infrastructure brief** — success means the component works, not that a hypothesis was confirmed.`
  - codebase: `> **Codebase understanding brief** — deliverable is a useful mental model captured in method.md, not a result.`
- **Composite notes block** (if any composite rule fired):
  ```
  > **Notes:**
  > - <composite note 1>
  > - <composite note 2>
  ```
- **Section headers stay canonical**: `## Hypothesis`, `## Variant`, `## Success Criterion`, etc. Section *content* shifts by mode; *names* don't.

### Auto-applied defaults

- retroactive (any): `execution_mode = human`, `method_label += "-retro"` (defensive — LLM should add but `createBrief.ts` double-checks)
- infrastructure: `execution_mode = agent` (default)
- codebase: `execution_mode = agent` (default)

### method.md section content emphasis (in agent instructions)

The 6 section names don't change. Content emphasis hints are appended to the brief's agent instructions:

| Section | ablation (default) | infrastructure | codebase |
|---|---|---|---|
| Architecture | model layers, training loop | component structure, interfaces, where it plugs in | module overview, per-module 2-3 sentence summary |
| Hyperparameters | training params | configuration parameters, defaults | entry points, how to run/extend |
| What's different from baseline | variant tested | N/A for greenfield; diff if refactor | N/A (onboarding) |
| Design rationale | why this hypothesis | why this design vs alternatives | key abstractions: 3-5 ideas codebase is built around |
| Design decisions | non-default training choices | non-default choices, dependencies | data flow: input → output with shapes/types |
| Notable observations | training surprises | gotchas, edge cases, performance | gotchas + open questions for human |

---

## 4. Two entry points to Auto-Brief

| Entry | Trigger | Input source | Use when |
|---|---|---|---|
| Sparkle ✨ | `cairn.autoBrief` command, sparkle icon in Cairn panel | InputBox (single-line, can paste multi-line) | One-sentence intent; quick brief |
| File 📄 | `cairn.autoBriefFromFile` command, file-text icon | File picker → reads markdown/text/.md/.markdown/.txt file content | You have a structured seed doc (handoff, plan, specification); or input > 500 chars |

Both go through the same LLM prompt + `createBriefCommand` flow. Difference is purely input source. Both trigger markdown seed detection automatically when input exceeds 500 characters or contains `#` headers.

---

## 5. Verified working at ship time

5/5 smoke tests passed end-to-end in real VS Code:

| Test | Input shape | Verified routing |
|---|---|---|
| A | Hypothesis-driven ablation: "Test if [hyperparameter A] beats [hyperparameter B] on [benchmark]" | ablation default; InputBox labels `Hypothesis/Variant/Success criterion`; no preamble |
| B | Build verb + component noun: "Build a [data structure] for [pipeline]" | infrastructure; InputBox `Purpose/What's built/Acceptance criteria`; infra preamble |
| C | Markdown file with retroactive past-tense + outcome | retroactive; method_label suffix `-retro`; execution_mode `human`; retroactive preamble |
| D | Build + learn composite: "Build [component] to understand [system]" | codebase; composite_note about build component as scaffolding |

Plus standalone smoke test against real Claude Opus 4 SDK calls (5/5 detected_mode matched expected).

---

## 6. Known gaps (by design, deferred to 0.13+)

These are **not bugs**. If you hit them, this is expected.

| Gap | Workaround | Tracked for |
|---|---|---|
| No `cairn.importBrief` full command (only file picker via `autoBriefFromFile`) | Use 📄 file picker; for multi-brief batch import, run sequentially | 0.13 if dogfood signal warrants |
| No `cairn.codeRepoPath` setting for dual workspace + code repo | Agent runs `git rev-parse` in its own session cwd (which should be code repo) — Cairn is git-passive by design | Not planned; works as-is |
| No session-level context container (e.g., workspace-level system prompt) | Put session-level notes in workspace root `SESSION_NOTES.md`; mention "read SESSION_NOTES.md first" in agent prompts | 0.13+ candidate |
| No sibling group / branch UI for parallel ablations (`exp_002a/b/c` style) | Use naming convention `exp_002`, `exp_003`, `exp_004` for siblings; record relationship in `notes` field | Phase 2 per roadmap |
| No multi-seed schema | Single experiment per seed; if N seeds, N experiments | Phase 2.1 per roadmap |
| Brief markdown sections stay canonical even when mode is infra/codebase | By design — `## Hypothesis` is canonical; mode emphasis lives in section *content*, not heading | Permanent design choice |
| Status semantics (`failed` vs `inconclusive` distinction) — agent might still mislabel | See ONBOARDING.md → Advanced workflows → Status semantics; review agent's status choice manually | Education-driven, not code-driven |

---

## 7. Possible friction points to watch during dogfood

Predicted based on design + smoke test gaps. If you hit any, **note them as Pass 7+ signals**, don't try to patch live:

1. **Long markdown seed extraction quality** — 0.12 detects markdown seed (>500 chars or `^#\s` header), but LLM's 9-field extraction from long docs (1000+ chars) hasn't been stress-tested. Watch for degraded extraction quality on large seed files.

2. **Composite case underutilization for ablation+build** — Test D verified codebase + build. But ablation + build composite (e.g., "Build X and compare against Y") wasn't in smoke tests. Watch if composite_note actually fires when both signals present.

3. **Method label suffix visibility** — Retroactive composite modes apply `-retro` suffix to `method_label`. Make sure that's visible in the Cairn panel UI without truncation.

4. **`execution_mode = human` for retroactive may confuse routing** — Retroactive auto-sets `human` mode, but the agent still does work (read referenced artifacts → write method.md). The "human" label reflects "no live training", not "no agent involvement". Watch if this confuses session handoff.

5. **Pseudo-retroactive trap** — Describing a planned experiment in past tense by accident ("I'm training X — got 85% accuracy" when you haven't yet) may route to retroactive. Safety belt: use explicit keywords like "Don't run anything" / "log this" / "retroactive" to confirm intent.

6. **Mode invisible in tree view** — Brief preamble lines live inside markdown files, not in `experiments.jsonl`. Tree view shows experiments by id/hypothesis, not by mode. To see mode at a glance, open the brief markdown.

---

## 8. Decision tree when something seems wrong

```
Is the behavior listed in §6 (Known gaps)?
├── Yes → by design, not a bug. Use workaround.
└── No → is it listed in §7 (Friction points to watch)?
         ├── Yes → expected friction, log as Pass 7+ signal for 0.13.
         └── No → potential bug. Capture:
                  - Exact user input that triggered it
                  - Expected behavior (from §3 tables)
                  - Actual behavior (screenshot or text)
                  - detected_mode value in experiments.jsonl
                  - File a GitHub issue or note for follow-up.
```

---

## 9. Quick reference — verifying 0.12 is running

If you suspect 0.12 isn't active and you're seeing 0.11 behavior:

```bash
# Check installed version
code --list-extensions --show-versions | grep cairn
# Expected: su-terry.cairn@0.12.0

# If wrong version, reinstall
code --install-extension /path/to/cairn-0.12.0.vsix --force

# Reload VS Code window
# Cmd/Ctrl+Shift+P → "Developer: Reload Window"
```

UI verification:
- Cairn panel title bar shows 4 icons left-to-right: ✨ 📄 ➕ 🔄
- If only 3 icons (no 📄), reload didn't pick up new code

---

## 10. Source of truth pointers

| Need | Look at |
|---|---|
| What detected_mode means precisely | `src/autoBriefPrompt.ts` Block B section |
| Why InputBox label looks like X for mode Y | `src/createBrief.ts` `getFieldLabels()` |
| Why brief markdown has preamble | `src/createBrief.ts` `renderBrief()` (search "preamble") |
| What's in the LLM prompt | `src/autoBriefPrompt.ts` `buildAutoBriefPrompt()` |
| User-facing workflow guide | `ONBOARDING.md` Step 4 + Advanced workflows |

---

## 11. Roadmap context (for prioritizing Pass 7+ signals)

Locked roadmap (per `docs/architecture.md` / strategic review):

**Phase 1** (paper acceleration, 1-3 mo):
- 1.1 Workspace baseline setup
- 1.2 Report Draft
- 1.3 Export to Paper

**Phase 2** (multi-experiment polish, 3-6 mo):
- 2.1 Multi-seed schema
- 2.2 Sibling group / question
- 2.3 Time-series metrics + artifact reference
- 2.4 Tree view UI
- 2.5 Reviewer comments integration

**Phase 3** (agent-as-researcher, 6-12 mo):
- 3.1 Engineering Discovery Channel
- 3.2 Paper-aware Auto-Brief
- 3.3 Idea exploration with engineering grounding

Dogfood signals route to Pass 7+ backlog within this roadmap, not feature creep outside it.

---

*Cairn 0.12 shipped 2026-05-15. This doc valid until 0.13 changes routing semantics.*