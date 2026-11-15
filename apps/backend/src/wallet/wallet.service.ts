import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** Doc-locked defaults: per-artist shares, null = 90% artist / 10% platform. */
const DEFAULT_ARTIST_SHARE = 90;
const MIN_CHARGE_IRR = 100_000; // 10,000 Toman
const MIN_DONATION_IRR = 10_000; // 1,000 Toman
const MIN_PAYOUT_IRR = 100_000; // doc: تسویه دستی حداقل ۱۰۰,۰۰۰ ریال

function saleShare(artist: { saleSharePercent: number | null }): number {
  return artist.saleSharePercent ?? DEFAULT_ARTIST_SHARE;
}

function donationShare(artist: { donationSharePercent: number | null }): number {
  return artist.donationSharePercent ?? DEFAULT_ARTIST_SHARE;
}

/** «حامی ناشناس» / masked donor name like the legacy app. */
export function maskName(name: string | null | undefined): string {
  const n = String(name ?? '').trim();
  if (!n) return 'کاربر';
  return n.length <= 2 ? n[0] + '*' : n.slice(0, 2) + '***';
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async balance(userId: string): Promise<{ balanceIrR: number }> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalanceIrR: true },
    });
    return { balanceIrR: u.walletBalanceIrR };
  }

  tx(userId: string) {
    return this.prisma.walletTx.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Creates a pending charge intention (settled on /pay/:ref/confirm). */
  async createCharge(userId: string, amountIrR: number): Promise<{ ref: string; amountIrR: number }> {
    const amount = Math.round(Number(amountIrR));
    if (!Number.isFinite(amount) || amount < MIN_CHARGE_IRR) {
      throw new BadRequestException('حداقل مبلغ شارژ ۱۰۰,۰۰۰ ریال است');
    }
    return this.createPayRef(userId, 'charge', amount);
  }

  /** Buy a track: from wallet when the balance covers it, otherwise a gateway payref. */
  async purchaseTrack(userId: string, trackId: string): Promise<Record<string, unknown>> {
    const track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (!track || !track.isPublished) throw new NotFoundException('ترک یافت نشد');
    const existing = await this.prisma.trackPurchase.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });
    if (existing) return { ok: true, already: true };
    if (track.priceIrR === 0) return { ok: true, free: true };

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.walletBalanceIrR >= track.priceIrR) {
      const { ref } = await this.createPayRef(userId, 'purchase', track.priceIrR, { trackId });
      await this.settle(ref);
      return { ok: true, paidFrom: 'wallet' };
    }
    const { ref } = await this.createPayRef(userId, 'purchase', track.priceIrR, { trackId });
    return { ok: false, needGateway: true, ref, shortage: track.priceIrR - user.walletBalanceIrR };
  }

  /** Donate to an artist: from wallet when possible, otherwise a gateway payref. */
  async donate(
    userId: string,
    artistId: string,
    amountIrR: number,
    isAnonymous: boolean,
  ): Promise<Record<string, unknown>> {
    const artist = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    const amount = Math.round(Number(amountIrR));
    if (!Number.isFinite(amount) || amount < MIN_DONATION_IRR) {
      throw new BadRequestException('حداقل دونیت ۱۰,۰۰۰ ریال است');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const payload = { artistId, isAnonymous };
    if (user.walletBalanceIrR >= amount) {
      const { ref } = await this.createPayRef(userId, 'donation', amount, payload);
      await this.settle(ref);
      return { ok: true, paidFrom: 'wallet' };
    }
    const { ref } = await this.createPayRef(userId, 'donation', amount, payload);
    return { ok: false, needGateway: true, ref, shortage: amount - user.walletBalanceIrR };
  }

  async getPayRef(userId: string, ref: string) {
    const pr = await this.prisma.payRef.findUnique({ where: { ref } });
    if (!pr || pr.userId !== userId) throw new NotFoundException('یافت نشد');
    return pr;
  }

  async cancelPayRef(userId: string, ref: string): Promise<{ ok: true }> {
    await this.prisma.payRef.updateMany({
      where: { ref, userId, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });
    return { ok: true };
  }

  /** Settles a pending payref atomically (ported from legacy settle()). */
  async settle(ref: string): Promise<{ ok: true; balanceIrR: number }> {
    const pr = await this.prisma.payRef.findUnique({ where: { ref } });
    if (!pr || pr.status !== 'PENDING') throw new BadRequestException('تراکنش نامعتبر است');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: pr.userId } });

    if (pr.kind === 'charge') {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: user.id }, data: { walletBalanceIrR: { increment: pr.amountIrR } } }),
        this.prisma.walletTx.create({ data: { userId: user.id, amountIrR: pr.amountIrR, kind: 'CHARGE', ref } }),
        this.prisma.payRef.update({ where: { ref }, data: { status: 'PAID' } }),
      ]);
    } else if (pr.kind === 'purchase') {
      const trackId = String((pr.payload as { trackId?: string }).trackId ?? '');
      const track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
      if (!track) throw new BadRequestException('ترک یافت نشد');
      if (user.walletBalanceIrR < pr.amountIrR) throw new BadRequestException('موجودی کافی نیست');
      const share = saleShare(track.artist);
      const net = Math.round((pr.amountIrR * share) / 100);
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: user.id }, data: { walletBalanceIrR: { decrement: pr.amountIrR } } }),
        this.prisma.trackPurchase.upsert({
          where: { userId_trackId: { userId: user.id, trackId } },
          create: { userId: user.id, trackId, priceIrR: pr.amountIrR },
          update: {},
        }),
        this.prisma.walletTx.create({ data: { userId: user.id, amountIrR: -pr.amountIrR, kind: 'PURCHASE', ref } }),
        this.prisma.artist.update({ where: { id: track.artistId }, data: { earnedIrR: { increment: net } } }),
        this.prisma.artistLedger.create({
          data: {
            artistId: track.artistId,
            kind: 'SALE',
            amountGross: pr.amountIrR,
            platformFee: pr.amountIrR - net,
            amountNet: net,
            ref,
            note: 'فروش: ' + track.title,
          },
        }),
        this.prisma.payRef.update({ where: { ref }, data: { status: 'PAID' } }),
      ]);
    } else if (pr.kind === 'donation') {
      const { artistId, isAnonymous } = pr.payload as { artistId?: string; isAnonymous?: boolean };
      const artist = await this.prisma.artist.findUnique({ where: { id: String(artistId ?? '') } });
      if (!artist) throw new BadRequestException('هنرمند یافت نشد');
      if (user.walletBalanceIrR < pr.amountIrR) throw new BadRequestException('موجودی کافی نیست');
      const share = donationShare(artist);
      const net = Math.round((pr.amountIrR * share) / 100);
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: user.id }, data: { walletBalanceIrR: { decrement: pr.amountIrR } } }),
        this.prisma.donation.create({
          data: { userId: user.id, artistId: artist.id, amountIrR: pr.amountIrR, isAnonymous: !!isAnonymous },
        }),
        this.prisma.walletTx.create({ data: { userId: user.id, amountIrR: -pr.amountIrR, kind: 'DONATION', ref } }),
        this.prisma.artist.update({ where: { id: artist.id }, data: { earnedIrR: { increment: net } } }),
        this.prisma.artistLedger.create({
          data: {
            artistId: artist.id,
            kind: 'DONATION',
            amountGross: pr.amountIrR,
            platformFee: pr.amountIrR - net,
            amountNet: net,
            ref,
            note: 'حمایت مالی',
          },
        }),
        this.prisma.payRef.update({ where: { ref }, data: { status: 'PAID' } }),
      ]);
    } else {
      throw new BadRequestException('نوع تراکنش نامعتبر است');
    }
    this.audit.log({
      actorUserId: user.id,
      action: 'wallet.settle',
      entityType: 'PayRef',
      entityId: ref,
      after: { kind: pr.kind, amountIrR: pr.amountIrR },
    });
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { walletBalanceIrR: true },
    });
    return { ok: true, balanceIrR: fresh.walletBalanceIrR };
  }

  /** Confirm endpoint: verifies the ref belongs to the caller before settling. */
  async settleByOwner(userId: string, ref: string): Promise<{ ok: true; balanceIrR: number }> {
    const pr = await this.prisma.payRef.findUnique({ where: { ref } });
    if (!pr || pr.userId !== userId) throw new NotFoundException('یافت نشد');
    const out = await this.settle(ref);
    return { ok: true, balanceIrR: out.balanceIrR };
  }

  private async createPayRef(
    userId: string,
    kind: 'charge' | 'purchase' | 'donation',
    amountIrR: number,
    payload: Prisma.InputJsonValue = {},
  ): Promise<{ ref: string; amountIrR: number }> {
    const ref = 'RIT-' + Math.random().toString(16).slice(2, 14).toUpperCase();
    await this.prisma.payRef.create({ data: { ref, userId, kind, amountIrR, payload } });
    return { ref, amountIrR };
  }

  // ===== library / follows / history =====

  async library(userId: string) {
    const paid = await this.prisma.trackPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { track: { include: { artist: { select: { id: true, name: true, slug: true } } } } },
    });
    const purchasedIds = paid.map((p) => p.trackId);
    const free = await this.prisma.track.findMany({
      where: { isPublished: true, priceIrR: 0, id: { notIn: purchasedIds } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { artist: { select: { id: true, name: true, slug: true } } },
    });
    return { paid, free };
  }

  async follow(userId: string, artistId: string): Promise<{ ok: true }> {
    const artist = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) throw new NotFoundException('هنرمند یافت نشد');
    await this.prisma.follow.upsert({
      where: { userId_artistId: { userId, artistId } },
      create: { userId, artistId },
      update: {},
    });
    return { ok: true };
  }

  async unfollow(userId: string, artistId: string): Promise<{ ok: true }> {
    await this.prisma.follow.deleteMany({ where: { userId, artistId } });
    return { ok: true };
  }

  async follows(userId: string) {
    return this.prisma.follow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        artist: {
          select: { id: true, name: true, slug: true, bio: true, _count: { select: { tracks: true } } },
        },
      },
    });
  }

  async history(userId: string) {
    return this.prisma.playEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { track: { select: { id: true, title: true, artist: { select: { name: true } } } } },
    });
  }

  // ===== artist panel =====

  async myArtistOr404(userId: string) {
    const artist = await this.prisma.artist.findUnique({ where: { ownerUserId: userId } });
    if (!artist) throw new NotFoundException('پنل هنرمند برای این حساب فعال نیست');
    return artist;
  }

  async artistPanel(userId: string) {
    const artist = await this.myArtistOr404(userId);
    const [sales, donationsAgg, albumsCount, payouts, perTrackRaw] = await Promise.all([
      this.prisma.trackPurchase.aggregate({
        where: { track: { artistId: artist.id } },
        _count: { id: true },
        _sum: { priceIrR: true },
      }),
      this.prisma.donation.aggregate({
        where: { artistId: artist.id },
        _count: { id: true },
        _sum: { amountIrR: true },
      }),
      this.prisma.album.count({ where: { artistId: artist.id } }),
      this.prisma.payout.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.track.findMany({
        where: { artistId: artist.id },
        select: {
          id: true,
          title: true,
          priceIrR: true,
          _count: { select: { purchases: true } },
          purchases: { select: { priceIrR: true } },
        },
      }),
    ]);
    const dShare = donationShare(artist);
    const paidOut = payouts.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amountIrR, 0);
    const pending = payouts.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amountIrR, 0);
    return {
      artist: { id: artist.id, name: artist.name, slug: artist.slug },
      share_percent: saleShare(artist),
      donation_share_percent: dShare,
      sales: { count: sales._count.id, gross: sales._sum.priceIrR ?? 0 },
      albums_count: albumsCount,
      donations: {
        count: donationsAgg._count.id,
        total: donationsAgg._sum.amountIrR ?? 0,
        net: Math.round(((donationsAgg._sum.amountIrR ?? 0) * dShare) / 100),
      },
      earned_total: artist.earnedIrR,
      paid_out: paidOut,
      pending_payout: pending,
      withdrawable: Math.max(0, artist.earnedIrR - paidOut - pending),
      payouts,
      per_track: perTrackRaw.map((t) => ({
        id: t.id,
        title: t.title,
        priceIrR: t.priceIrR,
        sales: t._count.purchases,
        gross: t.purchases.reduce((s, p) => s + p.priceIrR, 0),
      })),
    };
  }

  async artistTracks(userId: string) {
    const artist = await this.myArtistOr404(userId);
    const share = saleShare(artist);
    const tracks = await this.prisma.track.findMany({
      where: { artistId: artist.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        priceIrR: true,
        isPublished: true,
        createdAt: true,
        _count: { select: { purchases: true } },
        purchases: { select: { priceIrR: true } },
      },
    });
    return {
      artist: { id: artist.id, name: artist.name, slug: artist.slug },
      share_percent: share,
      tracks: tracks.map((t) => {
        const gross = t.purchases.reduce((s, p) => s + p.priceIrR, 0);
        return {
          id: t.id,
          title: t.title,
          priceIrR: t.priceIrR,
          isPublished: t.isPublished,
          sales: t._count.purchases,
          gross,
          my_earning: Math.round((gross * share) / 100),
        };
      }),
    };
  }

  async artistDonations(userId: string) {
    const artist = await this.myArtistOr404(userId);
    const share = donationShare(artist);
    const rows = await this.prisma.donation.findMany({
      where: { artistId: artist.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true } } },
    });
    return {
      share_percent: share,
      donations: rows.map((d) => ({
        id: d.id,
        amount: d.amountIrR,
        date: d.createdAt,
        donor: d.isAnonymous ? 'حامی ناشناس' : maskName(d.user?.name),
        net: Math.round((d.amountIrR * share) / 100),
        platform_fee: d.amountIrR - Math.round((d.amountIrR * share) / 100),
      })),
    };
  }

  async artistLedger(userId: string) {
    const artist = await this.myArtistOr404(userId);
    return {
      ledger: await this.prisma.artistLedger.findMany({
        where: { artistId: artist.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    };
  }

  async artistPayouts(userId: string) {
    const artist = await this.myArtistOr404(userId);
    return this.prisma.payout.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: 'desc' } });
  }

  async requestPayout(userId: string, amountIrR: number): Promise<{ ok: true }> {
    const artist = await this.myArtistOr404(userId);
    const amount = Math.round(Number(amountIrR));
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT_IRR) {
      throw new BadRequestException('حداقل درخواست تسویه ۱۰۰,۰۰۰ ریال است');
    }
    const payouts = await this.prisma.payout.findMany({ where: { artistId: artist.id } });
    const paidOut = payouts.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amountIrR, 0);
    const pending = payouts.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amountIrR, 0);
    if (amount > artist.earnedIrR - paidOut - pending) {
      throw new BadRequestException('مبلغ بیشتر از موجودی قابل تسویه است');
    }
    await this.prisma.payout.create({ data: { artistId: artist.id, amountIrR: amount } });
    this.audit.log({
      actorUserId: userId,
      action: 'artist.payout.request',
      entityType: 'Payout',
      entityId: artist.id,
      after: { amountIrR: amount },
    });
    return { ok: true };
  }

  /** Whether the user owns this track (purchased). */
  async hasAccess(userId: string | null, trackId: string): Promise<boolean> {
    if (!userId) return false;
    const purchase = await this.prisma.trackPurchase.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });
    return purchase !== null;
  }
}
