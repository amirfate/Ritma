import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ArtistService } from './artist.service';

function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

describe('ArtistService', () => {
  let prisma: PrismaService;
  let artistService: ArtistService;
  let actorUserId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    artistService = new ArtistService(prisma, new AuditService(prisma));

    const admin = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`, role: 'ADMIN' },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates an artist, active by default, and audits it', async () => {
    const artist = await artistService.create(actorUserId, { name: uniqueName('Artist') });

    expect(artist.isActive).toBe(true);

    const auditLog = await prisma.auditLog.findFirst({
      where: { eventType: 'ADMIN_ACTION', actorUserId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog?.metadata).toMatchObject({ entity: 'Artist', action: 'create' });
  });

  it('throws NotFoundException for a nonexistent artist', async () => {
    await expect(artistService.findById('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates name and bio', async () => {
    const artist = await artistService.create(actorUserId, { name: uniqueName('Artist') });

    const updated = await artistService.update(actorUserId, artist.id, {
      name: 'Renamed',
      bio: 'A short bio',
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.bio).toBe('A short bio');
  });

  it('disables and re-enables an artist', async () => {
    const artist = await artistService.create(actorUserId, { name: uniqueName('Artist') });

    const disabled = await artistService.setActive(actorUserId, artist.id, false);
    expect(disabled.isActive).toBe(false);

    const enabled = await artistService.setActive(actorUserId, artist.id, true);
    expect(enabled.isActive).toBe(true);
  });

  it('findActiveById hides a disabled artist', async () => {
    const artist = await artistService.create(actorUserId, { name: uniqueName('Artist') });
    await artistService.setActive(actorUserId, artist.id, false);

    await expect(artistService.findActiveById(artist.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists artists filtered by name and active status', async () => {
    const marker = randomUUID();
    const active = await artistService.create(actorUserId, { name: `Findable-${marker}` });
    const inactive = await artistService.create(actorUserId, { name: `Findable-${marker}-2` });
    await artistService.setActive(actorUserId, inactive.id, false);

    const activeOnly = await artistService.list({
      page: 1,
      pageSize: 20,
      q: marker,
      isActive: true,
    });
    expect(activeOnly.items.map((a) => a.id)).toEqual([active.id]);

    const all = await artistService.list({ page: 1, pageSize: 20, q: marker });
    expect(all.items).toHaveLength(2);
  });

  it('listActive never returns a disabled artist even without an explicit filter', async () => {
    const marker = randomUUID();
    const active = await artistService.create(actorUserId, { name: `Public-${marker}` });
    const inactive = await artistService.create(actorUserId, { name: `Public-${marker}-2` });
    await artistService.setActive(actorUserId, inactive.id, false);

    const result = await artistService.listActive({ page: 1, pageSize: 20, q: marker });
    expect(result.items.map((a) => a.id)).toEqual([active.id]);
  });
});
