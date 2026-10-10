import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { RiskProducer } from '../risk/risk.producer';
import { ApplicationsService } from './applications.service';
import { MerchantApplication } from './entities/merchant-application.entity';
import { ApplicationStatus } from './enums/application-status.enum';
import { ReviewDecision } from './dto/review-decision.dto';

const sales1: AuthUser = {
  userId: 's1',
  email: 's1@x.io',
  role: UserRole.SALES,
};
const sales2: AuthUser = {
  userId: 's2',
  email: 's2@x.io',
  role: UserRole.SALES,
};
const reviewer: AuthUser = {
  userId: 'r1',
  email: 'r1@x.io',
  role: UserRole.REVIEWER,
};

function makeApp(
  overrides: Partial<MerchantApplication> = {},
): MerchantApplication {
  return {
    id: 'app-1',
    createdById: 's1',
    status: ApplicationStatus.DRAFT,
    assignedReviewerId: null,
    ...overrides,
  } as MerchantApplication;
}

describe('ApplicationsService', () => {
  let repo: jest.Mocked<
    Pick<
      Repository<MerchantApplication>,
      'findOne' | 'save' | 'update' | 'create' | 'findAndCount'
    >
  >;
  let users: jest.Mocked<Pick<UsersService, 'findById'>>;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let risk: jest.Mocked<Pick<RiskProducer, 'enqueue'>>;
  let service: ApplicationsService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      update: jest.fn(),
      create: jest.fn().mockImplementation((e) => e),
      findAndCount: jest.fn(),
    };
    users = { findById: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    risk = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new ApplicationsService(
      repo as unknown as Repository<MerchantApplication>,
      users as unknown as UsersService,
      audit as unknown as AuditService,
      risk as unknown as RiskProducer,
    );
  });

  describe('object-level authorization (findOne)', () => {
    it('lets a SALES user read their own application', async () => {
      repo.findOne.mockResolvedValue(makeApp({ createdById: 's1' }));
      await expect(service.findOne(sales1, 'app-1')).resolves.toBeDefined();
    });

    it("BLOCKS a SALES user from reading another user's application", async () => {
      repo.findOne.mockResolvedValue(makeApp({ createdById: 's1' }));
      await expect(service.findOne(sales2, 'app-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lets a REVIEWER read any application', async () => {
      repo.findOne.mockResolvedValue(makeApp({ createdById: 's1' }));
      await expect(service.findOne(reviewer, 'app-1')).resolves.toBeDefined();
    });

    it('404s when the application does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(sales1, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('forbids reviewers from editing', async () => {
      repo.findOne.mockResolvedValue(makeApp());
      await expect(
        service.update(reviewer, 'app-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects edits once not editable', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({ status: ApplicationStatus.UNDER_REVIEW }),
      );
      await expect(service.update(sales1, 'app-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('submit', () => {
    it('enqueues risk review on a valid DRAFT -> SUBMITTED', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({ status: ApplicationStatus.DRAFT }),
      );
      const result = await service.submit(sales1, 'app-1');
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
      expect(risk.enqueue).toHaveBeenCalledWith('app-1');
    });

    it('rejects submitting from a terminal state', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({ status: ApplicationStatus.APPROVED }),
      );
      await expect(service.submit(sales1, 'app-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(risk.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('recordDecision', () => {
    it('only the assigned reviewer may decide', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({
          status: ApplicationStatus.UNDER_REVIEW,
          assignedReviewerId: 'other',
        }),
      );
      await expect(
        service.recordDecision(reviewer, 'app-1', {
          decision: ReviewDecision.APPROVE,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('assigned reviewer approves from UNDER_REVIEW', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({
          status: ApplicationStatus.UNDER_REVIEW,
          assignedReviewerId: 'r1',
        }),
      );
      const result = await service.recordDecision(reviewer, 'app-1', {
        decision: ReviewDecision.APPROVE,
      });
      expect(result.status).toBe(ApplicationStatus.APPROVED);
    });

    it('rejects a decision when not under review (invalid transition)', async () => {
      repo.findOne.mockResolvedValue(
        makeApp({
          status: ApplicationStatus.SUBMITTED,
          assignedReviewerId: 'r1',
        }),
      );
      await expect(
        service.recordDecision(reviewer, 'app-1', {
          decision: ReviewDecision.APPROVE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
