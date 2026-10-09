import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';

/**
 * Append-only record of significant actions. Deliberately stores only
 * actor/target ids plus redacted metadata — never passwords, tokens, or
 * raw sensitive fields.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  // Nullable actor: system-originated actions (e.g. risk worker) have no user.
  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Index()
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId: string | null;

  // Redacted, structured context for the action.
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
