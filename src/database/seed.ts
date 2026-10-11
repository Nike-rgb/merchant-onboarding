import dataSource from '../data-source';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { hashPassword } from '../common/security/password.util';
import { MerchantApplication } from '../applications/entities/merchant-application.entity';
import { ApplicationStatus } from '../applications/enums/application-status.enum';
import { RiskStatus } from '../applications/enums/risk-status.enum';
import { BusinessType } from '../applications/enums/business-type.enum';

/**
 * Idempotent baseline users so the API is demoable immediately (no signup UI).
 * Two SALES users exist specifically to demonstrate object-level isolation:
 * sales1 must not be able to read/edit sales2's applications.
 */
const SEED_USERS: Array<{ email: string; role: UserRole }> = [
  { email: 'admin@example.com', role: UserRole.ADMIN },
  { email: 'reviewer@example.com', role: UserRole.REVIEWER },
  { email: 'sales1@example.com', role: UserRole.SALES },
  { email: 'sales2@example.com', role: UserRole.SALES },
];

/**
 * Optional demo applications owned by sales1, left in DRAFT so a walkthrough can
 * just hit "submit" and watch each risk path run. Names/volumes are chosen to
 * trigger a specific KYB outcome (see src/risk/kyb-simulator.ts).
 * Toggle off with SEED_DEMO_APPLICATIONS=false.
 */
const DEMO_APPLICATIONS: Array<
  Partial<MerchantApplication> & { businessName: string; expected: string }
> = [
  {
    businessName: 'Acme Coffee',
    legalBusinessName: 'Acme Coffee LLC',
    businessType: BusinessType.LLC,
    ownerName: 'Ava Stone',
    ownerEmail: 'ava@acmecoffee.example',
    ownerPhone: '+1-202-555-0101',
    ownerTaxId: '12-3456789',
    monthlyProcessingVolume: 50_000,
    averageTicketSize: 12,
    expected: 'LOW (small volume)',
  },
  {
    businessName: 'Bluewave Retail',
    legalBusinessName: 'Bluewave Retail Corp',
    businessType: BusinessType.CORPORATION,
    ownerName: 'Ben Carter',
    ownerEmail: 'ben@bluewave.example',
    ownerPhone: '+1-202-555-0102',
    monthlyProcessingVolume: 500_000,
    averageTicketSize: 80,
    expected: 'MEDIUM (mid volume)',
  },
  {
    businessName: 'HIGHRISK Imports',
    legalBusinessName: 'Highrisk Imports LLC',
    businessType: BusinessType.LLC,
    ownerName: 'Carl Ng',
    ownerEmail: 'carl@highrisk.example',
    ownerPhone: '+1-202-555-0103',
    monthlyProcessingVolume: 90_000,
    averageTicketSize: 200,
    expected: 'HIGH (flagged name)',
  },
  {
    businessName: 'TIMEOUT Logistics',
    legalBusinessName: 'Timeout Logistics Partners',
    businessType: BusinessType.PARTNERSHIP,
    ownerName: 'Dana Ray',
    ownerEmail: 'dana@timeout.example',
    ownerPhone: '+1-202-555-0104',
    monthlyProcessingVolume: 60_000,
    averageTicketSize: 40,
    expected: 'transient outage -> retries -> recovers to LOW',
  },
];

async function seedUsers(): Promise<void> {
  const repo = dataSource.getRepository(User);
  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';
  const passwordHash = await hashPassword(password);

  for (const { email, role } of SEED_USERS) {
    const existing = await repo.findOne({ where: { email } });
    if (existing) {
      console.log(`[seed] ${email} already exists, skipping`);
      continue;
    }
    await repo.save(repo.create({ email, role, passwordHash }));
    console.log(`[seed] created ${role} ${email}`);
  }
}

async function seedDemoApplications(): Promise<void> {
  const users = dataSource.getRepository(User);
  const apps = dataSource.getRepository(MerchantApplication);

  const sales1 = await users.findOne({
    where: { email: 'sales1@example.com' },
  });
  if (!sales1) {
    console.log('[seed] sales1 missing; skipping demo applications');
    return;
  }

  for (const demo of DEMO_APPLICATIONS) {
    const { expected, ...fields } = demo;
    const existing = await apps.findOne({
      where: { businessName: demo.businessName, createdById: sales1.id },
    });
    if (existing) {
      console.log(`[seed] demo app "${demo.businessName}" exists, skipping`);
      continue;
    }
    await apps.save(
      apps.create({
        ...fields,
        createdById: sales1.id,
        status: ApplicationStatus.DRAFT,
        riskStatus: RiskStatus.PENDING,
      }),
    );
    console.log(
      `[seed] created demo app "${demo.businessName}" -> ${expected}`,
    );
  }
}

async function seed() {
  await dataSource.initialize();

  await seedUsers();

  if ((process.env.SEED_DEMO_APPLICATIONS ?? 'true') !== 'false') {
    await seedDemoApplications();
  }

  await dataSource.destroy();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
