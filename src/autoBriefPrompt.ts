import { Experiment } from './types';

export function buildAutoBriefPrompt(
  userInput: string,
  experiments: Experiment[]
): string {
  // Compact existing experiments — give LLM context for choosing baseline
  const expSummary = experiments.length === 0
    ? '(no existing experiments — this would be the first brief)'
    : experiments.map(e => {
        const metrics = Object.entries(e.metrics)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        return `- ${e.id} (${e.method}, ${e.status})${metrics ? ': ' + metrics : ''}: ${e.hypothesis}`;
      }).join('\n');

  return `You are helping draft a Cairn experiment brief.

Cairn is a research workflow tool. An experiment brief has these fields:

- hypothesis: what is being tested (1-2 sentences, specific)
- baseline_id: id of an existing experiment to fork from, or null if no clear parent
- variant: precise description of what changes from baseline (1-3 sentences)
- success_criterion: when do we call this a win (quantitative if possible)
- execution_mode: "agent" if training fits in agent session (mins-hours), "human" if training is long (days) or needs manual GPU control
- completion_checklist: array of 3-6 concrete actionable items that must be done before claiming completion
- method_label: short identifier for results table (e.g., "dit-s2-wd-p4")

Existing experiments in this workspace:

${expSummary}

The user wants to test:

> ${userInput}

Draft a brief as a JSON object with all 7 fields. Choose baseline_id by matching user intent to existing experiments — pick the one whose metrics this experiment will anchor against. If no obvious parent exists, set baseline_id to null.

For execution_mode, default to "agent" unless the user mentions long training, no GPU, manual control, or the chosen baseline used "human" mode.

Respond with ONLY the JSON object, no preamble or explanation. The JSON must parse with JSON.parse() — no markdown fences, no comments.`;
}

export interface AutoBriefDraft {
  hypothesis: string;
  baseline_id: string | null;
  variant: string;
  success_criterion: string;
  execution_mode: 'agent' | 'human';
  completion_checklist: string[];
  method_label: string;
}

/**
 * Parse the LLM's JSON response into an AutoBriefDraft.
 * Throws if response is malformed.
 */
export function parseAutoBriefDraft(rawResponse: string): AutoBriefDraft {
  // Strip potential markdown fences (LLM sometimes wraps JSON in ```json ... ```)
  let cleaned = rawResponse.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
    const lastFence = cleaned.lastIndexOf('```');
    if (lastFence !== -1) {
      cleaned = cleaned.slice(0, lastFence).trim();
    }
  }

  const obj = JSON.parse(cleaned);

  // Validate required fields
  if (typeof obj.hypothesis !== 'string') throw new Error('Missing or invalid hypothesis');
  if (obj.baseline_id !== null && typeof obj.baseline_id !== 'string') throw new Error('Invalid baseline_id');
  if (typeof obj.variant !== 'string') throw new Error('Missing or invalid variant');
  if (typeof obj.success_criterion !== 'string') throw new Error('Missing or invalid success_criterion');
  if (obj.execution_mode !== 'agent' && obj.execution_mode !== 'human') throw new Error('Invalid execution_mode');
  if (!Array.isArray(obj.completion_checklist)) throw new Error('Missing completion_checklist');
  if (typeof obj.method_label !== 'string') throw new Error('Missing or invalid method_label');

  return {
    hypothesis: obj.hypothesis,
    baseline_id: obj.baseline_id,
    variant: obj.variant,
    success_criterion: obj.success_criterion,
    execution_mode: obj.execution_mode,
    completion_checklist: obj.completion_checklist.map((s: any) => String(s)),
    method_label: obj.method_label,
  };
}