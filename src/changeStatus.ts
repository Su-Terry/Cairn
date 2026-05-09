import * as vscode from 'vscode';
import { Experiment } from './types';

type Status = Experiment['status'];

interface StatusPick extends vscode.QuickPickItem {
  status: Status;
}

const STATUS_OPTIONS: StatusPick[] = [
  { status: 'pending',      label: '$(circle-outline) Pending',     description: 'Brief created, agent has not started' },
  { status: 'running',      label: '$(sync~spin) Running',          description: 'Agent is executing the experiment' },
  { status: 'success',      label: '$(pass) Success',               description: 'All checklist items done, success criterion met' },
  { status: 'partial',      label: '$(pass-filled) Partial',        description: 'Checklist done but criterion not fully met' },
  { status: 'failed',       label: '$(error) Failed',               description: 'Run errored or diverged' },
  { status: 'inconclusive', label: '$(question) Inconclusive',      description: 'Some checklist items could not be completed' }
];

/**
 * Show a QuickPick to change the status of an experiment,
 * then update the corresponding row in experiments.jsonl.
 */
export async function changeStatusCommand(experiment: Experiment | undefined): Promise<void> {
  if (!experiment) {
    vscode.window.showErrorMessage('Cairn: no experiment selected.');
    return;
  }

  const picked = await vscode.window.showQuickPick(STATUS_OPTIONS, {
    title: `Change status of ${experiment.id}`,
    placeHolder: `Currently: ${experiment.status}`,
    ignoreFocusOut: true
  });

  if (!picked) return; // cancelled
  if (picked.status === experiment.status) return; // no change

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Cairn: no workspace folder.');
    return;
  }

  const jsonlUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'experiments.jsonl');

  try {
    await updateExperimentStatus(jsonlUri, experiment.id, picked.status);
    vscode.window.showInformationMessage(
      `Cairn: ${experiment.id} status changed to ${picked.status}.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Cairn: failed to update status — ${err}`);
  }
}

/**
 * Read jsonl, update the row matching `id`, write back.
 * Preserves all other rows untouched.
 */
async function updateExperimentStatus(
  uri: vscode.Uri,
  id: string,
  newStatus: Status
): Promise<void> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = new TextDecoder('utf-8').decode(bytes);

  const lines = text.split('\n');
  let updated = false;

  const newLines = lines.map(line => {
    if (line.trim().length === 0) return line;
    try {
      const exp = JSON.parse(line);
      if (exp.id === id) {
        exp.status = newStatus;
        updated = true;
        return JSON.stringify(exp);
      }
      return line;
    } catch {
      // Malformed line — leave it alone, don't risk corrupting it
      return line;
    }
  });

  if (!updated) {
    throw new Error(`row with id "${id}" not found in experiments.jsonl`);
  }

  // Ensure trailing newline
  let output = newLines.join('\n');
  if (!output.endsWith('\n')) {
    output += '\n';
  }

  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(output));
}