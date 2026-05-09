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
  lines.push(`Please implement the experiment described in \`${exp.brief}\`.`);
  lines.push('');
  lines.push(`The brief contains the hypothesis, the variant, the success criterion, and explicit instructions on how to update \`experiments.jsonl\` after the run completes.`);
  lines.push('');
  lines.push('Important reminders:');
  lines.push('- Do NOT fork new training scripts. Use config flags or new config files.');
  lines.push('- Search the existing codebase for similar implementations before writing new code.');
  lines.push(`- After the run, update the row with \`"id": "${exp.id}"\` in \`experiments.jsonl\`. Do not modify other rows.`);
  return lines.join('\n');
}