# Cairn 0.13 — Dogfood Notes

**Date**: 2026-05-16
**Triggered by**: First end-to-end dogfood of Cairn 0.13.0 + 0.13.1 (Tree UI + mode-aware agent prompt scaffolding) on a real research workspace.
**Purpose**: Record Cairn behavior observations during dogfood for Pass 7+ retrospective triage.

This doc is **anonymous-review safe** — no paper-specific terms, no codebase-specific identifiers. Generic Cairn UX observations only.

---

## Context

Cairn 0.13 shipped on 2026-05-15 with two changes:
- **0.13.0** — `experimentsProvider.getChildren()` is tree-aware; `baseline_id` forms expandable parent-child structure. Circular refs detected and promoted to root.
- **0.13.1** — `copyAgentPrompt.ts` detects brief mode from blockquote preamble marker; 6 detected_mode values → 4 templates (ablation / retroactive / infrastructure / codebase).

Dogfood scenario: a real research workspace using Cairn for first time, exercising:
- Auto-Brief from File (a 0.12 feature, dogfooded with a long markdown seed)
- Tree UI lineage rendering (root experiment + children)
- Mode-aware agent prompt (codebase mode brief produced an "explore and document" prompt instead of the legacy ablation-flavoured one)
- Empty-commit anchor pattern (codebase mode brief made no code changes)
- jsonl append-only row update

---

## Observations

### 1. Half-feature release exposed (RESOLVED in 0.13.1)

**Observation**: 0.12 introduced work-type-aware Auto-Brief routing — `createBrief.ts` produces different brief content + InputBox labels for ablation / retroactive / infrastructure / codebase modes. But `copyAgentPrompt.ts` was not updated in 0.12; it stayed mode-naive (always emitted ablation-flavoured agent prompts).

The dogfood caught this when a codebase-mode brief produced an agent prompt that said "Please implement the experiment" — wrong tone for read-only codebase exploration.

**Resolution**: 0.13.1 added mode-aware agent prompt scaffolding. Already addressed.

**Pass 7+ takeaway**: Process retrospective — when shipping a mode-aware feature, audit ALL downstream code that consumes the mode (agent prompt, export table, anything else) and ship them together. Half-feature releases hide bugs until dogfood.

### 2. Agent missed reading workspace-level policy doc (MEDIUM)

**Observation**: When an agent executed the brief, it produced the expected method.md and committed correctly, but its `experiments.jsonl` append-row missed a workspace-policy-required field. The brief markdown contains brief-specific instructions but does NOT reference or embed workspace-level policy docs. The agent only sees what's in `briefs/exp_NNN.md`.

This means: PIs who put policy requirements in a separate `DECISIONS.md` or similar workspace-level doc will see agents bypass those requirements unless the brief explicitly references them.

**Pass 7+ candidate options**:
- (a) Cairn brief renders auto-embed a workspace-level policy summary section
- (b) Agent prompt template adds "before claiming completion, read DECISIONS.md / policy docs in workspace root" instruction
- (c) jsonl schema validation in Cairn — warn if required fields missing (would need a way to specify what's required)

Recommendation: (b) is lightest, (c) is most robust. Worth Pass 7+ discussion.

### 3. Parallel implementations invalidate single-callsite assumption (HIGH)

**Observation**: A brief was auto-generated assuming "one callsite to refactor". The codebase actually had TWO parallel implementations of the same concept (production path and legacy/modular path). Cairn brief auto-generation does not surface this complexity; it assumes a single implementation per concept.

In real codebases, parallel paths (legacy / production / experimental) are common. Brief auto-generation that assumes single implementation can produce briefs that are technically wrong about scope.

**Pass 7+ candidate**: Future Cairn versions could:
- Make Brief -1 (codebase) results visible BEFORE Brief 0+ auto-brief generation, so PI can manually disambiguate target path
- Or: Brief auto-generation prompt could ask "are there multiple implementations to choose from?" and require PI input

Either approach is medium-effort. Worth Pass 7+ discussion.

### 4. Codebase mode validates onboarding design (POSITIVE)

**Observation**: Brief -1 (codebase mode) discovered a "dead parameter" — a constructor argument that existed but was never connected to the logic it was supposed to control. Without prior codebase understanding, a downstream brief that depended on that parameter would have hit the surprise mid-execution.

The codebase mode brief surfacing this BEFORE downstream briefs start = real value. Validates the design of work-type-aware routing where codebase brief produces a reference doc for downstream briefs.

**Pass 7+ takeaway**: Codebase mode is genuinely useful. Continue investing in it for 0.14+ (e.g., onboarding sub-tree feature).

### 5. Pre-existing dirty working tree warning (HIGH, generic)

**Observation**: PIs often have dirty working trees in their code repos (uncommitted ad-hoc development). The first brief that runs `git add -A && git commit` will sweep all pre-existing dirty state into that brief's commit, breaking the "diff = brief work only" contract.

Cairn doesn't currently warn about this — the agent runs `git add -A` without knowing what was pre-existing vs new.

**Pass 7+ candidate**:
- Cairn agent prompt could include "if `git status` shows pre-existing dirty state, ask PI before committing"
- Or: Cairn could surface a warning in the Cairn panel when a workspace's linked code repo is dirty

Easy to add, prevents real damage. High value / low effort.

### 6. Cross-machine dev install gap (LOW, OS-level)

**Observation**: VS Code extension installed via `code --install-extension` is per-machine. Same SSH user on a different machine sees the old version. No automatic cross-sync.

Not a Cairn bug — this is how VS Code extensions work outside the Marketplace.

**Pass 7+ category**: ONBOARDING.md should clarify "install Cairn on each dev machine separately". One-line doc fix.

### 7. jsonl auto-refresh missing (LOW, deferred feature)

**Observation**: Cairn's TreeView does not watch `experiments.jsonl` for external file changes. When agent (or PI) appends a row via `echo >>`, the panel doesn't update until manual refresh icon click.

Reasonable choice for 0.13 (lightweight philosophy). But for 0.14+ it's a small feature that improves UX during agent execution monitoring.

**Pass 7+ category**: Feature candidate. Effort estimate ~30 min (fs.watch on `experiments.jsonl` + `provider.refresh()`).

---

## Pass 7+ retrospective input summary

For two-week-out triage with the design-review chat session:

| Signal | Severity | Disposition |
|---|---|---|
| 1 — half-feature release (RESOLVED in 0.13.1) | RESOLVED | Process retrospective only |
| 2 — agent missed workspace policy doc | MEDIUM | 0.14+ feature candidate (option b/c) |
| 3 — parallel implementations assumption | HIGH | Future feature: PI review checkpoint between briefs |
| 4 — codebase mode validates design | POSITIVE | Continue investing |
| 5 — pre-existing dirty tree | HIGH | Agent prompt addition (low effort) |
| 6 — cross-machine install | LOW | ONBOARDING.md doc fix |
| 7 — jsonl auto-refresh | LOW | 0.14+ feature candidate |

---

*Generated 2026-05-16 from first end-to-end dogfood of Cairn 0.13. Generic UX observations only — no project-specific details.*