import * as vscode from 'vscode';
import { Experiment } from './types';

/**
 * Reads experiments.jsonl from the current workspace root.
 * Returns empty array if file doesn't exist.
 *
 * Multiple lines with the same `id` are folded — the last entry wins.
 * This makes the file format append-only and parallel-safe:
 * any write is just an append, no in-place mutation.
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
    return [];
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Fold by id: later entries override earlier ones with the same id.
  // Order is preserved by first-appearance position.
  const byId = new Map<string, Experiment>();
  const firstAppearance = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]) as Experiment;
      if (!parsed.id) {
        vscode.window.showWarningMessage(
          `Cairn: skipped line ${i + 1} in experiments.jsonl (no id)`
        );
        continue;
      }
      if (!firstAppearance.has(parsed.id)) {
        firstAppearance.set(parsed.id, i);
      }
      byId.set(parsed.id, parsed);
    } catch (err) {
      vscode.window.showWarningMessage(
        `Cairn: skipped malformed line ${i + 1} in experiments.jsonl`
      );
    }
  }

  // Sort by first appearance — earliest-created first
  const result = Array.from(byId.values()).sort((a, b) => {
    const ai = firstAppearance.get(a.id) ?? 0;
    const bi = firstAppearance.get(b.id) ?? 0;
    return ai - bi;
  });

  return result;
}