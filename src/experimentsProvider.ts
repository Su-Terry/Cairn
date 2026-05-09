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

  async getChildren(element?: ExperimentItem): Promise<ExperimentItem[]> {
    if (element) {
      return [];
    }

    const experiments = await loadExperiments();

    if (experiments.length === 0) {
      const placeholder = new ExperimentItem(
        'No experiments yet',
        'Create experiments.jsonl in workspace root to get started',
        vscode.TreeItemCollapsibleState.None
      );
      return [placeholder];
    }

    // Newest first
    const sorted = [...experiments].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.map(exp => ExperimentItem.fromExperiment(exp));
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

  static fromExperiment(exp: Experiment): ExperimentItem {
    const label = exp.id;
    const metricSummary = formatMetrics(exp.metrics);
    const description = `${exp.method} · ${metricSummary} · ${exp.status}`;

    const item = new ExperimentItem(label, description, vscode.TreeItemCollapsibleState.None, exp);
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