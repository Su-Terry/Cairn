export interface Experiment {
  id: string;
  date: string;
  hypothesis: string;
  method: string;
  config?: string;
  metrics: Record<string, number>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'inconclusive' | 'partial';
  notes?: string;

  brief?: string;
  baseline?: string;
  variant?: string;
  successCriterion?: string;
  completionChecklist?: string;

  // Pass 3 additions
  methodFile?: string;     // path to methods/exp_NNN.md
  commitHash?: string;     // git commit at experiment completion
  executionMode?: 'agent' | 'human';
  gitWorktreePath?: string;  // path to git worktree if experiment runs in isolated tree
}