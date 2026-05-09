import * as vscode from 'vscode';
import { ExperimentsProvider } from './experimentsProvider';
import { createBriefCommand } from './createBrief';

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

  const watcher = vscode.workspace.createFileSystemWatcher('**/experiments.jsonl');
  watcher.onDidChange(() => experimentsProvider.refresh());
  watcher.onDidCreate(() => experimentsProvider.refresh());
  watcher.onDidDelete(() => experimentsProvider.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate() {}