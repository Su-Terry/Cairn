# Cairn Onboarding

Step-by-step guide for using Cairn on your project. Designed so any
reader (you, your collaborator, or your AI agent) can follow these
steps and complete onboarding without ambiguity.

Last updated for Cairn 0.12.

---

## Step 1: Install Cairn

Cairn ships as a `.vsix` file. There are two ways to install it.

### Option A: Install from `.vsix` (recommended)

If you have access to a packaged `.vsix` (either downloaded from a
GitHub release or shared by the maintainer):

1. Open VS Code.
2. `Cmd+Shift+P` (or `Ctrl+Shift+P`) → `Extensions: Install from VSIX...`
3. Select the `.vsix` file.
4. Reload VS Code if prompted.
5. Click the Cairn icon in the activity bar (left sidebar).

Done. Cairn is ready to use on any folder you open as a workspace.

### Option B: Build from source (for developers)

If you want to modify Cairn or contribute:

Clone the Cairn repo somewhere on your machine:

    git clone https://github.com/Su-Terry/Cairn ~/cairn
    cd ~/cairn
    npm install

Then:

1. Open `~/cairn` in VS Code.
2. Press `F5` to launch a development host (a second VS Code window
   with Cairn loaded as an extension).

The development host is where you'll do your actual work. The original
VS Code window is just for editing Cairn's source code.

## Step 2: Open your project as a Cairn workspace

In the development host:

1. `File → Open Folder` → select your existing project folder.
2. Click "Yes, I trust the authors" when prompted.
3. Click the Cairn icon in the activity bar (left sidebar).

The Cairn panel will show "No experiments yet". This is normal.

Cairn will only create three things in your workspace root when you
start using it: `experiments.jsonl`, `briefs/`, and `methods/`. It
will not modify your existing code, configs, checkpoints, logs, or
any other files.

## Step 3: Decide on execution mode for your first experiment

Cairn supports two execution patterns:

- **Agent mode** (default): the AI agent runs training autonomously.
  Use when training fits in an agent session (minutes to a few hours).
- **Human mode**: the agent designs and prepares code; you run training
  and report results back. Use when training is long (days), needs
  special hardware, or you want manual control.

Most users with limited GPU access or long training cycles should
choose Human mode. You can change modes per experiment.

## Step 4: Create your first brief

### Option A: Auto-Brief (recommended)

Click the sparkle icon (✨) in the Cairn panel title bar. Describe in one sentence what you want to test, and Cairn will draft the brief fields for you using your existing Claude Code session.

Field labels will adapt based on what kind of work you're describing — for example, "Purpose" instead of "Hypothesis" for infrastructure briefs. See [Advanced workflows](#advanced-workflows) for details on the four supported work types (ablation, retroactive, infrastructure, codebase understanding).

Each drafted field is shown as an InputBox you can edit or accept with Enter. Requires `claude` in PATH; if Auto-Brief fails, Cairn falls back to manual mode.

#### Option A.1: Auto-Brief from File (new in 0.12)

For longer specifications — like a handoff document or a structured plan from another session — use the file icon (📄) in the Cairn panel title bar. Cairn opens a file picker, reads your markdown or text file, and uses its content as input to Auto-Brief (instead of a single sentence).

Same field-adaptation logic as Option A. Useful when you've drafted a brief specification elsewhere (e.g., in a note, in a chat with an LLM, or in a paper's appendix) and want to skip retyping.

### Option B: Manual brief

1. In the Cairn panel, click the `+` button.
2. Cairn walks you through 6-7 prompts (depending on whether you
   choose a baseline). These labels are the default for ablation experiments. If you're working on infrastructure (building a component), codebase exploration, or registering completed work retroactively, the labels change to match the work type — but the 7-step flow is the same. See [Advanced workflows](#advanced-workflows). Answer each:
   - **Hypothesis**: what are you testing? (e.g., "PPO with reward
     shaping converges faster on maze")
   - **Baseline**: select "None" if this is your first experiment, or
     select an existing experiment to fork from.
   - **Variant**: what changes vs. baseline? (e.g., "add potential-based
     reward shaping with Manhattan distance to goal")
   - **Success criterion**: when do you call this a win? (e.g., "reaches
     95% success rate in 500k steps, vs baseline's 1M")
   - **Execution mode**: Agent or Human (see Step 3).
   - **Completion checklist**: list concrete things that must be done
     before claiming completion. End with empty input.
   - **Method label**: short name for results table (e.g., "ppo-reward-v1").
3. Cairn creates `briefs/exp_001.md` and adds a row to `experiments.jsonl`.

The brief will include a `## Codebase exploration` section instructing
the agent on how to navigate your workspace.

## Step 5: Hand off to your agent

1. In the Cairn panel, hover over the experiment row.
2. Click the clipboard icon (copy agent prompt).
3. Paste the prompt into Claude Code, Cursor, or your preferred agent.
4. The agent will:
   - Read the brief.
   - Explore the codebase per the brief's protocol.
   - Implement the variant.
   - In Agent mode: run training, write `methods/exp_001.md`, commit,
     and append the result to `experiments.jsonl`.
   - In Human mode: prepare code and give you a command to run; wait
     for you to report results, then write `methods/exp_001.md` and
     guide you to commit + update jsonl.

## Step 6: Verify the result

After the agent claims completion:

1. Open `experiments.jsonl` and check the row for `exp_001`. Status
   should reflect what actually happened (`success`, `partial`,
   `failed`, or `inconclusive`).
2. Open `methods/exp_001.md` and verify all six sections are filled
   (Architecture, Hyperparameters, What is specifically different,
   Design rationale, Design decisions worth noting, Notable observations).
   The six section names are canonical and don't change. What changes is the content emphasis within each section, based on the brief's work type — for example, infrastructure briefs document component interfaces in "Architecture" instead of model layers.
3. If anything is wrong, tell the agent to fix it. The brief is a
   contract; the agent should produce results that match.

## Step 7: Iterate

For your next experiment, repeat Steps 4-6. When creating the brief:

- Choose a previous experiment as the baseline (Q2) so Cairn can
  establish lineage.
- Cairn auto-generates a `## Lineage` section showing the parent chain
  so the agent knows what metrics to anchor against without rerunning
  the baseline.

---

## Advanced workflows

The seven steps above cover the standard ablation experiment flow. Some research work doesn't fit that shape — you might be logging completed work, building infrastructure, or onboarding to a new codebase. Auto-Brief detects these cases from your prompt language and adjusts the brief schema accordingly.

You don't need to learn any special command. Just describe the work naturally and Auto-Brief routes it. The 7-step flow stays the same; the field labels and method.md content emphasis adapt.

### Retroactive registration

Use when you want to log work that's already done — submitted papers, old checkpoints, experiments from before you started using Cairn.

Example prompt:

> Retroactive: register the spring-mass ablation from our paper. We trained on PhysTwin-Cam1 single-view with MLLM-guided optimization. Test error beat CMA-ES with 4x speedup. Logs in ~/paper/runs/sm_cam1/, final checkpoint sm_final.pt.

What Auto-Brief does:
- Detects "Retroactive" + past-tense results → retroactive mode
- Sets `execution_mode=human`, prefixes notes with `Retroactive:`, appends `-retro` to method_label
- Rewrites agent instructions to "capture, don't re-run"
- Agent reads referenced logs and fills method.md from artifacts, not from a fresh training run

Why this exists: you don't want Cairn to think a submitted paper's ablation needs to be re-executed. Retroactive mode tells the agent: this is archaeology, not experimentation.

### Infrastructure / scaffolding briefs

Use when you're building a component (data loader, renderer, evaluator) rather than testing a hypothesis.

Example prompt:

> Build a PyTorch DataLoader for the EMPM dataset. Load monocular video sequences and emit (frames, camera_poses, mesh_init) tuples compatible with both spring-mass and MPM solvers.

What Auto-Brief does:
- Detects "Build" + "DataLoader" → infrastructure mode
- Renames brief field labels in the InputBox:
  - Hypothesis → **Purpose** (what this infra enables downstream)
  - Variant → **What's built** (component, interfaces, design)
  - Success criterion → **Acceptance criteria** (observable signals, not metric thresholds)
- method.md keeps the 6 canonical sections; content emphasis shifts to component structure, configuration parameters, design rationale, and gotchas
- Brief preamble notes: "success means the component works, not that a hypothesis was confirmed"

Why this exists: infrastructure work doesn't have a hypothesis. Forcing it into the ablation schema produces awkward briefs ("hypothesis: the data loader will work"). Infra mode reframes for build work without changing the underlying schema.

### Codebase understanding briefs

Use when onboarding to a new codebase — a baseline you're extending, a paper's released code, or your own old project you've forgotten.

Example prompt:

> Understand baseline X's training pipeline. I need to identify retrofit points for our reasoning loop. Focus on how it parameterizes physical parameters and where the loss surface is computed. Look at optim/, loss/, and the main training entry.

What Auto-Brief does:
- Detects "Understand" + "codebase" semantics → codebase-understanding mode
- Renames brief field labels:
  - Hypothesis → **Learning goal**
  - Variant → **Files / modules to explore**
  - Success criterion → **method.md must contain** (default: module summaries, data flow, key abstractions, gotchas)
- method.md 6 sections shift content focus: module overview, entry points, key abstractions, data flow, gotchas + open questions
- Brief preamble notes: "the deliverable is a useful mental model captured in method.md, not a result"

Why this exists: onboarding is real research effort that deserves capture, but it isn't a hypothesis test. Codebase mode produces a useful artifact — a written mental model — that future experiment briefs can reference.

### Status semantics (applies to all work types)

The `status` field in `experiments.jsonl` uses four values:

- **`success`** — all checklist items completed AND success criterion met
- **`partial`** — all checklist completed but criterion not fully met
- **`inconclusive`** — some checklist items couldn't be completed (e.g., training didn't finish, environment broke, data unavailable)
- **`failed`** — run errored, diverged, OR completed with results clearly refuting the hypothesis

Critical distinction:

- `inconclusive` = "couldn't complete" (incomplete checklist)
- `failed` = "completed but didn't work" (hypothesis refuted with concrete data)

Refuted hypothesis with concrete data is `failed`, not `inconclusive`. The distinction matters:

- `failed` is a valuable finding — lineage children can fork to try alternatives, knowing this direction was tested and didn't pan out
- `inconclusive` flags that the experiment itself needs more work before any conclusion can be drawn

Examples:

- Training crashed at iter 5K with OOM → **`inconclusive`**
- Training completed 300K iters, reached 70% accuracy vs. 95% target → **`failed`** (work finished, hypothesis refuted)
- Data loader built but throughput 50 samples/sec vs. 1000 target → **`partial`** (component works, falls short of acceptance criterion)
- Retroactive registration of pre-Cairn run that reached target → **`success`**

This applies to all work types (ablation, retroactive, infrastructure, codebase). When Auto-Brief detects retroactive mode and the user's prompt lacks an explicit outcome signal, status is left unset and surfaced as a composite note to fill before the brief commits.

### Composite cases

When your prompt mixes signals, Auto-Brief picks one mode by first-match ordering and notes the composition:

- **"Build a new data loader and compare against the existing one"** → comparative signal wins, routes to ablation. The brief preamble notes the build component and suggests logging it as a separate infrastructure brief if substantial.
- **"Build a data loader to understand baseline X's training"** → learning intent wins, routes to codebase. The brief preamble notes the build is treated as exploration scaffolding.
- **"Retroactive: register the data loader I built last week"** → retroactive wins for defaults (status, execution_mode, instructions); method.md uses infra-style content emphasis.

The pattern: one mode owns the brief; the others surface as preamble notes for future split-out if needed.

---

## What Cairn does and does not do

Cairn manages the mechanical parts of your experimental research workflow:
brief creation, agent prompt standardization, metadata recording,
reproducibility metadata, lineage tracking, and basic export.

Cairn does **not**:

- Speed up your training (it's metadata, not compute).
- Write paper narratives or design figures (researcher's judgment).
- Manage datasets or model checkpoints (use DVC, NAS, or similar).
- Handle cross-paper references (use academic citation in your paper file).
- Manage code packages from external repos (use `pip`, `git submodule`,
  `git subtree`, or just `cp -r` — clone what you need into your
  workspace and Cairn treats the workspace as a single codebase).
- Track ad-hoc experiments you ran before adopting Cairn (Cairn starts
  tracking from your first brief).

## Known limitations (as of Cairn 0.12)

- **No multi-seed handling**: if you run N seeds for the same brief,
  you currently store mean/std as single numbers in `metrics`. A native
  multi-seed schema is planned.
- **Subjective criteria are self-judged by the agent**: criteria like
  "visually indistinguishable" are evaluated by the agent itself.
  Future versions may flag subjective criteria for human review.
- **No bulk import**: past experiments must be registered one at a time using retroactive Auto-Brief (see Advanced workflows). Bulk import from a CSV or experiment log directory is not supported.

## When you hit friction

- Open a GitHub issue: `https://github.com/Su-Terry/Cairn/issues`
- Or just message the maintainer directly if you have access.

Friction reports are how Cairn improves. Specific reports
("step 4 baseline picker confused me because X") are more useful than
general ones ("it was hard to use").