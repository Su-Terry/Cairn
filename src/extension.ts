import * as vscode from 'vscode';
import { ExperimentsProvider } from './experimentsProvider';
import { createBriefCommand } from './createBrief';
import { copyAgentPromptCommand } from './copyAgentPrompt';
import { changeStatusCommand } from './changeStatus';
import { exportTableCommand } from './exportTable';
import { Experiment } from './types';

export function activate(context: vscode.ExtensionContext) {
  console.log('Cairn extension activated');

  const helloDisposable = vscode.commands.registerCommand('cairn.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Cairn!');
  });
  context.subscriptions.push(helloDisposable);

  const experimentsProvider = new ExperimentsProvider();
  const treeView = vscode.window.createTreeView('cairn.experiments', {
    treeDataProvider: experimentsProvider
  });
  context.subscriptions.push(treeView);

  const refreshDisposable = vscode.commands.registerCommand('cairn.refreshExperiments', () => {
    experimentsProvider.refresh();
  });
  context.subscriptions.push(refreshDisposable);

  const createBriefDisposable = vscode.commands.registerCommand(
    'cairn.createBrief',
    createBriefCommand
  );
  context.subscriptions.push(createBriefDisposable);

  const copyPromptDisposable = vscode.commands.registerCommand(
    'cairn.copyAgentPrompt',
    (item: { experiment?: Experiment }) => {
      return copyAgentPromptCommand(item?.experiment);
    }
  );
  context.subscriptions.push(copyPromptDisposable);

  const changeStatusDisposable = vscode.commands.registerCommand(
    'cairn.changeStatus',
    (item: { experiment?: Experiment }) => {
      return changeStatusCommand(item?.experiment);
    }
  );
  context.subscriptions.push(changeStatusDisposable);

  const exportTableDisposable = vscode.commands.registerCommand(
    'cairn.exportTable',
    () => {
      return exportTableCommand();
    }
  );
  context.subscriptions.push(exportTableDisposable);

  const watcher = vscode.workspace.createFileSystemWatcher('**/experiments.jsonl');
  watcher.onDidChange(() => experimentsProvider.refresh());
  watcher.onDidCreate(() => experimentsProvider.refresh());
  watcher.onDidDelete(() => experimentsProvider.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate() {}