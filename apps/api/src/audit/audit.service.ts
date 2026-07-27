import { Injectable } from '@nestjs/common';
import { type AuditEventType, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditEventInput {
  eventType: AuditEventType;
  actorUserId?: string;
  /**
   * Structured, non-secret context for the event (e.g. a device id, a
   * track id). Never pass OTP codes, JWT/refresh tokens, or payment
   * secrets here — this is written to the database and may be surfaced
   * through `GET /admin/reports`.
   */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Shared, feature-agnostic audit logging. Any module (auth today; catalog,
 * commerce, and admin modules later) records one of the eight required
 * event types through this service rather than writing to `audit_logs`
 * directly.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        metadata: input.metadata,
      },
    });
  }
}
