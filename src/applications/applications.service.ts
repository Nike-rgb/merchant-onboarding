import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { RiskProducer } from '../risk/risk.producer';
import { MerchantApplication } from './entities/merchant-application.entity';
import { ApplicationStatus } from './enums/application-status.enum';
import { RiskStatus } from './enums/risk-status.enum';
import { canTransition, isEditable } from './application-state';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ReviewDecision, ReviewDecisionDto } from './dto/review-decision.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(MerchantApplication)
    private readonly repo: Repository<MerchantApplication>,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly risk: RiskProducer,
  ) {}

  // --- SALES creates an application they own ---
  async create(
    user: AuthUser,
    dto: CreateApplicationDto,
  ): Promise<MerchantApplication> {
    const app = this.repo.create({
      ...dto,
      ownerTaxId: dto.ownerTaxId ?? null,
      currency: dto.currency ?? 'USD',
      createdById: user.userId,
      status: ApplicationStatus.DRAFT,
      riskStatus: RiskStatus.PENDING,
    });
    const saved = await this.repo.save(app);
    await this.audit.record({
      action: AuditAction.APPLICATION_CREATED,
      actorId: user.userId,
      applicationId: saved.id,
      metadata: { businessName: saved.businessName },
    });
    return saved;
  }

  // --- Read one, enforcing object-level isolation ---
  async findOne(user: AuthUser, id: string): Promise<MerchantApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    this.assertCanAccess(user, app);
    return app;
  }

  // --- List: SALES sees only their own; staff see all. Status filter + paging ---
  async list(
    user: AuthUser,
    query: ListApplicationsQueryDto,
  ): Promise<{
    data: MerchantApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (user.role === UserRole.SALES) {
      where.createdById = user.userId;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  // --- Update while editable; SALES may only touch their own ---
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<MerchantApplication> {
    const app = await this.findOne(user, id); // includes object-level check
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException('Reviewers cannot edit applications');
    }
    if (!isEditable(app.status)) {
      throw new BadRequestException(
        `Application cannot be edited while in status ${app.status}`,
      );
    }
    Object.assign(app, dto);
    const saved = await this.repo.save(app);
    await this.audit.record({
      action: AuditAction.APPLICATION_UPDATED,
      actorId: user.userId,
      applicationId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  // --- Submit: DRAFT/INFO_REQUESTED -> SUBMITTED, enqueue risk review ---
  async submit(user: AuthUser, id: string): Promise<MerchantApplication> {
    const app = await this.findOne(user, id);
    if (user.role === UserRole.REVIEWER) {
      throw new ForbiddenException('Reviewers cannot submit applications');
    }
    this.assertTransition(app.status, ApplicationStatus.SUBMITTED);

    app.status = ApplicationStatus.SUBMITTED;
    app.submittedAt = new Date();
    // Re-assessment on (re)submit: reset verdict and re-run the risk check.
    app.riskStatus = RiskStatus.PENDING;
    app.riskScore = null;
    app.riskReason = null;
    const saved = await this.repo.save(app);

    await this.risk.enqueue(saved.id);
    await this.audit.record({
      action: AuditAction.APPLICATION_SUBMITTED,
      actorId: user.userId,
      applicationId: id,
    });
    return saved;
  }

  // --- ADMIN assigns a reviewer: SUBMITTED -> UNDER_REVIEW ---
  async assignReviewer(
    actor: AuthUser,
    id: string,
    reviewerId: string,
  ): Promise<MerchantApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    const reviewer = await this.users.findById(reviewerId);
    if (!reviewer || reviewer.role !== UserRole.REVIEWER) {
      throw new BadRequestException('Assignee must be an existing REVIEWER');
    }
    this.assertTransition(app.status, ApplicationStatus.UNDER_REVIEW);

    app.assignedReviewerId = reviewer.id;
    app.status = ApplicationStatus.UNDER_REVIEW;
    const saved = await this.repo.save(app);

    await this.audit.record({
      action: AuditAction.REVIEWER_ASSIGNED,
      actorId: actor.userId,
      applicationId: id,
      metadata: { reviewerId: reviewer.id },
    });
    return saved;
  }

  // --- Assigned REVIEWER records a decision: UNDER_REVIEW -> decision ---
  async recordDecision(
    user: AuthUser,
    id: string,
    dto: ReviewDecisionDto,
  ): Promise<MerchantApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    // Object-level rule: only the assigned reviewer may decide.
    if (app.assignedReviewerId !== user.userId) {
      throw new ForbiddenException(
        'Only the assigned reviewer may record a decision',
      );
    }

    const target = this.decisionToStatus(dto.decision);
    this.assertTransition(app.status, target);

    app.status = target;
    app.decisionNotes = dto.notes ?? null;
    app.decidedAt = new Date();
    const saved = await this.repo.save(app);

    await this.audit.record({
      action: AuditAction.DECISION_RECORDED,
      actorId: user.userId,
      applicationId: id,
      metadata: {
        decision: dto.decision,
        riskStatusAtDecision: app.riskStatus,
      },
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Authorization & state helpers
  // ---------------------------------------------------------------------------

  /**
   * Object-level authorization: a SALES user may only access applications they
   * created. ADMIN and REVIEWER may read any application. This is enforced in
   * the service (not just route guards) so it cannot be bypassed by hitting a
   * resource by id.
   */
  private assertCanAccess(user: AuthUser, app: MerchantApplication): void {
    if (user.role === UserRole.SALES && app.createdById !== user.userId) {
      throw new ForbiddenException(
        'You do not have access to this application',
      );
    }
  }

  private assertTransition(
    from: ApplicationStatus,
    to: ApplicationStatus,
  ): void {
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Invalid transition: ${from} -> ${to}`);
    }
  }

  private decisionToStatus(decision: ReviewDecision): ApplicationStatus {
    switch (decision) {
      case ReviewDecision.APPROVE:
        return ApplicationStatus.APPROVED;
      case ReviewDecision.REJECT:
        return ApplicationStatus.REJECTED;
      case ReviewDecision.REQUEST_INFO:
        return ApplicationStatus.INFO_REQUESTED;
    }
  }
}
