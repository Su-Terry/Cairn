import * as vscode from 'vscode';
import { Experiment } from './types';
import * as fs from 'fs/promises';

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
 * Append a copy of the experiment row with new status.
 * Cairn folds by id at read time (last entry wins), so this is parallel-safe.
 * Original rows remain in the file as history.
 */
async function updateExperimentStatus(
  uri: vscode.Uri,
  id: string,
  newStatus: Status
): Promise<void> {
  // Read existing rows to find the current full row for this id
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = new TextDecoder('utf-8').decode(bytes);
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Find the most recent row matching this id (last write wins, same as load logic)
  let currentRow: Experiment | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]) as Experiment;
      if (parsed.id === id) {
        currentRow = parsed;
        break;
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!currentRow) {
    throw new Error(`row with id "${id}" not found in experiments.jsonl`);
  }

  // Build updated row (new status, everything else preserved)
  const updatedRow: Experiment = { ...currentRow, status: newStatus };

  // Append the updated row — fold-by-id at read time will surface this as canonical
  const line = JSON.stringify(updatedRow) + '\n';
  await fs.appendFile(uri.fsPath, line, 'utf-8');
}