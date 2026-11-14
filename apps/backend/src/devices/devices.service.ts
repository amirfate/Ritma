import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

export interface DeviceAttempt {
  deviceKey: string;
  deviceName?: string;
  ip?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  static keyFor(userAgent: string | undefined): string {
    return createHash('sha256').update(userAgent ?? 'unknown-client').digest('hex').slice(0, 32);
  }

  /**
   * Registers the device used for this login. A known device is refreshed;
   * a brand-new device is rejected when the active-device cap is reached.
   */
  async assertDeviceAllowed(
    userId: string,
    attempt: DeviceAttempt,
    maxDevices: number,
  ): Promise<void> {
    const existing = await this.prisma.deviceSession.findUnique({
      where: { userId_deviceKey: { userId, deviceKey: attempt.deviceKey } },
    });
    if (existing && !existing.revoked) {
      await this.prisma.deviceSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), lastIp: attempt.ip, deviceName: attempt.deviceName ?? existing.deviceName },
      });
      return;
    }
    const activeCount = await this.prisma.deviceSession.count({
      where: { userId, revoked: false },
    });
    if (activeCount >= maxDevices) {
      throw new ForbiddenException(
        `حداکثر ${maxDevices} دستگاه فعال مجاز است — ابتدا یکی از دستگاه‌های خود را از پنل حذف کنید`,
      );
    }
    if (existing) {
      await this.prisma.deviceSession.update({
        where: { id: existing.id },
        data: { revoked: false, lastSeenAt: new Date(), lastIp: attempt.ip, deviceName: attempt.deviceName ?? existing.deviceName },
      });
    } else {
      await this.prisma.deviceSession.create({
        data: {
          userId,
          deviceKey: attempt.deviceKey,
          deviceName: attempt.deviceName ?? null,
          lastIp: attempt.ip ?? null,
        },
      });
    }
  }

  listForUser(userId: string) {
    return this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        lastIp: true,
        lastSeenAt: true,
        revoked: true,
        createdAt: true,
      },
    });
  }

  /** Revokes a device and kills its refresh tokens so it must log in again. */
  async revoke(userId: string, deviceId: string): Promise<{ ok: true }> {
    const session = await this.prisma.deviceSession.findFirst({
      where: { id: deviceId, userId },
    });
    if (!session) throw new ForbiddenException('دستگاه یافت نشد');
    await this.prisma.$transaction([
      this.prisma.deviceSession.update({ where: { id: session.id }, data: { revoked: true } }),
      this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
    ]);
    return { ok: true };
  }

  listAllForAdmin() {
    return this.prisma.deviceSession.findMany({
      where: { revoked: false },
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        deviceName: true,
        lastIp: true,
        lastSeenAt: true,
        user: { select: { email: true, name: true } },
      },
    });
  }
}
