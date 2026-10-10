import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RISK_MAX_ATTEMPTS, RISK_QUEUE, RiskJobData } from './risk.constants';
import { RiskAssessmentService } from './risk-assessment.service';

@Processor(RISK_QUEUE)
export class RiskProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskProcessor.name);

  constructor(private readonly assessment: RiskAssessmentService) {
    super();
  }

  async process(job: Job<RiskJobData>): Promise<void> {
    // Pass attemptsMade so the (deterministic) simulator can model an outage
    // that recovers after a couple of retries. A thrown error here is caught
    // by BullMQ and retried with backoff.
    await this.assessment.assess(job.data.applicationId, job.attemptsMade);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RiskJobData>, err: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? RISK_MAX_ATTEMPTS;
    this.logger.warn(
      `Risk job ${job.id} failed on attempt ${job.attemptsMade}/${maxAttempts}: ${err.message}`,
    );
    // Only after retries are exhausted do we record the terminal FAILED state.
    if (job.attemptsMade >= maxAttempts) {
      await this.assessment.markFailed(job.data.applicationId, err.message);
    }
  }
}
