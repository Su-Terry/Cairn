import * as vscode from 'vscode';
import { Experiment } from './types';

/**
 * Generate the prompt a user pastes to their AI agent.
 * Designed to be agent-agnostic (Claude Code, Cursor, Gemini, etc).
 */
export async function copyAgentPromptCommand(experiment: Experiment | undefined): Promise<void> {
  if (!experiment) {
    vscode.window.showErrorMessage('Cairn: no experiment selected.');
    return;
  }

  if (!experiment.brief) {
    vscode.window.showWarningMessage(
      `Cairn: ${experiment.id} has no brief file. Create the experiment via "New Experiment Brief" to get one.`
    );
    return;
  }

  const prompt = renderAgentPrompt(experiment);

  await vscode.env.clipboard.writeText(prompt);

  vscode.window.showInformationMessage(
    `Cairn: prompt for ${experiment.id} copied. Paste it into your agent (Cmd+V).`
  );
}

function renderAgentPrompt(exp: Experiment): string {
  const lines: string[] = [];
  const isHumanMode = exp.executionMode === 'human';

  lines.push(`Please implement the experiment described in \`${exp.brief}\`.`);
  lines.push('');
  lines.push(`The brief contains the hypothesis, the variant, the success criterion, an explicit completion checklist, and instructions on how to update \`experiments.jsonl\` after the run completes.`);
  lines.push('');
  lines.push('Important reminders:');
  lines.push('- Do NOT fork new training scripts. Use config flags or new config files.');
  lines.push('- Search the existing codebase for similar implementations before writing new code.');
  lines.push('- Everything not explicitly mentioned in the variant stays unchanged from baseline.');
  lines.push(`- If this experiment forks from a parent (see \`## Lineage\` in the brief), use the parent's metrics from \`experiments.jsonl\` as your baseline anchor. Do NOT rerun the parent; reference its \`methodFile\` for implementation details.`);

  if (isHumanMode) {
    lines.push(`- **Execution mode: Human.** You design and prepare the code; the user runs the training. Do NOT attempt to run training yourself. Provide the user with the exact command to run, then wait for them to report results.`);
    lines.push(`- After the user reports results, work with them to verify every item in the completion checklist. Status must be \`partial\` or \`inconclusive\` if any checklist item is incomplete, never \`success\`.`);
  } else {
    lines.push(`- **Before claiming completion, verify every item in the completion checklist.** Status must be \`partial\` or \`inconclusive\` if any checklist item is incomplete, never \`success\`.`);
  }

  lines.push(`- **Write \`methods/${exp.id}.md\`** with the six structured sections specified in the brief (Architecture, Hyperparameters, What is specifically different from baseline, Design rationale, Design decisions worth noting, Notable observations). This is required, not optional. Especially the **Design rationale** section: explicitly justify any parameter choices not dictated by the brief.`);

  if (isHumanMode) {
    lines.push(`- **The user commits.** After successful training, ask the user to commit with \`git add -A && git commit -m "${exp.id}: <one-line summary>"\` and to share the commit hash with you.`);
    lines.push(`- After the user reports results, **append** an updated copy of the row with \`"id": "${exp.id}"\` to \`experiments.jsonl\` (including \`methodFile\` and \`commitHash\`). Either you append it via Bash \`echo '<json>' >> experiments.jsonl\`, or guide the user to do so. Do NOT use the Edit tool, do NOT rewrite the file. Cairn folds by id at read time.`);
  } else {
    lines.push(`- **Commit your changes** with a message starting \`${exp.id}:\` and capture the commit hash for the jsonl entry.`);
    lines.push(`- After the run, **append** an updated copy of the row with \`"id": "${exp.id}"\` to \`experiments.jsonl\` (including \`methodFile\` and \`commitHash\`). Use Bash \`echo '<json>' >> experiments.jsonl\` — do NOT use the Edit tool, do NOT rewrite the file. Cairn folds by id at read time.`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Recommended for Claude Code: press **Shift+Tab** to enable auto-accept edits (file edits auto-allowed, bash commands still confirmed).*');
  return lines.join('\n');
}