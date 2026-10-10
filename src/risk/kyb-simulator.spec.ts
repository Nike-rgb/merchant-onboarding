import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { RiskStatus } from '../applications/enums/risk-status.enum';
import {
  RiskServiceUnavailableError,
  SIMULATED_OUTAGE_RECOVERS_AT_ATTEMPT,
  simulateKyb,
} from './kyb-simulator';

function app(partial: Partial<MerchantApplication>): MerchantApplication {
  return {
    businessName: 'Acme',
    monthlyProcessingVolume: 1000,
    ...partial,
  } as MerchantApplication;
}

describe('simulateKyb', () => {
  it('returns a LOW verdict for small volume', () => {
    const result = simulateKyb(app({ monthlyProcessingVolume: 1000 }), 0);
    expect(result.riskStatus).toBe(RiskStatus.LOW);
  });

  it('returns MEDIUM then HIGH as volume grows', () => {
    expect(
      simulateKyb(app({ monthlyProcessingVolume: 300_000 }), 0).riskStatus,
    ).toBe(RiskStatus.MEDIUM);
    expect(
      simulateKyb(app({ monthlyProcessingVolume: 2_000_000 }), 0).riskStatus,
    ).toBe(RiskStatus.HIGH);
  });

  it('treats a HIGHRISK business name as a HIGH verdict (a value, not an error)', () => {
    const result = simulateKyb(app({ businessName: 'HIGHRISK Imports' }), 0);
    expect(result.riskStatus).toBe(RiskStatus.HIGH);
  });

  it('throws a transient error for a TIMEOUT business on early attempts', () => {
    expect(() => simulateKyb(app({ businessName: 'TIMEOUT Co' }), 0)).toThrow(
      RiskServiceUnavailableError,
    );
    expect(() => simulateKyb(app({ businessName: 'TIMEOUT Co' }), 1)).toThrow(
      RiskServiceUnavailableError,
    );
  });

  it('recovers (returns a verdict) once retries reach the recovery attempt', () => {
    const result = simulateKyb(
      app({ businessName: 'TIMEOUT Co', monthlyProcessingVolume: 1000 }),
      SIMULATED_OUTAGE_RECOVERS_AT_ATTEMPT,
    );
    expect(result.riskStatus).toBe(RiskStatus.LOW);
  });
});
