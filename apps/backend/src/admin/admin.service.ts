import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { BetaService } from '../beta/beta.service';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beta: BetaService,
    private readonly devices: DevicesService,
    private readonly audit: AuditService,
  ) {}

  /** Single overview payload for the admin dashboard home. */
  async overview() {
    const [beta, users, tracks, paidOrders, activeDevices, revenue] = await Promise.all([
      this.beta.status(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, email: true, name: true, role: true, plan: true, createdAt: true },
      }),
      this.prisma.track.count(),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.devices.listAllForAdmin(),
      this.prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amountIrR: true } }),
    ]);
    return { beta, users, tracks, paidOrders, activeDevices, revenueIrR: revenue._sum.amountIrR ?? 0 };
  }

  auditPage(page = 1, take = 50) {
    return this.audit.recent(page, take);
  }
}
