import * as vscode from 'vscode';
import { ExperimentsProvider } from './experimentsProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Cairn extension activated');

  const helloDisposable = vscode.commands.registerCommand('cairn.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Cairn!');
  });
  context.subscriptions.push(helloDisposable);

  // Tree view + provider
  const experimentsProvider = new ExperimentsProvider();
  const treeView = vscode.window.createTreeView('cairn.experiments', {
    treeDataProvider: experimentsProvider
  });
  context.subscriptions.push(treeView);

  // Manual refresh command
  const refreshDisposable = vscode.commands.registerCommand('cairn.refreshExperiments', () => {
    experimentsProvider.refresh();
  });
  context.subscriptions.push(refreshDisposable);

  // Auto refresh: watch experiments.jsonl in any workspace folder
  const watcher = vscode.workspace.createFileSystemWatcher('**/experiments.jsonl');
  watcher.onDidChange(() => experimentsProvider.refresh());
  watcher.onDidCreate(() => experimentsProvider.refresh());
  watcher.onDidDelete(() => experimentsProvider.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate() {}