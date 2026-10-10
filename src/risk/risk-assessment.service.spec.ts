import { Repository } from 'typeorm';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { RiskStatus } from '../applications/enums/risk-status.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { RiskAssessmentService } from './risk-assessment.service';

describe('RiskAssessmentService', () => {
  let repo: jest.Mocked<
    Pick<Repository<MerchantApplication>, 'findOne' | 'update'>
  >;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let service: RiskAssessmentService;

  const baseApp = (
    overrides: Partial<MerchantApplication> = {},
  ): MerchantApplication =>
    ({
      id: 'app-1',
      businessName: 'Acme',
      monthlyProcessingVolume: 1000,
      riskStatus: RiskStatus.PENDING,
      ...overrides,
    }) as MerchantApplication;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new RiskAssessmentService(
      repo as unknown as Repository<MerchantApplication>,
      audit as unknown as AuditService,
    );
  });

  it('persists a verdict and audits when the application is PENDING', async () => {
    repo.findOne.mockResolvedValue(baseApp());
    await service.assess('app-1', 0);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'app-1', riskStatus: RiskStatus.PENDING },
      expect.objectContaining({ riskStatus: RiskStatus.LOW }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.RISK_ASSESSED }),
    );
  });

  it('is idempotent: skips when a verdict already exists', async () => {
    repo.findOne.mockResolvedValue(baseApp({ riskStatus: RiskStatus.HIGH }));
    await service.assess('app-1', 0);

    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no-ops when the application no longer exists', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.assess('missing', 0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rethrows transient outages (so BullMQ retries) without persisting', async () => {
    repo.findOne.mockResolvedValue(baseApp({ businessName: 'TIMEOUT Co' }));
    await expect(service.assess('app-1', 0)).rejects.toThrow();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('markFailed sets FAILED only when still PENDING (guarded update)', async () => {
    await service.markFailed('app-1', 'upstream down');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'app-1', riskStatus: RiskStatus.PENDING },
      expect.objectContaining({ riskStatus: RiskStatus.FAILED }),
    );
    expect(audit.record).toHaveBeenCalled();
  });
});
