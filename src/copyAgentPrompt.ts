import * as vscode from 'vscode';
import { Experiment } from './types';

type WorkMode = 'ablation' | 'retroactive' | 'infrastructure' | 'codebase';

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

  // Read brief file to detect mode
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Cairn: no workspace folder open.');
    return;
  }

  const briefUri = vscode.Uri.joinPath(workspaceFolder.uri, experiment.brief);
  let mode: WorkMode = 'ablation';
  try {
    const briefBytes = await vscode.workspace.fs.readFile(briefUri);
    const briefContent = Buffer.from(briefBytes).toString('utf-8');
    mode = detectModeFromBrief(briefContent);
  } catch (err) {
    console.warn(`Cairn: could not read brief file ${experiment.brief}, defaulting to ablation mode`);
  }

  const prompt = renderAgentPrompt(experiment, mode);

  await vscode.env.clipboard.writeText(prompt);

  vscode.window.showInformationMessage(
    `Cairn: prompt for ${experiment.id} copied. Paste it into your agent (Cmd+V).`
  );
}

/**
 * Detect work mode from brief markdown preamble.
 * Checks first line for blockquote markers added by createBrief.ts.
 */
function detectModeFromBrief(briefContent: string): WorkMode {
  const line1 = briefContent.split('\n')[0];
  if (line1.includes('> **Retroactive registration**')) {
    return 'retroactive';
  }
  if (line1.includes('> **Infrastructure brief**')) {
    return 'infrastructure';
  }
  if (line1.includes('> **Codebase understanding brief**')) {
    return 'codebase';
  }
  return 'ablation';
}

function renderAgentPrompt(exp: Experiment, mode: WorkMode): string {
  const lines: string[] = [];
  const isHumanMode = exp.executionMode === 'human';

  // Opening line varies by mode
  switch (mode) {
    case 'ablation':
      lines.push(`Please implement the experiment described in \`${exp.brief}\`.`);
      break;
    case 'retroactive':
      lines.push(`Please document the completed experiment described in \`${exp.brief}\`.`);
      break;
    case 'infrastructure':
      lines.push(`Please build the component/interface described in \`${exp.brief}\`.`);
      break;
    case 'codebase':
      lines.push(`Please explore and document the codebase as described in \`${exp.brief}\`.`);
      break;
  }

  lines.push('');
  lines.push(`The brief contains the hypothesis, the variant, the success criterion, an explicit completion checklist, and instructions on how to update \`experiments.jsonl\` after completion.`);
  lines.push('');
  lines.push('Important reminders:');

  // Mode-specific instructions
  if (mode === 'retroactive') {
    lines.push('- **This is retroactive registration.** DO NOT re-run, re-train, or re-execute anything.');
    lines.push('- Read any referenced artifacts (logs, configs, commit diffs) to understand what was done.');
    lines.push('- Write `methods/*.md` in PAST TENSE describing what WAS done.');
    lines.push('- If result numbers are provided in the brief or artifacts, record them verbatim in Notable observations.');
    lines.push('- Flag gaps where the historical record is incomplete.');
  } else if (mode === 'infrastructure') {
    lines.push('- Do NOT run training or compare metrics. This is infrastructure work.');
    lines.push('- Write integration tests for the component.');
    lines.push('- Search the existing codebase for similar implementations before writing new code.');
    lines.push('- Everything not explicitly mentioned in the variant stays unchanged from baseline.');
  } else if (mode === 'codebase') {
    lines.push('- Do NOT implement code changes. This is a codebase understanding exercise.');
    lines.push('- Read modules systematically and build a mental model.');
    lines.push('- Focus on documenting architecture, key abstractions, and data flow.');
  } else {
    // ablation mode
    lines.push('- Do NOT fork new training scripts. Use config flags or new config files.');
    lines.push('- Search the existing codebase for similar implementations before writing new code.');
    lines.push('- Everything not explicitly mentioned in the variant stays unchanged from baseline.');
  }

  // Lineage reminder (all modes except codebase)
  if (mode !== 'codebase') {
    lines.push(`- If this experiment forks from a parent (see \`## Lineage\` in the brief), use the parent's metrics from \`experiments.jsonl\` as your baseline anchor. Do NOT rerun the parent; reference its \`methodFile\` for implementation details.`);
  }

  // Codebase exploration (all modes)
  if (mode === 'retroactive') {
    // Skip exploration for retroactive - work is already done
  } else if (mode === 'codebase') {
    lines.push(`- **Follow the \`## Codebase exploration\` protocol in the brief.** This is the core work for codebase understanding mode:`);
    lines.push('  1. Read README.md if it exists; otherwise list root files for orientation');
    lines.push('  2. Identify the entry point of the subsystem being documented');
    lines.push('  3. Identify config files (configs/, *.yaml, *.json)');
    lines.push('  4. Identify key modules and their relationships');
    lines.push('  5. Read the entry point and representative files to understand the system');
    lines.push('  6. State back briefly what you found before proceeding to write method.md');
  } else {
    lines.push(`- **Before writing code, follow the \`## Codebase exploration\` protocol in the brief.** Read the entry point, identify configs, and state your understanding back briefly. Skip exploration only for trivial single-parameter changes.`);
  }

  // Checklist verification
  if (isHumanMode && mode !== 'retroactive') {
    lines.push(`- **Execution mode: Human.** You design and prepare the code; the user runs the training. Do NOT attempt to run training yourself. Provide the user with the exact command to run, then wait for them to report results.`);
    lines.push(`- After the user reports results, work with them to verify every item in the completion checklist. Status must be \`partial\` or \`inconclusive\` if any checklist item is incomplete, never \`success\`.`);
  } else {
    lines.push(`- **Before claiming completion, verify every item in the completion checklist.** Status must be \`partial\` or \`inconclusive\` if any checklist item is incomplete, never \`success\`.`);
  }

  // Method.md instruction
  if (mode === 'codebase') {
    lines.push(`- **Write \`methods/${exp.id}.md\`** with the six structured sections specified in the brief. For codebase understanding mode, emphasize: Architecture (module overview), Design rationale (key abstractions), Design decisions worth noting (data flow, input→output with shapes/types), Notable observations (gotchas + open questions).`);
  } else if (mode === 'infrastructure') {
    lines.push(`- **Write \`methods/${exp.id}.md\`** with the six structured sections specified in the brief. For infrastructure mode, emphasize: Architecture (component structure, interfaces), Design rationale (why this design vs alternatives), Design decisions worth noting (dependencies, non-default choices).`);
  } else {
    lines.push(`- **Write \`methods/${exp.id}.md\`** with the six structured sections specified in the brief (Architecture, Hyperparameters, What is specifically different from baseline, Design rationale, Design decisions worth noting, Notable observations). This is required, not optional. Especially the **Design rationale** section: explicitly justify any parameter choices not dictated by the brief.`);
  }

  // Commit instructions
  if (mode === 'retroactive') {
    lines.push(`- **Empty commit anchor.** After writing method.md, create an empty commit: \`git commit --allow-empty -m "${exp.id}: retroactive documentation"\` and capture the commit hash for the jsonl entry.`);
  } else if (mode === 'codebase') {
    lines.push(`- **Empty commit anchor.** After writing method.md, create an empty commit: \`git commit --allow-empty -m "${exp.id}: ${exp.method} (no code change)"\` and capture the commit hash for the jsonl entry.`);
  } else if (isHumanMode) {
    lines.push(`- **The user commits.** After successful training, ask the user to commit with \`git add -A && git commit -m "${exp.id}: <one-line summary>"\` and to share the commit hash with you.`);
  } else {
    lines.push(`- **Commit your changes** with a message starting \`${exp.id}:\` and capture the commit hash for the jsonl entry.`);
  }

  // JSONL append instruction
  if (isHumanMode && mode !== 'retroactive' && mode !== 'codebase') {
    lines.push(`- After the user reports results, **append** an updated copy of the row with \`"id": "${exp.id}"\` to \`experiments.jsonl\` (including \`methodFile\` and \`commitHash\`). Either you append it via Bash \`echo '<json>' >> experiments.jsonl\`, or guide the user to do so. Do NOT use the Edit tool, do NOT rewrite the file. Cairn folds by id at read time.`);
  } else {
    lines.push(`- After completion, **append** an updated copy of the row with \`"id": "${exp.id}"\` to \`experiments.jsonl\` (including \`methodFile\` and \`commitHash\`). Use Bash \`echo '<json>' >> experiments.jsonl\` — do NOT use the Edit tool, do NOT rewrite the file. Cairn folds by id at read time.`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Recommended for Claude Code: press **Shift+Tab** to enable auto-accept edits (file edits auto-allowed, bash commands still confirmed).*');
  return lines.join('\n');
}