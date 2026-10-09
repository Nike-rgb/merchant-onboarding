/**
 * Risk outcome is a separate axis from application status.
 * PENDING  -> not yet assessed (initial, and while the job is queued/running)
 * LOW/MEDIUM/HIGH -> the KYB verdict (a successful assessment result)
 * FAILED   -> the upstream risk service could not be reached after retries
 *             (an infrastructure outcome, NOT a business rejection)
 */
export enum RiskStatus {
  PENDING = 'PENDING',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  FAILED = 'FAILED',
}
