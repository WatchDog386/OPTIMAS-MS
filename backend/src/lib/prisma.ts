import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // PRISMA_COUNT_QUERIES=1 emits every query as an event (used to measure how many queries a request makes)
  log: process.env.PRISMA_COUNT_QUERIES ? [{ emit: 'event', level: 'query' }, 'error'] : process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
