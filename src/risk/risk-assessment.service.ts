import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { RiskStatus } from '../applications/enums/risk-status.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { simulateKyb } from './kyb-simulator';

@Injectable()
export class RiskAssessmentService {
  private readonly logger = new Logger(RiskAssessmentService.name);

  constructor(
    @InjectRepository(MerchantApplication)
    private readonly apps: Repository<MerchantApplication>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Run the (simulated) KYB assessment and persist the verdict.
   *
   * Idempotent: if a verdict has already been recorded (riskStatus is no
   * longer PENDING), the job is a no-op. This makes duplicate/retried job
   * executions safe — we never apply a result twice.
   *
   * May throw RiskServiceUnavailableError, which the worker lets propagate so
   * BullMQ retries with backoff.
   */
  async assess(applicationId: string, attemptsMade: number): Promise<void> {
    const application = await this.apps.findOne({
      where: { id: applicationId },
    });
    if (!application) {
      this.logger.warn(
        `Application ${applicationId} not found; skipping assessment`,
      );
      return;
    }

    if (application.riskStatus !== RiskStatus.PENDING) {
      this.logger.log(
        `Application ${applicationId} already assessed (${application.riskStatus}); skipping (idempotent)`,
      );
      return;
    }

    // Throws on simulated transient outage -> propagates to worker -> retried.
    const result = simulateKyb(application, attemptsMade);

    await this.apps.update(
      { id: applicationId, riskStatus: RiskStatus.PENDING },
      {
        riskStatus: result.riskStatus,
        riskScore: result.score,
        riskReason: result.reason,
      },
    );

    await this.audit.record({
      action: AuditAction.RISK_ASSESSED,
      actorId: null, // system-originated
      applicationId,
      metadata: {
        riskStatus: result.riskStatus,
        score: result.score,
        reason: result.reason,
      },
    });

    this.logger.log(
      `Application ${applicationId} assessed: ${result.riskStatus} (score ${result.score})`,
    );
  }

  /**
   * Terminal failure path: all retries exhausted. Mark the application's risk
   * as FAILED (an infrastructure outcome) — only if still PENDING so we never
   * clobber a verdict that did land.
   */
  async markFailed(applicationId: string, reason: string): Promise<void> {
    const res = await this.apps.update(
      { id: applicationId, riskStatus: RiskStatus.PENDING },
      {
        riskStatus: RiskStatus.FAILED,
        riskReason: `Risk check failed: ${reason}`,
      },
    );
    if (res.affected) {
      await this.audit.record({
        action: AuditAction.RISK_ASSESSED,
        actorId: null,
        applicationId,
        metadata: { riskStatus: RiskStatus.FAILED, reason },
      });
      this.logger.error(
        `Application ${applicationId} risk assessment FAILED: ${reason}`,
      );
    }
  }
}
