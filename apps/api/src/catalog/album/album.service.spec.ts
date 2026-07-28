import { randomUUID } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { type Artist } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AlbumService } from './album.service';

async function createArtist(prisma: PrismaService): Promise<Artist> {
  return prisma.artist.create({ data: { name: `Artist-${randomUUID()}` } });
}

describe('AlbumService', () => {
  let prisma: PrismaService;
  let albumService: AlbumService;
  let actorUserId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    albumService = new AlbumService(prisma, new AuditService(prisma));

    const admin = await prisma.user.create({
      data: { phoneNumber: `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`, role: 'ADMIN' },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates an album for a valid artist, unpublished by default', async () => {
    const artist = await createArtist(prisma);

    const album = await albumService.create(actorUserId, {
      artistId: artist.id,
      title: 'First Album',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });

    expect(album.artistId).toBe(artist.id);
    expect(album.isPublished).toBe(false);

    const auditLog = await prisma.auditLog.findFirst({
      where: { eventType: 'ADMIN_ACTION', actorUserId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog?.metadata).toMatchObject({ entity: 'Album', action: 'create' });
  });

  it('rejects creation against a nonexistent artist', async () => {
    await expect(
      albumService.create(actorUserId, {
        artistId: 'does-not-exist',
        title: 'Orphan Album',
        coverImageUrl: 'https://cdn.example.com/cover.jpg',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishes and unpublishes an album', async () => {
    const artist = await createArtist(prisma);
    const album = await albumService.create(actorUserId, {
      artistId: artist.id,
      title: 'Toggle Album',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });

    const published = await albumService.setPublished(actorUserId, album.id, true);
    expect(published.isPublished).toBe(true);

    const unpublished = await albumService.setPublished(actorUserId, album.id, false);
    expect(unpublished.isPublished).toBe(false);
  });

  it('findPublishedById hides an unpublished album', async () => {
    const artist = await createArtist(prisma);
    const album = await albumService.create(actorUserId, {
      artistId: artist.id,
      title: 'Hidden Album',
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });

    await expect(albumService.findPublishedById(album.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await albumService.setPublished(actorUserId, album.id, true);
    await expect(albumService.findPublishedById(album.id)).resolves.toMatchObject({ id: album.id });
  });

  it('lists albums filtered by artist and published status', async () => {
    const artist = await createArtist(prisma);
    const marker = randomUUID();
    const published = await albumService.create(actorUserId, {
      artistId: artist.id,
      title: `Album-${marker}-a`,
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });
    await albumService.create(actorUserId, {
      artistId: artist.id,
      title: `Album-${marker}-b`,
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });
    await albumService.setPublished(actorUserId, published.id, true);

    const publishedOnly = await albumService.list({
      page: 1,
      pageSize: 20,
      artistId: artist.id,
      isPublished: true,
    });
    expect(publishedOnly.items.map((a) => a.id)).toEqual([published.id]);

    const all = await albumService.list({ page: 1, pageSize: 20, artistId: artist.id });
    expect(all.items).toHaveLength(2);
  });

  it('never lists an unpublished album via listPublished', async () => {
    const artist = await createArtist(prisma);
    const marker = randomUUID();
    const published = await albumService.create(actorUserId, {
      artistId: artist.id,
      title: `Public-${marker}-a`,
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });
    await albumService.create(actorUserId, {
      artistId: artist.id,
      title: `Public-${marker}-b`,
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
    });
    await albumService.setPublished(actorUserId, published.id, true);

    const result = await albumService.listPublished({
      page: 1,
      pageSize: 20,
      artistId: artist.id,
    });
    expect(result.items.map((a) => a.id)).toEqual([published.id]);
  });
});
