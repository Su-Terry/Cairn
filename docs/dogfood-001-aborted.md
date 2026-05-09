# Dogfood 001: ABORTED — wrong environment

**Date:** 2026-05-09
**Cairn version:** (run `git rev-parse --short HEAD` and fill)
**Status:** Aborted before completion
**Reason:** Setup error — ran on local Mac CPU without considering GPU requirement.

## What happened

Attempted to dogfood the brief workflow by asking an agent to swap U-Net for 
DiT in lucidrains/denoising-diffusion-pytorch on toy MNIST. Agent successfully:

- Read codebase + brief
- Wrote `denoising_diffusion_pytorch/dit.py` (self-implemented, no external lib)
- Wrote `configs/exp_001.py` as training entry point
- Started training, then aborted itself when realizing CPU would take ~3hrs

Aborted dogfood at the point where agent was about to retry with smaller model,
because the entire setup was missing GPU consideration.

## Findings collected before abort

### Cairn UI / brief creation
- Q2 (baseline) skipped when no existing experiments, but progress indicator 
  still shows "X/5" — confusing numbering
- UI label says "Success criterion" but internal schema field is `expected` — 
  naming inconsistency

### Brief template gaps
- **Critical:** No "compute budget" / "available environment" field. Agent had 
  to discover CPU bottleneck mid-execution. Should add: `compute: [CPU/GPU/cluster]`
  and `time_budget: [< 30min / hours / overnight]`
- "config file" language is ambiguous — agent created `configs/exp_001.py` 
  (executable Python with training loop) under the "new config files" allowance, 
  effectively side-stepping the "no new training scripts" rule

### Agent behavior vs. expectations (Phase 0d predictions)
- ❌ #4 Predicted "modify main file"; agent created two new files instead 
  (`dit.py` + `configs/exp_001.py`)
- ✅ #3 Predicted "self-write vs import"; agent self-wrote DiT, didn't import library
- ⚠️ #7 Predicted "likely forget jsonl update"; couldn't verify — never reached 
  completion stage

### Workflow gaps
- When training was killed mid-way, no clear path to mark experiment as 
  `inconclusive` from the Cairn UI — would need to manually edit jsonl
- Cairn has no concept of "experiment in progress, currently running" beyond 
  the static `running` status — no way to see live training output

## What this dogfood couldn't validate

- Full brief → agent → review → next-brief cycle (got stuck at agent stage)
- jsonl update behavior post-completion
- Whether agent's self-implemented DiT is correct
- Brief-to-brief transition (Phase C of original protocol)

## Plan for dogfood-002

Rerun on lab GPU server via VS Code Remote SSH. Same DiT task, but with proper
compute environment so the dogfood can complete the full cycle.

Specifically test:
- Whether GPU env eliminates the "compute budget" friction (or if it just shifts)
- Full review stage observations
- Brief 2 creation that references brief 1 (Phase C from original protocol)