import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Append-only audit trail for sensitive operations (dashboard section 18).
 * Logging must never break the main operation — failures are logged, not thrown.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry): void {
    this.prisma.auditLog
      .create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          actorEmail: entry.actorEmail ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? undefined) as never,
          after: (entry.after ?? undefined) as never,
          ip: entry.ip ?? null,
        },
      })
      .catch((err: unknown) => {
        this.logger.error(`audit write failed for ${entry.action}`, err);
      });
  }

  /** Paginated audit trail for the admin dashboard. */
  recent(page = 1, take = 50) {
    return Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.auditLog.count(),
    ]).then(([items, total]) => ({ items, total, page, take }));
  }
}
