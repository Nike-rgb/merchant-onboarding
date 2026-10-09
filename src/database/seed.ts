import dataSource from '../data-source';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { hashPassword } from '../common/security/password.util';

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

async function seed() {
  await dataSource.initialize();
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

  await dataSource.destroy();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
