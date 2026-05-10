import * as vscode from 'vscode';
import { Experiment } from './types';
import { loadExperiments } from './experimentStore';

type Format = 'latex' | 'markdown';

/**
 * Export experiments to a LaTeX or Markdown table.
 * Opens result in a new untitled editor.
 */
export async function exportTableCommand(): Promise<void> {
  const experiments = await loadExperiments();
  if (experiments.length === 0) {
    vscode.window.showInformationMessage(
      'Cairn: no experiments to export.'
    );
    return;
  }

  // 1. Pick format
  const format = await pickFormat();
  if (!format) return;

  // 2. Pick experiments
  const selectedExps = await pickExperiments(experiments);
  if (!selectedExps || selectedExps.length === 0) return;

  // 3. Pick metric columns
  const metricCols = await pickMetrics(selectedExps);
  if (metricCols === undefined) return;

  // 4. Render
  const tableText = renderTable(selectedExps, metricCols, format);

  // 5. Open in untitled editor
  const lang = format === 'latex' ? 'latex' : 'markdown';
  const doc = await vscode.workspace.openTextDocument({
    content: tableText,
    language: lang
  });
  await vscode.window.showTextDocument(doc);
}

async function pickFormat(): Promise<Format | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'LaTeX (booktabs)', value: 'latex' as const },
      { label: 'Markdown', value: 'markdown' as const }
    ],
    {
      title: 'Export Table — Format',
      placeHolder: 'Pick output format',
      ignoreFocusOut: true
    }
  );
  return choice?.value;
}

async function pickExperiments(all: Experiment[]): Promise<Experiment[] | undefined> {
  const items = all.map(e => ({
    label: e.id,
    description: `${e.method} · ${e.status}`,
    detail: e.hypothesis,
    picked: true,
    experiment: e
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Export Table — Select experiments',
    placeHolder: 'Toggle experiments to include',
    canPickMany: true,
    ignoreFocusOut: true
  });

  if (!picked) return undefined;
  return picked.map(p => p.experiment);
}

async function pickMetrics(exps: Experiment[]): Promise<string[] | undefined> {
  // Collect union of all metric keys across selected experiments
  const allKeys = new Set<string>();
  for (const exp of exps) {
    for (const k of Object.keys(exp.metrics)) {
      allKeys.add(k);
    }
  }

  if (allKeys.size === 0) {
    return [];
  }

  const items = Array.from(allKeys).sort().map(k => ({
    label: k,
    picked: true
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Export Table — Select metric columns',
    placeHolder: 'Toggle metrics to include (id, method, status are always included)',
    canPickMany: true,
    ignoreFocusOut: true
  });

  if (!picked) return undefined;
  return picked.map(p => p.label);
}

function renderTable(
  exps: Experiment[],
  metricCols: string[],
  format: Format
): string {
  const headers = ['ID', 'Method', 'Status', ...metricCols];
  const rows: string[][] = exps.map(exp => {
    const fixedCols = [exp.id, exp.method, exp.status];
    const metricVals = metricCols.map(k => formatMetric(exp.metrics[k]));
    return [...fixedCols, ...metricVals];
  });

  if (format === 'latex') {
    return renderLatex(headers, rows);
  } else {
    return renderMarkdown(headers, rows);
  }
}

function formatMetric(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function escapeLatex(s: string): string {
  // Escape LaTeX special characters
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/_/g, '\\_')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}');
}

function renderLatex(headers: string[], rows: string[][]): string {
  const colSpec = 'l'.repeat(headers.length);
  const escapedHeaders = headers.map(escapeLatex).join(' & ');
  const escapedRows = rows.map(r =>
    r.map(escapeLatex).join(' & ') + ' \\\\'
  );

  const lines: string[] = [];
  lines.push(`\\begin{tabular}{${colSpec}}`);
  lines.push('\\toprule');
  lines.push(escapedHeaders + ' \\\\');
  lines.push('\\midrule');
  lines.push(...escapedRows);
  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  return lines.join('\n');
}

function renderMarkdown(headers: string[], rows: string[][]): string {
  const headerLine = '| ' + headers.join(' | ') + ' |';
  const separator = '|' + headers.map(() => '---').join('|') + '|';
  const rowLines = rows.map(r => '| ' + r.join(' | ') + ' |');

  return [headerLine, separator, ...rowLines].join('\n');
}