import * as vscode from 'vscode';
import { Experiment } from './types';
import { loadExperiments } from './experimentStore';

/**
 * Interactive workflow: ask user a series of questions,
 * then write both a brief markdown file and a pending row in experiments.jsonl.
 */
export async function createBriefCommand(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Cairn: open a workspace folder first.');
    return;
  }
  const rootUri = workspaceFolders[0].uri;

  // Load existing experiments to suggest baseline + auto-id
  const existing = await loadExperiments();

  // ---------- Step 1: hypothesis ----------
  const hypothesis = await vscode.window.showInputBox({
    title: 'New Experiment Brief (1/5)',
    prompt: 'Hypothesis — what are we testing?',
    placeHolder: 'e.g. Larger inner LR improves OOD generalization',
    ignoreFocusOut: true
  });
  if (!hypothesis) return; // cancelled

  // ---------- Step 2: baseline (pick from existing) ----------
  let baseline: string | undefined;
  if (existing.length > 0) {
    const baselinePicks: vscode.QuickPickItem[] = [
      { label: '$(circle-slash) None — start from scratch', description: '' },
      ...existing.map(e => ({
        label: e.id,
        description: `${e.method} · ${e.status}`,
        detail: e.hypothesis
      }))
    ];
    const picked = await vscode.window.showQuickPick(baselinePicks, {
      title: 'New Experiment Brief (2/5)',
      placeHolder: 'Baseline — which experiment to fork from?',
      ignoreFocusOut: true
    });
    if (!picked) return;
    if (picked.label !== '$(circle-slash) None — start from scratch') {
      baseline = picked.label;
    }
  }

  // ---------- Step 3: variant ----------
  const variant = await vscode.window.showInputBox({
    title: 'New Experiment Brief (3/5)',
    prompt: 'Variant — what changes vs. the baseline?',
    placeHolder: 'e.g. inner_lr 0.001 → 0.01',
    ignoreFocusOut: true
  });
  if (variant === undefined) return; // cancelled (empty string is allowed)

  // ---------- Step 4: expected ----------
  const expected = await vscode.window.showInputBox({
    title: 'New Experiment Brief (4/5)',
    prompt: 'Success criterion — when do we call this a win?',
    placeHolder: 'e.g. val_acc_ood > 0.70',
    ignoreFocusOut: true
  });
  if (expected === undefined) return;

  // ---------- Step 5: method label ----------
  const method = await vscode.window.showInputBox({
    title: 'New Experiment Brief (5/5)',
    prompt: 'Method label — name this method for the results table',
    placeHolder: 'e.g. ours+meta',
    value: baseline ? existing.find(e => e.id === baseline)?.method : undefined,
    ignoreFocusOut: true
  });
  if (!method) return;

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
    expected,
    method,
    baselineExperiment: baseline ? existing.find(e => e.id === baseline) : undefined
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
    expected
  };

  const jsonlUri = vscode.Uri.joinPath(rootUri, 'experiments.jsonl');
  await appendJsonlRow(jsonlUri, newRow);

  // ---------- Open the brief for user to review + give to agent ----------
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
  expected: string;
  method: string;
  baselineExperiment?: Experiment;
}

function renderBrief(d: BriefData): string {
  const lines: string[] = [];
  lines.push(`# ${d.id}: ${d.hypothesis}`);
  lines.push('');
  lines.push(`**Date:** ${d.date}`);
  lines.push(`**Method label:** \`${d.method}\``);
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
  lines.push('## Success criterion');
  lines.push('');
  lines.push(d.expected || '*(no explicit criterion — judge qualitatively)*');
  lines.push('');

  if (d.baselineExperiment) {
    lines.push('## Baseline reference');
    lines.push('');
    lines.push(`- ID: \`${d.baselineExperiment.id}\``);
    lines.push(`- Method: \`${d.baselineExperiment.method}\``);
    lines.push(`- Hypothesis: ${d.baselineExperiment.hypothesis}`);
    if (Object.keys(d.baselineExperiment.metrics).length > 0) {
      const metricStr = Object.entries(d.baselineExperiment.metrics)
        .map(([k, v]) => `${k}=${v}`).join(', ');
      lines.push(`- Metrics: ${metricStr}`);
    }
    if (d.baselineExperiment.config) {
      lines.push(`- Config: \`${d.baselineExperiment.config}\``);
    }
    lines.push('');
  }

  lines.push('## Instructions for the agent');
  lines.push('');
  lines.push(`1. Implement the variant described above. ${d.baseline ? `Use \`${d.baseline}\` as the starting point.` : 'Start from a sensible baseline in the codebase.'}`);
  lines.push(`2. Run the experiment using the existing training entry point. **Do not fork new \`train_*.py\` files** — use config flags or a new config file.`);
  lines.push(`3. After the run completes, update \`experiments.jsonl\`:`);
  lines.push(`   - Find the row with \`"id": "${d.id}"\`.`);
  lines.push(`   - Set \`"status"\` to \`"success"\` if metrics meet the criterion above, \`"failed"\` if the run errored or diverged, or \`"inconclusive"\` if the result is unclear.`);
  lines.push(`   - Fill in \`"metrics"\` with the actual values measured.`);
  lines.push(`   - Add \`"config"\` pointing to the config file used.`);
  lines.push(`   - Add a one-line \`"notes"\` describing what actually happened.`);
  lines.push(`4. Do not modify other rows in \`experiments.jsonl\`.`);
  lines.push('');
  return lines.join('\n');
}

async function appendJsonlRow(uri: vscode.Uri, row: Experiment): Promise<void> {
  const line = JSON.stringify(row) + '\n';
  let existingBytes: Uint8Array;
  try {
    existingBytes = await vscode.workspace.fs.readFile(uri);
  } catch {
    existingBytes = new Uint8Array(0);
  }

  // Ensure existing content ends with \n before appending
  let prefix = existingBytes;
  if (existingBytes.length > 0 && existingBytes[existingBytes.length - 1] !== 0x0a) {
    const merged = new Uint8Array(existingBytes.length + 1);
    merged.set(existingBytes);
    merged[existingBytes.length] = 0x0a;
    prefix = merged;
  }

  const lineBytes = new TextEncoder().encode(line);
  const newBytes = new Uint8Array(prefix.length + lineBytes.length);
  newBytes.set(prefix);
  newBytes.set(lineBytes, prefix.length);

  await vscode.workspace.fs.writeFile(uri, newBytes);
}