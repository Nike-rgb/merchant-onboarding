import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { hashPassword } from '../src/common/security/password.util';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';

/**
 * These integration tests require Postgres + Redis (docker compose) and the
 * schema migrated. They self-seed the baseline users so they are independent
 * of the external seed step.
 *
 *   docker compose up -d postgres redis
 *   npm run migration:run
 *   npm run test:e2e
 */
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';

describe('Merchant Onboarding (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;

  const tokens: Record<string, string> = {};

  async function ensureUser(email: string, role: UserRole): Promise<void> {
    const existing = await users.findOne({ where: { email } });
    if (!existing) {
      await users.save(
        users.create({
          email,
          role,
          passwordHash: await hashPassword(PASSWORD),
        }),
      );
    }
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    users = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    await ensureUser('admin@example.com', UserRole.ADMIN);
    await ensureUser('reviewer@example.com', UserRole.REVIEWER);
    await ensureUser('sales1@example.com', UserRole.SALES);
    await ensureUser('sales2@example.com', UserRole.SALES);

    tokens.admin = await login('admin@example.com');
    tokens.reviewer = await login('reviewer@example.com');
    tokens.sales1 = await login('sales1@example.com');
    tokens.sales2 = await login('sales2@example.com');
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  const validApp = () => ({
    businessName: 'Joe Coffee',
    legalBusinessName: 'Joe Coffee LLC',
    businessType: 'LLC',
    ownerName: 'Joe Smith',
    ownerEmail: 'joe@example.com',
    ownerPhone: '+1-202-555-0100',
    ownerTaxId: '12-3456789',
    monthlyProcessingVolume: 50000,
    averageTicketSize: 75,
  });

  describe('authentication', () => {
    it('rejects bad credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'sales1@example.com', password: 'wrong' })
        .expect(401);
    });

    it('rejects unauthenticated access to protected routes', async () => {
      await request(app.getHttpServer()).get('/api/applications').expect(401);
    });
  });

  describe('object-level authorization (the key requirement)', () => {
    let sales1AppId: string;

    it('SALES can create an application', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/applications')
        .set(auth(tokens.sales1))
        .send(validApp())
        .expect(201);
      sales1AppId = res.body.id;
      expect(res.body.status).toBe('DRAFT');
      // sensitive field is masked in responses
      expect(res.body.ownerTaxId).toBe('****6789');
    });

    it('BLOCKS another SALES user from reading it by id (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/applications/${sales1AppId}`)
        .set(auth(tokens.sales2))
        .expect(403);
    });

    it('BLOCKS another SALES user from editing it by id (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/applications/${sales1AppId}`)
        .set(auth(tokens.sales2))
        .send({ businessName: 'Hijacked' })
        .expect(403);
    });

    it('lets the owner read it', async () => {
      await request(app.getHttpServer())
        .get(`/api/applications/${sales1AppId}`)
        .set(auth(tokens.sales1))
        .expect(200);
    });

    it('scopes the list so SALES see only their own', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/applications')
        .set(auth(tokens.sales2))
        .expect(200);
      const ids = (res.body.data as Array<{ id: string }>).map((a) => a.id);
      expect(ids).not.toContain(sales1AppId);
    });
  });

  describe('lifecycle + async risk review', () => {
    let appId: string;

    it('runs create -> submit -> risk assessed -> assign -> approve', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/applications')
        .set(auth(tokens.sales1))
        .send(validApp())
        .expect(201);
      appId = created.body.id;

      // SALES cannot approve (role guard)
      await request(app.getHttpServer())
        .post(`/api/applications/${appId}/decision`)
        .set(auth(tokens.sales1))
        .send({ decision: 'APPROVE' })
        .expect(403);

      // submit -> enqueues risk job
      const submitted = await request(app.getHttpServer())
        .post(`/api/applications/${appId}/submit`)
        .set(auth(tokens.sales1))
        .expect(201);
      expect(submitted.body.status).toBe('SUBMITTED');

      // poll until the async worker records a verdict
      let riskStatus = 'PENDING';
      for (let i = 0; i < 20 && riskStatus === 'PENDING'; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const res = await request(app.getHttpServer())
          .get(`/api/applications/${appId}`)
          .set(auth(tokens.sales1));
        riskStatus = res.body.riskStatus;
      }
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(riskStatus);

      // admin assigns a reviewer -> UNDER_REVIEW
      const reviewer = await users.findOne({
        where: { email: 'reviewer@example.com' },
      });
      const assigned = await request(app.getHttpServer())
        .post(`/api/applications/${appId}/assign`)
        .set(auth(tokens.admin))
        .send({ reviewerId: reviewer!.id })
        .expect(201);
      expect(assigned.body.status).toBe('UNDER_REVIEW');

      // assigned reviewer approves
      const approved = await request(app.getHttpServer())
        .post(`/api/applications/${appId}/decision`)
        .set(auth(tokens.reviewer))
        .send({ decision: 'APPROVE', notes: 'Looks good' })
        .expect(201);
      expect(approved.body.status).toBe('APPROVED');
    }, 30000);

    it('blocks a non-assigned reviewer from deciding on a draft (403)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/applications')
        .set(auth(tokens.sales1))
        .send(validApp())
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/applications/${created.body.id}/decision`)
        .set(auth(tokens.reviewer))
        .send({ decision: 'APPROVE' })
        .expect(403);
    });

    it('records an audit trail readable by staff', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/applications/${appId}/audit`)
        .set(auth(tokens.admin))
        .expect(200);
      const actions = (res.body as Array<{ action: string }>).map(
        (a) => a.action,
      );
      expect(actions).toContain('APPLICATION_CREATED');
      expect(actions).toContain('DECISION_RECORDED');
    });
  });
});
