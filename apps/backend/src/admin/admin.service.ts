import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { BetaService } from '../beta/beta.service';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTrackDto {
  title: string;
  artistId: string;
  albumId?: string | null;
  audioUrl?: string | null;
  durationSec?: number;
  position?: number;
  coverUrl?: string | null;
  lyrics?: string | null;
  isPremium?: boolean;
  isSellable?: boolean;
  priceIrR?: number;
}

export interface UpdateTrackDto {
  title?: string;
  audioUrl?: string | null;
  durationSec?: number;
  position?: number;
  coverUrl?: string | null;
  lyrics?: string | null;
  isPremium?: boolean;
  isSellable?: boolean;
  priceIrR?: number;
}

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

  // ===== catalog management (audio registration per locked spec: no upload
  // UI in beta — admin places files in MEDIA_DIR and registers audioUrl) =====

  async createArtist(
    dto: { name: string; bio?: string; imageUrl?: string },
    actor: { sub: string; email: string },
  ) {
    const exists = await this.prisma.artist.findFirst({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('هنرمندی با این نام از قبل هست');
    const slug = `${dto.name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 50)}-${Math.random().toString(36).slice(2, 6)}`;
    const artist = await this.prisma.artist.create({
      // admin-created artists have no owner yet — one owner row per user
      // (ownerUserId is @unique); claim happens later via the artist portal
      data: { name: dto.name, bio: dto.bio, imageUrl: dto.imageUrl, slug },
    });
    this.audit.log({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      action: 'admin.artist.create',
      entityType: 'Artist',
      entityId: artist.id,
      after: { name: artist.name, slug: artist.slug },
    });
    return artist;
  }

  async createTrack(dto: CreateTrackDto, actor: { sub: string; email: string }) {
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    const track = await this.prisma.track.create({
      data: {
        title: dto.title,
        artistId: dto.artistId,
        albumId: dto.albumId ?? null,
        audioUrl: dto.audioUrl ?? null,
        durationSec: dto.durationSec ?? 0,
        position: dto.position ?? 1,
        coverUrl: dto.coverUrl ?? null,
        lyrics: dto.lyrics ?? null,
        isPremium: dto.isPremium ?? false,
        isSellable: dto.isSellable ?? false,
        priceIrR: dto.priceIrR ?? 0,
        isPublished: false, // publish is an explicit step
      },
    });
    this.audit.log({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      action: 'admin.track.create',
      entityType: 'Track',
      entityId: track.id,
      after: { title: track.title, audioUrl: track.audioUrl },
    });
    return track;
  }

  /** Whitelisted edit — audioKey, price, premium flag, lyrics, cover. */
  async updateTrack(id: string, dto: UpdateTrackDto, actor: { sub: string; email: string }) {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) throw new NotFoundException('ترک یافت نشد');
    const allowed = [
      'title',
      'audioUrl',
      'durationSec',
      'position',
      'coverUrl',
      'lyrics',
      'isPremium',
      'isSellable',
      'priceIrR',
    ] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('فیلدی برای بروزرسانی نفرستادی');
    }
    const updated = await this.prisma.track.update({ where: { id }, data });
    this.audit.log({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      action: 'admin.track.update',
      entityType: 'Track',
      entityId: id,
      before: { audioUrl: track.audioUrl, isPremium: track.isPremium, priceIrR: track.priceIrR },
      after: data,
    });
    return updated;
  }

  async publishTrack(id: string, published: boolean, actor: { sub: string; email: string }) {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) throw new NotFoundException('ترک یافت نشد');
    if (published && !track.audioUrl) {
      throw new BadRequestException('قبل از انتشار باید فایل صوتی ثبت شود');
    }
    const updated = await this.prisma.track.update({ where: { id }, data: { isPublished: published } });
    this.audit.log({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      action: published ? 'admin.track.publish' : 'admin.track.unpublish',
      entityType: 'Track',
      entityId: id,
      before: { isPublished: track.isPublished },
      after: { isPublished: published },
    });
    return updated;
  }

  /** Flat list for the admin manage tab, newest first. */
  async listTracks() {
    return this.prisma.track.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        audioUrl: true,
        durationSec: true,
        isPremium: true,
        isSellable: true,
        priceIrR: true,
        isPublished: true,
        playCount: true,
        createdAt: true,
        artist: { select: { id: true, name: true } },
        album: { select: { id: true, title: true } },
      },
    });
  }

  async listArtistsLite() {
    return this.prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async listAlbumsLite() {
    return this.prisma.album.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, artistId: true },
    });
  }
}
