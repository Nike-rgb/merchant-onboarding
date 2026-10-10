import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  RISK_BACKOFF_MS,
  RISK_JOB,
  RISK_MAX_ATTEMPTS,
  RISK_QUEUE,
  RiskJobData,
} from './risk.constants';

@Injectable()
export class RiskProducer {
  constructor(
    @InjectQueue(RISK_QUEUE) private readonly queue: Queue<RiskJobData>,
  ) {}

  /**
   * Enqueue a risk-review job for an application.
   *
   * Idempotent enqueue: jobId is derived from the application id, so a second
   * submit while a job is still in-flight won't create a duplicate job. Paired
   * with retries + exponential backoff for transient upstream failures.
   */
  async enqueue(applicationId: string): Promise<void> {
    await this.queue.add(
      RISK_JOB,
      { applicationId },
      {
        jobId: `risk-${applicationId}`,
        attempts: RISK_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: RISK_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
