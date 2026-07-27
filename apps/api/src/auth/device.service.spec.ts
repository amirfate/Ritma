import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_ACTIVE_DEVICES } from './device.constants';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  let prisma: PrismaService;
  let deviceService: DeviceService;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    deviceService = new DeviceService(prisma, new AuditService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}` },
    });
    userId = user.id;
  });

  it('creates a device on first login', async () => {
    const device = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });

    expect(device.userId).toBe(userId);
    expect(device.revokedAt).toBeNull();
  });

  it('reuses an already-active device without revoking anything', async () => {
    const first = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });
    const second = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });

    expect(second.id).toBe(first.id);

    const activeDevices = await prisma.device.findMany({ where: { userId, revokedAt: null } });
    expect(activeDevices).toHaveLength(1);
  });

  it('allows up to two simultaneously active devices', async () => {
    await deviceService.identifyDevice({ userId, fingerprint: 'device-a', platform: 'android' });
    await deviceService.identifyDevice({ userId, fingerprint: 'device-b', platform: 'android' });

    const activeDevices = await prisma.device.findMany({ where: { userId, revokedAt: null } });
    expect(activeDevices).toHaveLength(MAX_ACTIVE_DEVICES);
  });

  it('revokes the oldest active device when a third device logs in', async () => {
    const oldest = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });
    // Ensure distinct lastSeenAt ordering.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await deviceService.identifyDevice({ userId, fingerprint: 'device-b', platform: 'android' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await deviceService.identifyDevice({ userId, fingerprint: 'device-c', platform: 'android' });

    const allDevices = await prisma.device.findMany({ where: { userId } });
    expect(allDevices).toHaveLength(3);

    const activeDevices = allDevices.filter((device) => !device.revokedAt);
    expect(activeDevices).toHaveLength(MAX_ACTIVE_DEVICES);
    expect(activeDevices.map((device) => device.fingerprint).sort()).toEqual([
      'device-b',
      'device-c',
    ]);

    const revokedOldest = allDevices.find((device) => device.id === oldest.id);
    expect(revokedOldest?.revokedAt).not.toBeNull();
  });

  it('lets a previously-revoked device log in again, consuming a slot', async () => {
    await deviceService.identifyDevice({ userId, fingerprint: 'device-a', platform: 'android' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await deviceService.identifyDevice({ userId, fingerprint: 'device-b', platform: 'android' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    // device-a is now revoked to make room for device-c.
    await deviceService.identifyDevice({ userId, fingerprint: 'device-c', platform: 'android' });

    // device-a logs in again: it must reactivate (not duplicate), and
    // revoke whichever device is currently oldest.
    const reactivated = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });
    expect(reactivated.revokedAt).toBeNull();

    const allDevices = await prisma.device.findMany({ where: { userId } });
    expect(allDevices).toHaveLength(3);
    expect(allDevices.filter((device) => !device.revokedAt)).toHaveLength(MAX_ACTIVE_DEVICES);
  });

  it('clears the refresh token hash when revoking a device', async () => {
    const device = await deviceService.identifyDevice({
      userId,
      fingerprint: 'device-a',
      platform: 'android',
    });
    await prisma.device.update({
      where: { id: device.id },
      data: { refreshTokenHash: 'some-hash', refreshTokenExpiresAt: new Date() },
    });

    await deviceService.revokeDevice(device.id, userId);

    const revoked = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.refreshTokenHash).toBeNull();
  });
});
