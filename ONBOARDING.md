# Cairn Onboarding

Step-by-step guide for using Cairn on your project. Designed so any
reader (you, your collaborator, or your AI agent) can follow these
steps and complete onboarding without ambiguity.

Last updated for Cairn 0.10.

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

### Option A: Auto-Brief (recommended for users with Claude Code installed)

Click the sparkle icon (`✨`) in the Cairn panel title bar. Describe
in one sentence what you want to test, and Cairn will draft the
7 fields for you using your existing Claude Code session. Each
field is then shown as an InputBox you can edit or accept with
Enter.

Auto-Brief requires `claude` to be in your PATH (i.e., you've run
`claude login` previously). If Auto-Brief fails (network, auth, or
parse error), Cairn falls back to manual brief creation.

### Option B: Manual brief

1. In the Cairn panel, click the `+` button.
2. Cairn walks you through 6-7 prompts (depending on whether you
   choose a baseline). Answer each:
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

## Known limitations (as of Cairn 0.10)

- **No multi-seed handling**: if you run N seeds for the same brief,
  you currently store mean/std as single numbers in `metrics`. A native
  multi-seed schema is planned.
- **Subjective criteria are self-judged by the agent**: criteria like
  "visually indistinguishable" are evaluated by the agent itself.
  Future versions may flag subjective criteria for human review.
- **No auto-import of past experiments**: if you have prior ad-hoc
  results, you'll need to manually create briefs and edit
  `experiments.jsonl` if you want them tracked.
- **No Auto-Brief**: brief creation is currently 6-7 manual prompts.
  LLM-augmented drafting (you describe intent in one sentence, LLM
  drafts the 6 fields, you review) is the next planned feature.

## When you hit friction

- Open a GitHub issue: `https://github.com/Su-Terry/Cairn/issues`
- Or just message the maintainer directly if you have access.

Friction reports are how Cairn improves. Specific reports
("step 4 baseline picker confused me because X") are more useful than
general ones ("it was hard to use").