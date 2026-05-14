import { Experiment } from './types';

export interface AutoBriefDraft {
  hypothesis: string;
  baseline_id: string | null;
  variant: string;
  success_criterion: string;
  execution_mode: 'agent' | 'human';
  completion_checklist: string[];
  method_label: string;
  detected_mode: 'ablation' | 'retroactive' | 'retroactive_infrastructure' | 'retroactive_codebase' | 'infrastructure' | 'codebase';
  composite_notes: string[];
}

export function buildAutoBriefPrompt(
  userInput: string,
  experiments: Experiment[]
): string {
  // Compact existing experiments — give LLM context for choosing baseline
  const expSummary = experiments.length === 0
    ? '(no existing experiments — this would be the first brief)'
    : experiments.map(e => {
        const metrics = Object.entries(e.metrics)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        return `- ${e.id} (${e.method}, ${e.status}, mode=${e.executionMode ?? 'agent'})${metrics ? ': ' + metrics : ''}: ${e.hypothesis}`;
      }).join('\n');

  // Detect markdown seed (long input or structured markdown)
  const isMarkdownSeed = userInput.length > 500 || /^#{1,6}\s/m.test(userInput);
  const markdownSeedNote = isMarkdownSeed
    ? `\nNOTE: The user input below is a long document or structured markdown (not a single sentence). Extract the experiment intent from it — focus on hypothesis, what changes, and success criterion. Ignore document metadata, section headers, and navigation aids.\n`
    : '';

  return `You are helping draft a Cairn experiment brief.

Cairn is a research workflow tool. Briefs capture different kinds of research work — experiments, infrastructure, codebase exploration, or retroactive registration of completed work.

## Status semantics (affects how briefs are framed)

When the user describes existing or completed work, the eventual status will be one of:
- success: all checklist items done AND success criterion met
- partial: all checklist done but criterion not fully met
- inconclusive: some checklist items couldn't be completed (training crashed, env broke)
- failed: completed but criterion clearly refuted (refuted hypothesis is valuable finding)

Critical: inconclusive = "couldn't complete"; failed = "completed but didn't work".

## Work-type detection — first-match ordering

Examine the user input. Determine work-type in this order, first match wins.
At least one explicit trigger signal MUST appear; do not infer from tone.

1. RETROACTIVE — triggers: "retroactive", "retrofit", "register existing", "import",
   "already done", "already ran", "previously", "pre-Cairn", "submitted paper",
   "from my paper", "log this", "record this", "don't run anything", "just document",
   OR past-tense + outcome (numbers, file paths to old logs, "I trained...", "we got...")

2. ABLATION (explicit) — triggers: "compare", "vs", "versus", "against", "benchmark",
   "ablate", "ablation", "baseline comparison", "better than", "outperform", "match", "matches"
   (wins over codebase/infra even if build/learn verbs also present)

3. CODEBASE — triggers: "understand", "onboard", "onboarding", "learn codebase",
   "get familiar with", "explore", "walk through", "read through", "study", "map out",
   "trace through", "how does X work" (X = existing codebase)
   Exclusions: "understand my results" (= ablation analysis); "understand the paper" (= reading task)

4. INFRASTRUCTURE — triggers: "build", "implement", "set up", "wire up", "integrate",
   "data loader", "dataloader", "dataset", "pipeline", "rendering", "renderer",
   "infrastructure", "scaffolding", "scaffold", "build from scratch", "refactor",
   "rewrite", "port", "migrate", "framework", "library", "API integration"

5. ABLATION (default) — hypothesis-driven, no comparative keyword

## Composite rules

RETROACTIVE + infra signals → detected_mode = "retroactive_infrastructure"
  Retroactive defaults (status/execution_mode/-retro suffix/agent instructions) +
  infra field labels + infra content emphasis.
  Composite note: "Retroactive infrastructure documentation — capturing completed build work. Agent will not re-run; it will read referenced artifacts and document in past tense."

RETROACTIVE + codebase signals → detected_mode = "retroactive_codebase"
  Retroactive defaults + codebase field labels + codebase content emphasis.
  Composite note: "Retroactive codebase documentation — capturing past exploration. Agent will summarize from referenced notes/commits rather than re-exploring."

RETROACTIVE + comparative signals → detected_mode = "retroactive"
  Standard ablation shape, retroactive defaults. (Common: NeurIPS-paper-import case)

ABLATION (position 2) + build/implement signals →
  composite_notes += "Comparative experiment detected. Implementation work is treated as setup — if substantial, consider a separate infrastructure brief for it after this experiment completes."

CODEBASE + build/implement signals →
  composite_notes += "Learning goal detected with build component. Implementation is treated as exploration scaffolding — if reusable, consider a separate infrastructure brief after the codebase understanding pass completes."

## Mode-specific guidance

All modes use the 6 canonical method.md sections:
  1. Architecture
  2. Hyperparameters
  3. What's specifically different from baseline
  4. Design rationale
  5. Design decisions worth noting
  6. Notable observations

Mode changes content emphasis within these sections and the brief field interpretation.
The 6 section names are never replaced — this preserves downstream tool compatibility.

### ABLATION (default)
- Field interpretation: hypothesis = falsifiable claim, variant = change from baseline, success_criterion = metric threshold
- 6 sections: standard hypothesis-test framing

### RETROACTIVE
- REQUIRED: explicit outcome signal in user input (numbers, "abandoned", "kept", "outperformed").
  If outcome signal is ABSENT, do NOT invent an outcome. The status field is filled later by the user — your job is just to flag the gap.
  In this case, ADD this composite_note: "Outcome signal missing — please add a numeric result, kept/cut decision, or comparison verdict before this brief is finalized."
- execution_mode: "human"
- method_label: APPEND "-retro" suffix
- Field interpretation: hypothesis = what WAS tested, variant = what WAS run, success_criterion = historical target
- 6 sections: past-tense framing throughout

### INFRASTRUCTURE
- Field interpretation:
    hypothesis → "Purpose" (what this infra enables downstream)
    variant → "What's built" (component, interfaces, design)
    success_criterion → "Acceptance criteria" (observable signals, not metric thresholds)
- 6 section content emphasis:
    1. Architecture — component structure, interfaces, where it plugs in
    2. Hyperparameters — configuration parameters, default values
    3. What's different — N/A for greenfield; diff from existing if refactor
    4. Design rationale — why this design vs alternatives
    5. Design decisions — non-default choices, dependencies
    6. Notable observations — gotchas, edge cases, performance characteristics

### CODEBASE
- Field interpretation:
    hypothesis → "Learning goal" (what user wants to be able to explain/modify after)
    variant → "Files / modules to explore"
    success_criterion → "method.md must contain" (default: "module summaries, data flow, key abstractions, gotchas")
- 6 section content emphasis:
    1. Architecture — module overview, per-module 2-3 sentence summary
    2. Hyperparameters — entry points, how to run/extend
    3. What's different — N/A (onboarding)
    4. Design rationale — key abstractions, 3-5 ideas codebase is built around
    5. Design decisions — data flow, input → output with shapes/types at boundaries
    6. Notable observations — gotchas + open questions for human

## Examples

Example 1 — Retroactive ablation:
User input: "Retroactive: register our spring-mass MLLM run on PhysTwin-Cam1. Test error beat CMA-ES with 4x speedup. Logs at runs/sm_cam1/."
Output:
{
  "detected_mode": "retroactive",
  "composite_notes": [],
  "hypothesis": "MLLM-guided optimization on spring-mass outperforms CMA-ES on PhysTwin-Cam1 single-view.",
  "baseline_id": null,
  "variant": "MLLM Vision loop replacing CMA-ES for parameter search on spring-mass.",
  "success_criterion": "Test error lower than CMA-ES baseline (achieved: 4x speedup, lower error).",
  "execution_mode": "human",
  "completion_checklist": ["Verify logs exist at runs/sm_cam1/", "Extract final metrics from log", "Document params used", "Write methods/exp_NNN.md from artifacts"],
  "method_label": "sm-cam1-mllm-retro"
}

Example 2 — Infrastructure:
User input: "Build a PyTorch DataLoader for the EMPM dataset. Load monocular video sequences, emit (frames, camera_poses, mesh_init) tuples compatible with both spring-mass and MPM solvers."
Output:
{
  "detected_mode": "infrastructure",
  "composite_notes": [],
  "hypothesis": "A unified DataLoader can serve both spring-mass and MPM training pipelines with a single tuple interface.",
  "baseline_id": null,
  "variant": "New PyTorch Dataset wrapping EMPM .npz, emitting (frames, camera_poses, mesh_init) tuples with dual-format dispatch.",
  "success_criterion": "Loads 1000+ samples/sec; integration test passes for both solvers; output shape matches downstream consumers.",
  "execution_mode": "agent",
  "completion_checklist": ["Implement Dataset class", "Add format dispatch logic", "Write integration test for spring-mass path", "Write integration test for MPM path", "Benchmark throughput", "Document in methods/"],
  "method_label": "empm-dataloader-v1"
}

Example 3 — Codebase understanding:
User input: "Understand baseline X's training pipeline — focus on parameter parameterization and loss surface. Look at optim/, loss/, and main training entry to identify retrofit points for our reasoning loop."
Output:
{
  "detected_mode": "codebase",
  "composite_notes": [],
  "hypothesis": "Understanding baseline X's optim/loss structure will reveal retrofit points for the MLLM reasoning loop.",
  "baseline_id": null,
  "variant": "Read-through and structured documentation of optim/, loss/, main training entry.",
  "success_criterion": "method.md contains: module summaries (optim/loss/main), parameter parameterization scheme, loss surface composition, candidate retrofit points.",
  "execution_mode": "agent",
  "completion_checklist": ["Read optim/ end-to-end", "Read loss/ end-to-end", "Trace main training entry", "Identify retrofit candidates", "Write structured methods/ doc", "Flag open questions for PI"],
  "method_label": "baselineX-codebase-onboard"
}

Example 4 — Codebase + build composite:
User input: "Build a data loader to understand baseline X's training pipeline. The DataLoader will tee inputs so I can inspect intermediate tensors as the loss is computed."
Output:
{
  "detected_mode": "codebase",
  "composite_notes": ["Learning goal detected with build component. Implementation is treated as exploration scaffolding — if reusable, consider a separate infrastructure brief after the codebase understanding pass completes."],
  "hypothesis": "Inspecting intermediate tensors during loss computation will reveal baseline X's training pipeline structure.",
  "baseline_id": null,
  "variant": "Build a tee'd DataLoader as exploration scaffolding to read baseline X's optim/loss path.",
  "success_criterion": "method.md contains: data flow with tensor shapes at each step, loss computation order, intermediate tensor inspection findings.",
  "execution_mode": "agent",
  "completion_checklist": ["Implement tee'd DataLoader", "Trace forward pass to loss", "Document tensor shapes at boundaries", "Identify retrofit points", "Write methods/ doc"],
  "method_label": "baselineX-codebase-tee"
}

## Examples (end)

---

Now apply the rules to this real input:

Existing experiments in this workspace:

${expSummary}

The user wants to test:
${markdownSeedNote}
> ${userInput}

For detected_mode, apply the Work-type detection rules above strictly — first match wins, explicit triggers required.

For composite_notes, start with an empty array. Only add notes when:
- A composite rule (above) fires
- Retroactive mode lacks an explicit outcome signal
- You identify a substantive concern the user should know before finalizing the brief

Keep composite_notes terse (each note < 50 words) and emit only when justified.

Draft a brief as a JSON object with all 9 fields (7 standard + detected_mode + composite_notes). Choose baseline_id by matching user intent to existing experiments — pick the one whose metrics this experiment will anchor against. If no obvious parent exists, set baseline_id to null.

For execution_mode, default to "agent" unless the user mentions long training, no GPU, manual control, or the chosen baseline used "human" mode.

Respond with ONLY the JSON object, no preamble or explanation. The JSON must parse with JSON.parse() — no markdown fences, no comments.`;
}

/**
 * Parse the LLM's JSON response into an AutoBriefDraft.
 * Throws if response is malformed.
 */
export function parseAutoBriefDraft(rawResponse: string): AutoBriefDraft {
  // Strip potential markdown fences (LLM sometimes wraps JSON in ```json ... ```)
  let cleaned = rawResponse.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
    const lastFence = cleaned.lastIndexOf('```');
    if (lastFence !== -1) {
      cleaned = cleaned.slice(0, lastFence).trim();
    }
  }

  const obj = JSON.parse(cleaned);

  // Validate required fields
  if (typeof obj.hypothesis !== 'string') throw new Error('Missing or invalid hypothesis');
  if (obj.baseline_id !== null && typeof obj.baseline_id !== 'string') throw new Error('Invalid baseline_id');
  if (typeof obj.variant !== 'string') throw new Error('Missing or invalid variant');
  if (typeof obj.success_criterion !== 'string') throw new Error('Missing or invalid success_criterion');
  if (obj.execution_mode !== 'agent' && obj.execution_mode !== 'human') throw new Error('Invalid execution_mode');
  if (!Array.isArray(obj.completion_checklist)) throw new Error('Missing completion_checklist');
  if (typeof obj.method_label !== 'string') throw new Error('Missing or invalid method_label');

  // Validate new fields for 0.12
  const validModes = ['ablation', 'retroactive', 'retroactive_infrastructure', 'retroactive_codebase', 'infrastructure', 'codebase'];
  if (!validModes.includes(obj.detected_mode)) throw new Error('Invalid detected_mode');
  if (!Array.isArray(obj.composite_notes)) throw new Error('Missing or invalid composite_notes');

  return {
    hypothesis: obj.hypothesis,
    baseline_id: obj.baseline_id,
    variant: obj.variant,
    success_criterion: obj.success_criterion,
    execution_mode: obj.execution_mode,
    completion_checklist: obj.completion_checklist.map((s: any) => String(s)),
    method_label: obj.method_label,
    detected_mode: obj.detected_mode,
    composite_notes: obj.composite_notes.map((s: any) => String(s)),
  };
}
