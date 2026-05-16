import * as vscode from 'vscode';
import { Experiment } from './types';
import { loadExperiments } from './experimentStore';

export class ExperimentsProvider implements vscode.TreeDataProvider<ExperimentItem> {

  private _onDidChangeTreeData = new vscode.EventEmitter<ExperimentItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExperimentItem): vscode.TreeItem {
    return element;
  }

  /**
   * Build a map from parent experiment ID to array of child experiments.
   * Detects circular references by walking up the baseline chain.
   * Experiments with circular references are excluded from the map and returned in circularSet (treated as root-level).
   *
   * @returns [childrenMap, circularSet] - Map of parent→children and Set of experiment IDs in circular chains
   */
  private buildChildrenMap(experiments: Experiment[]): [Map<string, Experiment[]>, Set<string>] {
    const childrenMap = new Map<string, Experiment[]>();
    const circularSet = new Set<string>();
    const existingIds = new Set(experiments.map(e => e.id));
    const experimentById = new Map(experiments.map(e => [e.id, e]));

    for (const exp of experiments) {
      if (exp.baseline && existingIds.has(exp.baseline)) {
        // Check for circular reference by walking up the baseline chain
        const visited = new Set<string>();
        let current: string | undefined = exp.baseline;
        let hasCycle = false;

        visited.add(exp.id);
        while (current && existingIds.has(current)) {
          if (visited.has(current)) {
            hasCycle = true;
            console.warn(`Cairn: circular baseline reference detected for ${exp.id}, treating as root-level experiment`);
            circularSet.add(exp.id);
            break;
          }
          visited.add(current);
          const parent = experimentById.get(current);
          current = parent?.baseline;
        }

        if (!hasCycle) {
          const children = childrenMap.get(exp.baseline) || [];
          children.push(exp);
          childrenMap.set(exp.baseline, children);
        }
      }
    }

    return [childrenMap, circularSet];
  }

  async getChildren(element?: ExperimentItem): Promise<ExperimentItem[]> {
    const experiments = await loadExperiments();

    if (experiments.length === 0) {
      const placeholder = new ExperimentItem(
        'No experiments yet',
        'Create experiments.jsonl in workspace root to get started',
        vscode.TreeItemCollapsibleState.None
      );
      return [placeholder];
    }

    // Build parent-child map once per call; also get circular reference set
    const [childrenMap, circularSet] = this.buildChildrenMap(experiments);
    const existingIds = new Set(experiments.map(e => e.id));

    // Note: expand state is ephemeral (not persisted across reload), this is by design in 0.13

    if (!element) {
      // Root level: show experiments with no baseline OR baseline points to non-existent ID OR in circular chain
      const rootExperiments = experiments.filter(exp =>
        !exp.baseline || !existingIds.has(exp.baseline) || circularSet.has(exp.id)
      );

      // Sort root level: newest first
      const sorted = [...rootExperiments].sort((a, b) => b.date.localeCompare(a.date));
      return sorted.map(exp => ExperimentItem.fromExperiment(exp, childrenMap));
    } else {
      // Child level: find all experiments where baseline === element.experiment.id
      const children = childrenMap.get(element.experiment!.id) || [];

      // Sort children: newest first
      const sorted = [...children].sort((a, b) => b.date.localeCompare(a.date));
      return sorted.map(exp => ExperimentItem.fromExperiment(exp, childrenMap));
    }
  }
}

class ExperimentItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly experiment?: Experiment
  ) {
    super(label, collapsibleState);
    this.description = description;
    if (experiment) {
      this.contextValue = `cairnExperiment.${experiment.status}`;
    }
  }

  static fromExperiment(exp: Experiment, childrenMap: Map<string, Experiment[]>): ExperimentItem {
    const label = exp.id;
    const metricSummary = formatMetrics(exp.metrics);
    const description = `${exp.method} · ${metricSummary} · ${exp.status}`;

    // Determine if this experiment has children
    const hasChildren = childrenMap.has(exp.id) && (childrenMap.get(exp.id)!.length > 0);
    const collapsibleState = hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const item = new ExperimentItem(label, description, collapsibleState, exp);
    item.tooltip = buildTooltip(exp);
    item.iconPath = new vscode.ThemeIcon(iconForStatus(exp.status));
    return item;
  }
}

function formatMetrics(metrics: Record<string, number>): string {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return 'no metrics';
  return entries.map(([k, v]) => `${k}=${v}`).join(', ');
}

function iconForStatus(status: Experiment['status']): string {
  switch (status) {
    case 'pending': return 'circle-outline';
    case 'running': return 'sync~spin';
    case 'success': return 'pass';
    case 'partial': return 'pass-filled';
    case 'failed': return 'error';
    case 'inconclusive': return 'question';
  }
}

function buildTooltip(exp: Experiment): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${exp.id}** · ${exp.date}\n\n`);
  md.appendMarkdown(`*Method:* ${exp.method}\n\n`);
  md.appendMarkdown(`*Hypothesis:* ${exp.hypothesis}\n\n`);
  md.appendMarkdown(`*Status:* ${exp.status}\n\n`);
  if (exp.notes) {
    md.appendMarkdown(`*Notes:* ${exp.notes}\n\n`);
  }
  return md;
}