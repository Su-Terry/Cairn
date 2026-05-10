# Cairn Quickstart: Lab6 (WGAN + LDM) Entry

Step-by-step guide for trying Cairn on NYCU DLP 2024 Lab6 (WGAN +
Latent Diffusion Model). Designed as a low-stakes entry to learn
Cairn workflow before applying it to your real research project.

Estimated time: 1-2 hours per ablation cycle, half a day to one day
for the full 4-5 ablation series.

Last updated for Cairn 0.11.

---

## Step 1: Install Cairn

We're on the same server, so the vsix is already there.

1. SSH into the server, open a fresh folder in VS Code (this will be
   your Cairn workspace).
2. `Cmd+Shift+P` (or `Ctrl+Shift+P`) → `Extensions: Install from VSIX...`
3. Pick: `/home/oceanic/Cairn/cairn-0.11.0.vsix`
4. Reload VS Code if prompted.
5. Click the Cairn icon in the activity bar (left sidebar) to verify
   installation. The panel should show "No experiments yet".

## Step 2: Set up Lab6 codebase

Clone the reference codebase as your starting point:

    cd ~
    git clone https://github.com/KJLdefeated/NYCU_DLP_2024 cairn-lab6-test
    cd cairn-lab6-test/Lab6

Open `~/cairn-lab6-test/Lab6` as your VS Code workspace.

Read the Lab6 README to orient yourself: what scripts run training,
what configs control hyperparameters, what models exist.

## Step 3: Verify Claude Code is logged in

Cairn's Auto-Brief feature uses your existing Claude Code session.

In a terminal, run:

    claude --version

If `claude` is in your PATH and you've run `claude login` previously,
Auto-Brief will work. If not, you can still create briefs manually.

## Step 4: Create your first brief — LDM baseline

1. In the Cairn panel, click the sparkle icon (✨ Auto-Brief) in the
   title bar.
2. Describe in one sentence: `LDM baseline on Lab6 dataset, default config`
3. Wait 5-15 seconds for Cairn to draft the 7 fields.
4. Cairn shows you 7 InputBox/QuickPick prompts pre-filled with the
   LLM's draft. Review each and Enter to accept, or edit and Enter:
   - **Hypothesis**: what you're testing
   - **Baseline**: select "None" (this is the first experiment)
   - **Variant**: what changes vs baseline
   - **Success criterion**: when do we call this a win
   - **Execution mode**: Agent or Human (see below)
   - **Method label**: short name (e.g., "ldm-baseline")

For Lab6, **execution mode = Agent** is fine if you have GPU and the
training fits in an agent session (~1-2 hr). Otherwise pick Human.

Cairn creates `briefs/exp_001.md` and adds a row to `experiments.jsonl`.

## Step 5: Hand off to Claude Code

1. In the Cairn panel, hover over the `exp_001` row.
2. Click the clipboard icon to copy the agent prompt.
3. Paste it into Claude Code.
4. The agent reads the brief, explores the Lab6 codebase, runs
   training (Agent mode) or prepares code for you to run (Human mode),
   and writes `methods/exp_001.md`.

Press `Shift+Tab` in Claude Code to enable auto-accept edits if you
want a hands-off run.

## Step 6: Verify the result

After the agent claims completion:

1. Check `experiments.jsonl` — the row for `exp_001` should have
   status (`success` / `partial` / `failed` / `inconclusive`) and
   metrics filled in.
2. Check `methods/exp_001.md` — six sections should be filled
   (Architecture, Hyperparameters, What is specifically different,
   Design rationale, Design decisions worth noting, Notable observations).
3. If anything looks wrong, tell the agent to fix it.

## Step 7: Create three more briefs as ablations

Repeat Step 4-6 for each, but in Step 4 select **`exp_001`** as the
baseline so Cairn establishes the lineage chain.

Suggested ablations:

- **exp_002**: LDM with different noise schedule (cosine vs linear)
- **exp_003**: LDM with different latent dimension
- **exp_004**: WGAN baseline on the same dataset (for comparison)
- **exp_005** (optional): LDM with different sampler (DDIM vs DDPM)

Each new brief will automatically include a `## Lineage` section
showing the chain back to `exp_001`. The agent uses parent metrics as
the baseline anchor — it does **not** rerun `exp_001`.

## Step 8: Export results table

After 3-5 ablations are done:

1. `Cmd+Shift+P` → `Cairn: Export Table`
2. Pick format: LaTeX or Markdown
3. Pick which experiments to include (default: all)
4. Pick which metric columns (default: all)
5. A new editor opens with the formatted table — copy/paste anywhere

## Step 9: Reflect

After the full ablation series:

- Did Cairn's brief workflow help you stay organized, or did it slow
  you down?
- Did the lineage chain help you compare ablations, or was it noise?
- Did `methods/exp_NNN.md` give you useful documentation, or extra work?
- Would Cairn fit your 3DGS + VR research workflow?

Tell me your answers, screenshots, error messages, anything. The
more specific, the more useful for me to fix Cairn.

---

## Known limitations (Cairn 0.11)

- **No multi-seed handling** — each brief is a single training run.
  Workaround: run N briefs with the same hypothesis, different seed
  labels.
- **Metrics are single-value** — no native time-series support.
  Workaround: save loss curves / sample images as PNG, reference
  them in `methods/exp_NNN.md`.
- **No Auto-Brief fallback to API key** — Auto-Brief requires `claude`
  CLI in PATH. If unavailable, use the regular `+` button for
  manual brief creation (Cairn falls back gracefully).
- **Brief / method.md examples are ML-supervised in style** —
  generative models like LDM fit naturally; other domains may need
  mental translation.

## Friction reporting

The most useful feedback is specific:

- "Step 4: Auto-Brief took 30 seconds, longer than expected" → useful
- "Step 7: When I selected exp_001 as baseline, the lineage section
  showed wrong metrics" → useful
- "Cairn is hard to use" → not useful

Open a GitHub issue at `https://github.com/Su-Terry/Cairn/issues`
or message me directly.