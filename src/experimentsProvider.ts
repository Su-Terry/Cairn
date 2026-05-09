import * as vscode from 'vscode';

/**
 * Provides items shown in the Cairn Experiments view.
 * For now, returns a single placeholder. Will read experiments.jsonl later.
 */
export class ExperimentsProvider implements vscode.TreeDataProvider<ExperimentItem> {

  private _onDidChangeTreeData = new vscode.EventEmitter<ExperimentItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExperimentItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExperimentItem): Thenable<ExperimentItem[]> {
    if (element) {
      // Children of an experiment item — none yet
      return Promise.resolve([]);
    }

    // Root level — placeholder
    return Promise.resolve([
      new ExperimentItem('No experiments yet', 'Add one to get started.', vscode.TreeItemCollapsibleState.None)
    ]);
  }
}

class ExperimentItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}: ${this.description}`;
    this.description = description;
  }
}