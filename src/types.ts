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
}