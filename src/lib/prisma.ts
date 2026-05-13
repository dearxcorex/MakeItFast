import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: addConnectionTimeout(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

function addConnectionTimeout(url: string | undefined): string | undefined {
  if (!url) return url;
  const params: string[] = [];
  if (!/[?&]connect_timeout=/.test(url)) params.push('connect_timeout=10');
  if (!/[?&]pool_timeout=/.test(url)) params.push('pool_timeout=10');
  // Neon's pooler runs PgBouncer in transaction mode, which doesn't support
  // prepared statements. Tell Prisma to skip them and keep a single connection
  // so stale-pool "Closed" errors stop spamming the dev log.
  if (/-pooler\./.test(url) && !/[?&]pgbouncer=/.test(url)) {
    params.push('pgbouncer=true');
  }
  if (/-pooler\./.test(url) && !/[?&]connection_limit=/.test(url)) {
    params.push('connection_limit=1');
  }
  if (params.length === 0) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.join('&')}`;
}
