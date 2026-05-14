import * as vscode from 'vscode';
import { Experiment } from './types';
import { loadExperiments } from './experimentStore';
import * as fs from 'fs/promises';
import { AutoBriefDraft } from './autoBriefPrompt';

/**
 * Get field labels for InputBox prompts based on detected work type mode.
 */
function getFieldLabels(mode?: AutoBriefDraft['detected_mode']): {
  hypothesis: string;
  variant: string;
  successCriterion: string;
} {
  switch (mode) {
    case 'infrastructure':
    case 'retroactive_infrastructure':
      return {
        hypothesis: 'Purpose (what this infra enables downstream)',
        variant: "What's built (component, interfaces, design)",
        successCriterion: 'Acceptance criteria (observable signals, not metric thresholds)',
      };
    case 'codebase':
    case 'retroactive_codebase':
      return {
        hypothesis: 'Learning goal (what you want to be able to explain/modify after)',
        variant: 'Files / modules to explore',
        successCriterion: 'method.md must contain (default: module summaries, data flow, key abstractions, gotchas)',
      };
    case 'retroactive':
      return {
        hypothesis: 'Hypothesis (what was tested)',
        variant: 'Variant (what was run)',
        successCriterion: 'Success criterion (historical target)',
      };
    case 'ablation':
    default:
      return {
        hypothesis: 'Hypothesis (what is being tested)',
        variant: 'Variant (what changes from baseline)',
        successCriterion: 'Success criterion (when do we call this a win)',
      };
  }
}

/**
 * Interactive workflow: ask user a series of questions,
 * then write both a brief markdown file and a pending row in experiments.jsonl.
 */
export async function createBriefCommand(draft?: AutoBriefDraft): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Cairn: open a workspace folder first.');
    return;
  }
  const rootUri = workspaceFolders[0].uri;

  const existing = await loadExperiments();
  const totalSteps = existing.length > 0 ? 7 : 6;
  const stepLabel = (n: number) => `New Experiment Brief (${n}/${totalSteps})`;

  // Get field labels based on detected mode
  const labels = getFieldLabels(draft?.detected_mode);

  // ---------- Step 1: hypothesis ----------
  const hypothesis = await vscode.window.showInputBox({
    title: stepLabel(1),
    prompt: labels.hypothesis,
    placeHolder: 'e.g. DiT should match U-Net on toy MNIST diffusion',
    value: draft?.hypothesis,
    ignoreFocusOut: true
  });
  if (!hypothesis) return;

  // ---------- Step 2: baseline (skip if no existing experiments) ----------
  let baseline: string | undefined;
  let stepOffset = 0;
  if (existing.length > 0) {
    const baselinePicks: vscode.QuickPickItem[] = [
      { label: '$(circle-slash) None — start from scratch', description: 'No prior experiment to fork from' },
      ...existing.map(e => ({
        label: e.id,
        description: `${e.method} · ${e.status}`,
        detail: e.hypothesis
      }))
    ];

    const placeholderText = draft?.baseline_id
      ? `Auto-Brief suggested: ${draft.baseline_id} — pick or override`
      : 'Baseline — which experiment to fork from?';

    const picked = await vscode.window.showQuickPick(baselinePicks, {
      title: stepLabel(2),
      placeHolder: placeholderText,
      ignoreFocusOut: true
    });
    if (!picked) return;
    if (picked.label !== '$(circle-slash) None — start from scratch') {
      baseline = picked.label;
    }
  } else {
    stepOffset = -1;
  }

  // ---------- Step 3: variant ----------
  const variant = await vscode.window.showInputBox({
    title: stepLabel(3 + stepOffset),
    prompt: labels.variant,
    placeHolder: 'e.g. add weight_decay=0.05, switch to AdamW',
    value: draft?.variant,
    ignoreFocusOut: true
  });
  if (variant === undefined) return;

  // ---------- Step 4: success criterion ----------
  const successCriterion = await vscode.window.showInputBox({
    title: stepLabel(4 + stepOffset),
    prompt: labels.successCriterion,
    placeHolder: 'e.g. val_acc > 0.85 AND inference_latency < 50ms',
    value: draft?.success_criterion,
    ignoreFocusOut: true
  });
  if (successCriterion === undefined) return;

  // ---------- Step 5: execution mode ----------
  const modePicks: vscode.QuickPickItem[] = [
    {
      label: '$(robot) Agent',
      description: 'Agent runs training and updates jsonl autonomously',
      detail: 'Use when training fits in agent session (minutes to hours)'
    },
    {
      label: '$(person) Human',
      description: 'Agent designs; human runs training and reports back',
      detail: 'Use when training is long (days), needs special hardware, or you want manual control'
    }
  ];

  const modePlaceholder = draft?.execution_mode
    ? `Auto-Brief suggested: ${draft.execution_mode} — pick or override`
    : 'Execution mode — who runs the experiment?';

  const modePick = await vscode.window.showQuickPick(modePicks, {
    title: stepLabel(5 + stepOffset),
    placeHolder: modePlaceholder,
    ignoreFocusOut: true
  });
  if (!modePick) return;
  const executionMode: 'agent' | 'human' =
    modePick.label.includes('Agent') ? 'agent' : 'human';

  // ---------- Step 6: completion checklist ----------
  let completionChecklist: string;
  if (draft?.completion_checklist && draft.completion_checklist.length > 0) {
    // Auto-Brief mode: skip individual prompts, use draft's array
    completionChecklist = draft.completion_checklist.map(s => `- ${s}`).join('\n');
  } else {
    // Manual mode: multi-round InputBox loop
    const checklistItems: string[] = [];
    let itemNum = 1;
    while (true) {
      const itemTitle = `${stepLabel(6 + stepOffset)} — checklist item ${itemNum}`;
      const item = await vscode.window.showInputBox({
        title: itemTitle,
        prompt: `Item ${itemNum} (leave blank to finish)`,
        placeHolder: 'e.g. trained 5000 steps with new config',
        ignoreFocusOut: true
      });
      if (item === undefined) return;
      if (item.trim().length === 0) break;
      checklistItems.push(item);
      itemNum++;
    }
    completionChecklist = checklistItems.map(s => `- ${s}`).join('\n');
  }

  // ---------- Step 7: method label ----------
  const method = await vscode.window.showInputBox({
    title: stepLabel(7 + stepOffset),
    prompt: 'Method label — short identifier for the results table',
    placeHolder: 'e.g. dit-s2-wd, ppo-reward-v1',
    value: draft?.method_label,
    ignoreFocusOut: true
  });
  if (method === undefined || method.trim().length === 0) return;

  // ---------- Generate id ----------
  const nextId = generateNextId(existing);
  const today = new Date().toISOString().slice(0, 10);
  const briefPath = `briefs/${nextId}.md`;

  // ---------- Build brief markdown ----------
  const briefContent = renderBrief({
    id: nextId,
    date: today,
    hypothesis,
    baseline,
    variant,
    successCriterion,
    completionChecklist,
    method,
    baselineExperiment: baseline ? existing.find(e => e.id === baseline) : undefined,
    allExperiments: existing,
    executionMode,
    detectedMode: draft?.detected_mode,
    compositeNotes: draft?.composite_notes
  });

  // ---------- Write brief file ----------
  const briefUri = vscode.Uri.joinPath(rootUri, briefPath);
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, 'briefs'));
    await vscode.workspace.fs.writeFile(briefUri, new TextEncoder().encode(briefContent));
  } catch (err) {
    vscode.window.showErrorMessage(`Cairn: failed to write brief — ${err}`);
    return;
  }

  // ---------- Append row to experiments.jsonl ----------
  const newRow: Experiment = {
    id: nextId,
    date: today,
    hypothesis,
    method,
    metrics: {},
    status: 'pending',
    brief: briefPath,
    baseline,
    variant,
    successCriterion,
    completionChecklist,
    executionMode
  };

  const jsonlUri = vscode.Uri.joinPath(rootUri, 'experiments.jsonl');
  await appendJsonlRow(jsonlUri, newRow);

  // ---------- Open the brief for review ----------
  const doc = await vscode.workspace.openTextDocument(briefUri);
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(
    `Cairn: brief ${nextId} created. Pass briefs/${nextId}.md to your agent to implement.`
  );
}

function generateNextId(existing: Experiment[]): string {
  const nums = existing
    .map(e => e.id.match(/^exp_(\d+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(m => parseInt(m[1], 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `exp_${String(next).padStart(3, '0')}`;
}

interface BriefData {
  id: string;
  date: string;
  hypothesis: string;
  baseline?: string;
  variant: string;
  successCriterion: string;
  completionChecklist: string;
  method: string;
  baselineExperiment?: Experiment;
  allExperiments: Experiment[];
  executionMode: 'agent' | 'human';
  detectedMode?: AutoBriefDraft['detected_mode'];
  compositeNotes?: string[];
}

function renderBrief(d: BriefData): string {
  const lines: string[] = [];

  // Add mode preamble based on detected_mode
  if (d.detectedMode === 'retroactive' || d.detectedMode === 'retroactive_infrastructure' || d.detectedMode === 'retroactive_codebase') {
    lines.push('> **Retroactive registration** — capturing completed work. Agent will not re-run anything.');
    lines.push('');
  } else if (d.detectedMode === 'infrastructure') {
    lines.push('> **Infrastructure brief** — success means the component works, not that a hypothesis was confirmed.');
    lines.push('');
  } else if (d.detectedMode === 'codebase') {
    lines.push('> **Codebase understanding brief** — deliverable is a useful mental model captured in method.md, not a result.');
    lines.push('');
  }

  // Add composite notes if present
  if (d.compositeNotes && d.compositeNotes.length > 0) {
    lines.push('> **Notes:**');
    for (const note of d.compositeNotes) {
      lines.push(`> - ${note}`);
    }
    lines.push('');
  }

  // Add -retro suffix defensive check
  let methodLabel = d.method;
  if ((d.detectedMode === 'retroactive'
       || d.detectedMode === 'retroactive_infrastructure'
       || d.detectedMode === 'retroactive_codebase')
      && !methodLabel.endsWith('-retro')) {
    methodLabel = methodLabel + '-retro';
  }

  lines.push(`# ${d.id}: ${d.hypothesis}`);
  lines.push('');
  lines.push(`**Date:** ${d.date}`);
  lines.push(`**Method label:** \`${methodLabel}\``);
  if (d.baseline) {
    lines.push(`**Baseline:** \`${d.baseline}\``);
  }
  lines.push('');
  lines.push('## Hypothesis');
  lines.push('');
  lines.push(d.hypothesis);
  lines.push('');
  lines.push('## What changes vs. baseline');
  lines.push('');
  lines.push(d.variant || '*(starting from scratch)*');
  lines.push('');
  lines.push('*Everything not mentioned above stays unchanged from baseline.*');
  lines.push('');
  lines.push('## Success criterion');
  lines.push('');
  lines.push(d.successCriterion || '*(no explicit criterion — judge qualitatively)*');
  lines.push('');

  lines.push('## Completion checklist');
  lines.push('');
  lines.push('**Before claiming completion, every item below must be verified.**');
  lines.push('');
  if (d.completionChecklist.trim().length > 0) {
    lines.push(d.completionChecklist);
  } else {
    lines.push('*(no checklist provided — at risk of hallucinated completion)*');
  }
  lines.push('');

  if (d.baselineExperiment) {
    const chain = buildLineageChain(d.baselineExperiment, d.allExperiments);
    lines.push('## Lineage');
    lines.push('');
    lines.push(`This experiment forks from \`${d.baselineExperiment.id}\`.`);
    lines.push('');
    lines.push('Chain (most recent first):');
    for (const exp of chain) {
      const summary = formatLineageEntry(exp);
      lines.push(`- ${summary}`);
    }
    lines.push('');
    lines.push('**For agents implementing this experiment:**');
    lines.push('- Read parent metrics from `experiments.jsonl` (find the row with the parent\'s id)');
    lines.push('- Use parent metrics as the baseline anchor; do NOT rerun the parent');
    lines.push('- Reference parent\'s `methodFile` for implementation details');
    lines.push('- Recursively traverse the chain above if you need deeper context');
    lines.push('');
  }

  lines.push('## Codebase exploration');
  lines.push('');
  lines.push('Before implementing this variant, explore the workspace systematically:');
  lines.push('');
  lines.push('1. Read `README.md` if it exists; otherwise list root files for orientation.');
  lines.push('2. Identify the training entry point (look for `train*.py`, `main.py`, `run.py`, or similar).');
  lines.push('3. Identify config files (`configs/`, `*.yaml`, `*.json`).');
  lines.push('4. Identify the baseline implementation — the parent referenced in `## Lineage` (if present), or relevant model files in this codebase.');
  lines.push('5. Read the entry point and one representative config to understand how to invoke training.');
  lines.push('6. State back briefly what you found before making changes.');
  lines.push('');
  lines.push('For incremental changes (e.g., flipping a single hyperparameter), step 6 can be very short. For new architectures or major refactors, take the time to understand the codebase deeply before writing.');
  lines.push('');

  lines.push('## Instructions for the agent');
  lines.push('');
  if (d.executionMode === 'human') {
    lines.push('**Execution mode:** Human-in-the-loop. You design the experiment; the user runs the training.');
    lines.push('');
  }
  lines.push(`1. Implement the variant described above. ${d.baseline ? `Use \`${d.baseline}\` as the starting point.` : 'Start from a sensible baseline in the codebase.'}`);
  if (d.executionMode === 'agent') {
    lines.push(`2. Run the experiment using the existing training entry point. **Do not fork new \`train_*.py\` files** — use config flags or new config files.`);
    lines.push(`3. **Before claiming completion, verify every item in the Completion checklist above.** Report which items are done and which are not. If any item is incomplete, status must be \`partial\` or \`inconclusive\`, not \`success\`.`);
  } else {
    lines.push(`2. **Hand off to user for training.** Do NOT attempt to run training yourself. Tell the user explicitly: "I have prepared the code changes. Please run training with the following command: <command>" and provide the exact command to run. Wait for the user to report back with results.`);
    lines.push(`3. **After the user reports results**, verify every item in the Completion checklist with the user. If items are incomplete, work with the user to determine status (\`partial\` / \`inconclusive\` / \`failed\`).`);
  }
  lines.push(`4. Write \`methods/${d.id}.md\` documenting how you implemented this. Use the following structure (write "N/A" if a section doesn't apply, don't omit headings):`);
  lines.push('');
  lines.push('   ```markdown');
  lines.push(`   # ${d.id} — Method`);
  lines.push('   ');
  lines.push('   ## Architecture');
  lines.push('   (spec: layers, dimensions, key components)');
  lines.push('   ');
  lines.push('   ## Hyperparameters');
  lines.push('   (optimizer, learning rate, schedule, batch size, training steps, etc.)');
  lines.push('   ');
  lines.push('   ## What is specifically different from baseline');
  lines.push('   (precise diff — files changed, what flags, what new modules)');
  lines.push('   ');
  lines.push('   ## Design rationale');
  lines.push("   Why this variant was chosen and what was specifically expected to happen.");
  lines.push("   Reference the original brief's hypothesis. State any assumptions you made");
  lines.push("   that aren't explicit in the brief.");
  lines.push("   **CRITICAL: Explicitly justify any specific parameter choices");
  lines.push("   (e.g., weight decay, optimizers, learning rate) you made that were");
  lines.push("   NOT dictated by the brief.**");
  lines.push('   ');
  lines.push('   ## Design decisions worth noting');
  lines.push('   (non-default choices and the reason)');
  lines.push('   ');
  lines.push('   ## Notable observations');
  lines.push('   Anything surprising that happened during the run that future readers');
  lines.push('   (you, your PI, paper reviewers) should know. Examples: training');
  lines.push('   instability at step X, unexpected metric jumps, samples that look');
  lines.push('   qualitatively different from baseline, OOM near the end, version');
  lines.push("   conflicts encountered. Write 'None' if nothing surprised you.");
  lines.push('   ```');
  lines.push('');
  if (d.executionMode === 'agent') {
    lines.push(`5. Commit your changes with \`git add -A && git commit -m "${d.id}: <one-line summary>"\`. Capture the commit hash from \`git rev-parse HEAD\`.`);
  } else {
    lines.push(`5. **The user commits.** After the user reports successful training, ask them to commit with: \`git add -A && git commit -m "${d.id}: <one-line summary>"\` and to share the commit hash with you.`);
  }
  lines.push('');
  lines.push(`6. Update \`experiments.jsonl\` by **appending a new JSON line**. Do NOT rewrite the file or modify existing lines in place. Cairn deduplicates by id at read time (last entry wins).`);
  lines.push('');
  lines.push(`   Build the updated row:`);
  lines.push(`   - Read the current row with \`"id": "${d.id}"\` to get existing values`);
  lines.push(`   - Set \`"status"\` based on the checklist verification:`);
  lines.push(`     - \`"success"\` only if all checklist items are done AND success criterion is met`);
  lines.push(`     - \`"partial"\` if checklist is fully done but success criterion not fully met`);
  lines.push(`     - \`"inconclusive"\` if some checklist items could not be completed`);
  lines.push(`     - \`"failed"\` if the run errored or diverged`);
  lines.push(`   - Fill in \`"metrics"\` with the actual values measured`);
  lines.push(`   - Add \`"config"\` pointing to the config file used`);
  lines.push(`   - Add \`"methodFile": "methods/${d.id}.md"\``);
  lines.push(`   - Add \`"commitHash"\` with the hash from step 5`);
  lines.push(`   - Add a one-line \`"notes"\` describing what actually happened`);
  lines.push('');
  lines.push(`   **Write to file using append, not overwrite:**`);
  lines.push(`   - Use \`echo '<single-line JSON>' >> experiments.jsonl\` from a shell`);
  lines.push(`   - Or open the file with mode \`'a'\` (Python), \`O_APPEND\` (C), or equivalent`);
  lines.push(`   - **Do NOT use the Edit tool on \`experiments.jsonl\`.** Edit tool rewrites the file and breaks parallel safety. Use Bash \`echo >>\` instead.`);
  lines.push('');
  lines.push(`7. Do not delete or modify existing lines in \`experiments.jsonl\`. The file is append-only history; Cairn folds by id when reading.`);
  lines.push('');

  // Add mode-specific method.md content emphasis
  if (d.detectedMode === 'infrastructure' || d.detectedMode === 'retroactive_infrastructure') {
    lines.push('## method.md content emphasis (infrastructure mode)');
    lines.push('');
    lines.push('Use the 6 canonical sections with the following content focus:');
    lines.push('1. Architecture — component structure, interfaces, where it plugs in');
    lines.push('2. Hyperparameters — configuration parameters, default values');
    lines.push("3. What's specifically different from baseline — N/A for greenfield; diff from existing if refactor");
    lines.push('4. Design rationale — why this design vs alternatives');
    lines.push('5. Design decisions worth noting — non-default choices, dependencies');
    lines.push('6. Notable observations — gotchas, edge cases, performance characteristics');
    lines.push('');
  }

  if (d.detectedMode === 'codebase' || d.detectedMode === 'retroactive_codebase') {
    lines.push('## method.md content emphasis (codebase understanding mode)');
    lines.push('');
    lines.push('Use the 6 canonical sections with the following content focus:');
    lines.push('1. Architecture — module overview, per-module 2-3 sentence summary');
    lines.push('2. Hyperparameters — entry points, how to run/extend');
    lines.push("3. What's specifically different from baseline — N/A (onboarding)");
    lines.push('4. Design rationale — key abstractions, the 3-5 ideas the codebase is built around');
    lines.push('5. Design decisions worth noting — data flow, input → output with shapes/types at boundaries');
    lines.push('6. Notable observations — gotchas + open questions for human');
    lines.push('');
  }

  if (d.detectedMode === 'retroactive' || d.detectedMode === 'retroactive_infrastructure' || d.detectedMode === 'retroactive_codebase') {
    lines.push('## Retroactive mode reminder');
    lines.push('');
    lines.push('This is a RETROACTIVE registration. DO NOT re-run, re-train, or re-execute.');
    lines.push('Your job is to read any referenced artifacts and populate method.md describing what WAS DONE (past tense).');
    lines.push('If result numbers are provided, record verbatim in Notable observations.');
    lines.push('Flag gaps where the historical record is incomplete.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Append a row to experiments.jsonl using O_APPEND (atomic for small writes).
 * Multiple concurrent writers are safe up to PIPE_BUF (4KB on Linux).
 * Cairn relies on fold-by-id at read time to handle multiple entries per experiment.
 */
async function appendJsonlRow(uri: vscode.Uri, row: Experiment): Promise<void> {
  const line = JSON.stringify(row) + '\n';
  // fs.appendFile uses O_APPEND under the hood — atomic for writes ≤ PIPE_BUF.
  // Local filesystem only; would need a different strategy for remote/virtual fs.
  await fs.appendFile(uri.fsPath, line, 'utf-8');
}

/**
 * Build the lineage chain by traversing baseline links recursively.
 * Returns array with [direct parent, grandparent, ...] order.
 */
function buildLineageChain(start: Experiment, allExps: Experiment[]): Experiment[] {
  const byId = new Map(allExps.map(e => [e.id, e]));
  const chain: Experiment[] = [];
  let current: Experiment | undefined = start;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    if (current.baseline) {
      current = byId.get(current.baseline);
    } else {
      current = undefined;
    }
  }
  return chain;
}

function formatLineageEntry(exp: Experiment): string {
  const parts: string[] = [`\`${exp.id}\``];
  parts.push(`(${exp.method}, ${exp.status})`);
  const m = exp.metrics;
  const keyMetric =
    m.loss_difference_percent !== undefined ? `gap=${m.loss_difference_percent}%` :
    m.dit_final_loss !== undefined ? `loss=${m.dit_final_loss}` :
    Object.keys(m).length > 0 ? `${Object.keys(m).length} metrics` :
    'no metrics';
  parts.push(keyMetric);
  return parts.join(' ');
}