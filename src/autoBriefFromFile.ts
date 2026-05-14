import * as vscode from 'vscode';
import { AutoBriefDraft, buildAutoBriefPrompt, parseAutoBriefDraft } from './autoBriefPrompt';
import { loadExperiments } from './experimentStore';

/**
 * Run Auto-Brief with file content as input source.
 * Opens a file picker, reads the selected markdown/text file, and uses
 * its content as the user input for Auto-Brief (instead of an InputBox sentence).
 */
export async function runAutoBriefFromFile(): Promise<AutoBriefDraft | undefined> {
  // 1. Open file picker
  const fileUris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select brief seed file',
    filters: {
      'Markdown / Text': ['md', 'markdown', 'txt'],
      'All files': ['*'],
    },
  });

  if (!fileUris || fileUris.length === 0) {
    return undefined; // user cancelled
  }

  // 2. Read file content
  let fileContent: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(fileUris[0]);
    fileContent = Buffer.from(bytes).toString('utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to read file: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }

  if (fileContent.trim().length === 0) {
    vscode.window.showErrorMessage('Selected file is empty.');
    return undefined;
  }

  // 3. Show progress while Claude SDK call happens (file content can be long)
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Auto-Brief: extracting from file...',
      cancellable: false,
    },
    async () => {
      try {
        // 4. Load existing experiments for context
        const experiments = await loadExperiments();

        // 5. Build prompt (markdown seed detection will fire automatically because content > 500 chars or has headers)
        const prompt = buildAutoBriefPrompt(fileContent, experiments);

        // 6. Call Claude SDK — same pattern as autoBrief.ts
        const claudePath = await detectClaudePath();
        if (!claudePath) {
          throw new Error(
            'Claude Code CLI not found. Run `claude login` in terminal, or ensure `claude` is in PATH.'
          );
        }

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        const result = await sdk.unstable_v2_prompt(prompt, {
          model: 'claude-opus-4-7',
          pathToClaudeCodeExecutable: claudePath,
        });

        if (result.subtype !== 'success') {
          throw new Error(`SDK returned non-success: ${result.subtype}`);
        }

        // 7. Parse response
        const draft = parseAutoBriefDraft(result.result);
        return draft;
      } catch (err) {
        vscode.window.showErrorMessage(
          `Auto-Brief from file failed: ${err instanceof Error ? err.message : String(err)}`
        );
        return undefined;
      }
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
