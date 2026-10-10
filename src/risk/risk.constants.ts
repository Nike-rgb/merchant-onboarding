export const RISK_QUEUE = 'risk-review';
export const RISK_JOB = 'assess';

/** Total attempts (1 initial + retries) before an application is marked FAILED. */
export const RISK_MAX_ATTEMPTS = 3;

/** Base delay (ms) for exponential backoff between retries. */
export const RISK_BACKOFF_MS = 1000;

export interface RiskJobData {
  applicationId: string;
}
