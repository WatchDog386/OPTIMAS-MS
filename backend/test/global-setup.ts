import { execSync } from 'child_process';
import { rmSync } from 'fs';

/** Fresh, migrated and seeded test database before the suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://optimas:optimas@localhost:5432/optimas_test?schema=public';
  execSync('npx prisma migrate reset --force --skip-generate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
  return () => rmSync('uploads-test', { recursive: true, force: true });
}
