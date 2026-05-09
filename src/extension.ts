import * as vscode from 'vscode';
import { ExperimentsProvider } from './experimentsProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Cairn extension activated');

  // Hello World command (kept for now, useful for debugging)
  const helloDisposable = vscode.commands.registerCommand('cairn.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Cairn!');
  });
  context.subscriptions.push(helloDisposable);

  // Register the Experiments tree view
  const experimentsProvider = new ExperimentsProvider();
  const treeView = vscode.window.createTreeView('cairn.experiments', {
    treeDataProvider: experimentsProvider
  });
  context.subscriptions.push(treeView);
}

export function deactivate() {}