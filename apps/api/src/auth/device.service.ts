import { Injectable } from '@nestjs/common';
import { type Device } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_ACTIVE_DEVICES } from './device.constants';

export interface IdentifyDeviceInput {
  userId: string;
  fingerprint: string;
  platform: string;
  label?: string;
}

/**
 * Finds or creates the device/session a login is happening from, enforcing
 * the "maximum two active devices per user" rule: when a third device logs
 * in, the least-recently-seen active device is revoked to make room.
 */
@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async identifyDevice(input: IdentifyDeviceInput): Promise<Device> {
    const existing = await this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId: input.userId, fingerprint: input.fingerprint } },
    });

    if (existing && !existing.revokedAt) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), platform: input.platform, label: input.label },
      });
    }

    await this.makeRoomForNewDevice(input.userId);

    const device = await this.prisma.device.upsert({
      where: { userId_fingerprint: { userId: input.userId, fingerprint: input.fingerprint } },
      create: {
        userId: input.userId,
        fingerprint: input.fingerprint,
        platform: input.platform,
        label: input.label,
      },
      update: {
        revokedAt: null,
        lastSeenAt: new Date(),
        platform: input.platform,
        label: input.label,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    await this.auditService.record({
      eventType: 'DEVICE_CHANGE',
      actorUserId: input.userId,
      metadata: { action: 'added', deviceId: device.id },
    });

    return device;
  }

  /** Revokes the given device, ending its session immediately. */
  async revokeDevice(deviceId: string, actorUserId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date(), refreshTokenHash: null, refreshTokenExpiresAt: null },
    });

    await this.auditService.record({
      eventType: 'DEVICE_CHANGE',
      actorUserId,
      metadata: { action: 'revoked', deviceId },
    });
  }

  private async makeRoomForNewDevice(userId: string): Promise<void> {
    const activeDevices = await this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'asc' },
    });

    if (activeDevices.length < MAX_ACTIVE_DEVICES) {
      return;
    }

    const devicesToRevoke = activeDevices.slice(0, activeDevices.length - MAX_ACTIVE_DEVICES + 1);
    for (const device of devicesToRevoke) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: new Date(), refreshTokenHash: null, refreshTokenExpiresAt: null },
      });

      await this.auditService.record({
        eventType: 'DEVICE_CHANGE',
        actorUserId: userId,
        metadata: { action: 'auto_revoked_oldest', deviceId: device.id },
      });
    }
  }
}
