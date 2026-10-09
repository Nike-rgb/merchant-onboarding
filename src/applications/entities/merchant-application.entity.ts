import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';
import { ApplicationStatus } from '../enums/application-status.enum';
import { BusinessType } from '../enums/business-type.enum';
import { RiskStatus } from '../enums/risk-status.enum';

@Entity('merchant_applications')
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ---- Business identity ----
  @Column({ name: 'business_name' })
  businessName: string;

  @Column({ name: 'legal_business_name' })
  legalBusinessName: string;

  @Column({ name: 'business_type', type: 'enum', enum: BusinessType })
  businessType: BusinessType;

  // ---- Owner / contact information ----
  @Column({ name: 'owner_name' })
  ownerName: string;

  @Column({ name: 'owner_email' })
  ownerEmail: string;

  @Column({ name: 'owner_phone' })
  ownerPhone: string;

  // Sensitive: documented for field-level encryption. Masked in audit logs.
  // Explicit type required: a `string | null` property reflects as `Object`,
  // which TypeORM cannot map to a Postgres column on its own.
  @Column({ name: 'owner_tax_id', type: 'varchar', nullable: true })
  ownerTaxId: string | null;

  // ---- Requested processing information ----
  @Column({
    name: 'monthly_processing_volume',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  monthlyProcessingVolume: number;

  @Column({
    name: 'average_ticket_size',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  averageTicketSize: number;

  @Column({ name: 'currency', length: 3, default: 'USD' })
  currency: string;

  // ---- Workflow state ----
  @Index()
  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.DRAFT,
  })
  status: ApplicationStatus;

  @Index()
  @Column({
    name: 'risk_status',
    type: 'enum',
    enum: RiskStatus,
    default: RiskStatus.PENDING,
  })
  riskStatus: RiskStatus;

  @Column({ name: 'risk_score', type: 'int', nullable: true })
  riskScore: number | null;

  @Column({ name: 'risk_reason', type: 'text', nullable: true })
  riskReason: string | null;

  // ---- Ownership & assignment (object-level authorization anchors) ----
  @ManyToOne(() => User, (user) => user.createdApplications, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Index()
  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.assignedApplications, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assigned_reviewer_id' })
  assignedReviewer: User | null;

  @Index()
  @Column({ name: 'assigned_reviewer_id', type: 'uuid', nullable: true })
  assignedReviewerId: string | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes: string | null;

  // ---- Timestamps ----
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
