import * as vscode from 'vscode';
import { loadExperiments } from './experimentStore';
import { buildAutoBriefPrompt, parseAutoBriefDraft, AutoBriefDraft } from './autoBriefPrompt';

/**
 * Auto-Brief: user describes experiment in one sentence,
 * LLM drafts the 7 brief fields, user reviews and approves.
 *
 * Returns the draft if successful, or undefined if user cancelled
 * or LLM call failed (caller should fallback to manual brief).
 */
export async function runAutoBrief(): Promise<AutoBriefDraft | undefined> {
  // Step 1: get user's one-sentence intent
  const userInput = await vscode.window.showInputBox({
    title: 'Auto-Brief',
    prompt: 'Describe what you want to test (one sentence):',
    placeHolder: 'e.g. "test weight decay 0.05 with patch size 4 to see synergy"',
    ignoreFocusOut: true
  });
  if (!userInput || userInput.trim().length === 0) return undefined;

  // Step 2: build prompt with workspace context
  const experiments = await loadExperiments();
  const prompt = buildAutoBriefPrompt(userInput, experiments);

  // Step 3: call SDK with progress indicator (5-30 sec wait)
  let rawResponse: string;
  try {
    rawResponse = await callClaudeSDK(prompt);
  } catch (err: any) {
    const choice = await vscode.window.showErrorMessage(
      `Auto-Brief failed: ${err.message}. Continue with manual brief?`,
      { modal: false },
      'Continue manually',
      'Cancel'
    );
    return choice === 'Continue manually' ? undefined : undefined;
    // both paths return undefined; caller's createBrief will handle the fallback
  }

  // Step 4: parse the JSON response
  let draft: AutoBriefDraft;
  try {
    draft = parseAutoBriefDraft(rawResponse);
  } catch (err: any) {
    await vscode.window.showErrorMessage(
      `Auto-Brief parse failed: ${err.message}. Falling back to manual brief.`
    );
    return undefined;
  }

  // Step 5: validate baseline_id matches an existing experiment (if non-null)
  if (draft.baseline_id !== null) {
    const exists = experiments.some(e => e.id === draft.baseline_id);
    if (!exists) {
      await vscode.window.showWarningMessage(
        `Auto-Brief suggested baseline ${draft.baseline_id} but it doesn't exist. Setting to null.`
      );
      draft.baseline_id = null;
    }
  }

  return draft;
}

/**
 * Call Claude Agent SDK to get a brief draft.
 * Uses dynamic import because SDK is ESM-only.
 * Uses pathToClaudeCodeExecutable to avoid bundling SDK's native binary.
 */
async function callClaudeSDK(prompt: string): Promise<string> {
  const claudePath = await detectClaudePath();
  if (!claudePath) {
    throw new Error(
      'Claude Code CLI not found. Run `claude login` in terminal, or ensure `claude` is in PATH.'
    );
  }

  // Dynamic import: SDK is ESM, Cairn is CommonJS
  const sdk = await import('@anthropic-ai/claude-agent-sdk');

  // Show progress indicator while waiting for LLM
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Auto-Brief: drafting...',
      cancellable: false
    },
    async () => {
      const result = await sdk.unstable_v2_prompt(prompt, {
        model: 'claude-opus-4-7',
        pathToClaudeCodeExecutable: claudePath
      });

      if (result.subtype !== 'success') {
        throw new Error(`SDK returned non-success: ${result.subtype}`);
      }
      return result.result;
    }
  );
}

/**
 * Detect path to user's `claude` CLI binary.
 * Returns absolute path or undefined if not found.
 */
async function detectClaudePath(): Promise<string | undefined> {
  // Try `which claude` via shell
  const cp = await import('child_process');
  try {
    const result = cp.execSync('which claude', { encoding: 'utf-8' }).trim();
    return result || undefined;
  } catch {
    // `which` failed (binary not in PATH)
    return undefined;
  }
}