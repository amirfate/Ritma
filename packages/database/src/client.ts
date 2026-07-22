import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client singleton. The schema currently defines no models
 * (see `prisma/schema.prisma`); consuming services wire this up once the
 * domain model lands.
 */
export const prisma = new PrismaClient();
