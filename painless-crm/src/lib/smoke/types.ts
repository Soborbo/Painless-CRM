export type SmokeTestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'partial';

export type SmokeTestName = 'pdf' | 'image' | 'realtime' | 'excel';

export interface SmokeTestResult {
  name: SmokeTestName;
  status: SmokeTestStatus;
  note: string;
  durationMs?: number;
}
