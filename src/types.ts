export interface Experiment {
  id: string;
  date: string;
  hypothesis: string;
  method: string;
  config?: string;
  metrics: Record<string, number>;
  status: 'success' | 'failed' | 'running' | 'inconclusive';
  notes?: string;
}