import * as vscode from 'vscode';
import { Experiment } from './types';

/**
 * Reads experiments.jsonl from the current workspace root.
 * Returns empty array if file doesn't exist.
 * Throws on malformed JSON (caller decides how to surface).
 */
export async function loadExperiments(): Promise<Experiment[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootUri = workspaceFolders[0].uri;
  const fileUri = vscode.Uri.joinPath(rootUri, 'experiments.jsonl');

  let bytes: Uint8Array;
  try {
    bytes = await vscode.workspace.fs.readFile(fileUri);
  } catch (err) {
    // File doesn't exist or unreadable — treat as no experiments
    return [];
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  const experiments: Experiment[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]) as Experiment;
      experiments.push(parsed);
    } catch (err) {
      vscode.window.showWarningMessage(
        `Cairn: skipped malformed line ${i + 1} in experiments.jsonl`
      );
    }
  }

  return experiments;
}