# Cairn Dogfood 002: Toy Diffusion U-Net → DiT (GPU)

**Date:** 2026-05-09
**Cairn version:** 3c78883
**Environment:** gpu1.cplab.cs.nycu.edu.tw, 2x RTX 4090
**Codebase:** lucidrains/denoising-diffusion-pytorch
**Agent:** Claude Code 2.0.42
**Predecessor:** dogfood-001 (aborted due to local CPU)

## Phase 0d: 預期 agent 會做的事(GPU 環境版)

1. **第一個動作**:先讀 codebase(不是 brief),熟悉現有架構
2. **DiT reference**:大機率會上網查 DiT paper 或 reference implementation
3. **Implementation 來源**:希望 agent 自己寫(測試實作能力),但不確定它會選 import 還是自寫
4. **改動位置**:寫 minimized dit file + config file 跟 public repo 類似
5. **Shape bug 風險**:U-Net ↔ DiT interface 不一致,預期會有 shape bug,但最終可能能 debug 出來
6. **Hyperparameter / training script**:有機會動,跟「自己寫 vs import」的選擇相關
7. **JSONL update**:可能會忘記
8. **Overall outcome**:可能成功,如果問題不難。失敗點最可能在 shape mismatch 或忘記 update jsonl

### Different from dogfood-001
- NVIDIA GeForce RTX 4090 支持跑論文 DiT 模型

### New observations to validate this round
- Will agent finish training without abort? Answer: Yes
- Will agent update jsonl after completion? Answer: 可能不會
- Is the self-implemented DiT actually correct? 預設正確

## Phase 1: Brief creation observations
- Phase 1: Forced to put GPU + time budget info inside `variant` field 
  because no dedicated compute field. Agent has to parse it from variant.
- Q2 (baseline) skipped because no existing experiments — progress indicator showed inconsistent numbering
- Q4 prompt says "Success criterion" but internal schema field is "expected" — naming mismatch noted
- Phase 1: Variant field semantically conflicts—it forces user to write 
  both what changed AND what should NOT change (to constrain the agent).
  → Result: variant becomes a hybrid "diff spec + invariants list"
  → Brief template needs separate field: "Constraints / Invariants" or 
    "Hold constant" to list what agent must preserve from baseline.
  → Without this, agent might "improve" things you wanted held constant 
    (e.g. switch optimizer to AdamW because "newer is better")
- Phase 1: Detected unrealistic constraint (optimizer identical) before sending to agent.
  → Manually edited brief.md to relax constraint and add justification.
  → Cairn provides no warning / lint for unrealistic constraints — 
    user must catch them through domain knowledge.
  → If user lacks domain knowledge, agent gets buggy brief and runs blind.

## Phase 2: Agent execution observations
- #1: Agent 第一動作是讀 codebase(read 6+ files, grep pattern),不是直接寫 code,符合預期
- #2: Agent 使用訓練知識的 Peebles & Xie (2022) 的這篇 DiT 論文
- Cairn prompt 沒有指定 agent execution mode (plan / accept-edits / bypass)
- 持續按 yes 累積摩擦感
- #3: 用 自己寫的 DiT class
- #4: Agent 寫了 train.py + configs/exp_001_dit_s2.json + configs/baseline_unet.json
- Agent 習慣每個實驗寫 documents: baseline-README.md
- Review TODO: 驗證 dit.py 是否真的是正確 DiT 實作
- #5: 會有一些 bug (library, ) 靠 agent 自己解決
- 過程中一直遇到 Numpy version mismatch 的問題 這個我在跑多個實驗都是已知的 friction
- #6: hyperparameter 大致相同，除了一些 model-sepcific 的會更動其他大部分一樣 - 但是這邊可能就會跟 DiT 那篇 paper 不同 - 但是我們其實應該假設不知道最好的 hyperparameter 做實驗
- 使用約 13/24 GB VRAM
- #7: 已更新 loss, final_loss = 0.0406, total_steps = 5000
- Agent 沒有跑 Unet 結果然後說 The DiT implementation is ready for comparison with U-Net baseline results when available.
- #8: 沒有跑 baseline 沒有完成結束條件

## Phase 3: Review observations
- ★ My first action after agent claimed completion: 
  noticed agent didn't run baseline U-Net, decided dogfood was effectively 
  inconclusive and stopped review. 
- The "agent claimed completion but didn't actually complete" event 
  killed my motivation to do further review — if I can't trust the 
  completion signal, why bother reviewing?
- Implication for Cairn: completion trust is fragile. 
  Need stricter "what counts as done" mechanism in brief.

## Phase 4: Brief 2 creation observations  
- Complete the stop criteria.