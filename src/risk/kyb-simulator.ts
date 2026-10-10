import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { RiskStatus } from '../applications/enums/risk-status.enum';

/**
 * Thrown to represent a *transient* failure of the upstream KYB provider
 * (timeout / 5xx). This is NOT a business rejection — it signals BullMQ to
 * retry the job. A high-risk verdict, by contrast, is a successful RETURN
 * value, never an exception.
 */
export class RiskServiceUnavailableError extends Error {
  constructor(message = 'KYB provider temporarily unavailable') {
    super(message);
    this.name = 'RiskServiceUnavailableError';
  }
}

export interface KybResult {
  riskStatus: RiskStatus.LOW | RiskStatus.MEDIUM | RiskStatus.HIGH;
  score: number;
  reason: string;
}

/** Attempt index (0-based) at/after which the simulated outage recovers. */
export const SIMULATED_OUTAGE_RECOVERS_AT_ATTEMPT = 2;

/**
 * Deterministic fake of a third-party risk/KYB call so behaviour is testable
 * without real randomness.
 *
 * Triggers (driven off the application's own data):
 *  - business name contains "TIMEOUT"  -> throws on the first attempts,
 *    then succeeds (demonstrates retry + backoff)
 *  - business name contains "HIGHRISK" -> HIGH verdict
 *  - otherwise the verdict is derived from requested processing volume
 */
export function simulateKyb(
  application: MerchantApplication,
  attemptsMade: number,
): KybResult {
  const name = (application.businessName ?? '').toUpperCase();

  // --- Transient outage simulation (recovers after a couple of retries) ---
  if (
    name.includes('TIMEOUT') &&
    attemptsMade < SIMULATED_OUTAGE_RECOVERS_AT_ATTEMPT
  ) {
    throw new RiskServiceUnavailableError();
  }

  // --- Business verdict (a successful result, not an error) ---
  if (name.includes('HIGHRISK')) {
    return {
      riskStatus: RiskStatus.HIGH,
      score: 85,
      reason: 'Flagged business profile',
    };
  }

  const volume = Number(application.monthlyProcessingVolume ?? 0);
  if (volume > 1_000_000) {
    return {
      riskStatus: RiskStatus.HIGH,
      score: 80,
      reason: 'High requested processing volume',
    };
  }
  if (volume > 250_000) {
    return {
      riskStatus: RiskStatus.MEDIUM,
      score: 55,
      reason: 'Moderate requested processing volume',
    };
  }
  return {
    riskStatus: RiskStatus.LOW,
    score: 20,
    reason: 'Within normal thresholds',
  };
}
