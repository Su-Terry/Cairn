export interface Experiment {
  id: string;
  date: string;
  hypothesis: string;
  method: string;
  config?: string;
  metrics: Record<string, number>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'inconclusive';
  notes?: string;

  // Brief-driven workflow fields
  brief?: string;           // path to briefs/exp_NNN.md
  baseline?: string;        // id of experiment this forks from (e.g. "exp_003")
  variant?: string;         // what changed vs. baseline (one line)
  expected?: string;        // success criterion (e.g. "val_acc_ood > 0.70")
}