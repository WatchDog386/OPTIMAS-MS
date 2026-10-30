/**
 * Creates (or resets the password of) an administrator account.
 *
 *   node dist/scripts/create-admin.js --staff FBI-ADM-001 --name "Jane Doe" --email admin@optimas.co.ke --password '<strong password>'
 *
 * In Docker: docker compose exec api node dist/scripts/create-admin.js --staff ... (see docs/DEPLOYMENT.md)
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const staffNo = arg('staff')?.toUpperCase();
  const name = arg('name');
  const email = arg('email')?.toLowerCase();
  const password = arg('password');
  if (!staffNo || !name || !password) {
    console.error('Usage: create-admin --staff <STAFF_NO> --name "<Full name>" --password <password> [--email <email>]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Use a password of at least 10 characters for administrator accounts.');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { staffNo },
    create: { staffNo, name, email, passwordHash, role: 'ADMIN' },
    update: { name, email, passwordHash, role: 'ADMIN', active: true },
  });
  console.log(`✅ Administrator ready: ${user.staffNo} (${user.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
