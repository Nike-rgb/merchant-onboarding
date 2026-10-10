import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction } from './enums/audit-action.enum';
import { redact } from './redaction.util';

interface RecordAuditInput {
  action: AuditAction;
  actorId?: string | null;
  applicationId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Append an audit entry. Metadata is redacted before persistence. */
  async record(input: RecordAuditInput): Promise<void> {
    const entry = this.repo.create({
      action: input.action,
      actorId: input.actorId ?? null,
      applicationId: input.applicationId ?? null,
      metadata: (redact(input.metadata ?? {}) as Record<string, unknown>) ?? {},
    });
    await this.repo.save(entry);
  }

  /** Read audit trail for a single application (newest first). */
  findForApplication(applicationId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }
}
