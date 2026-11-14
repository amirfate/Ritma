import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get userCap(): number {
    return this.config.get<number>('BETA_MAX_USERS', 100);
  }

  get invitesPerUser(): number {
    return this.config.get<number>('BETA_MAX_INVITES_PER_USER', 10);
  }

  get devicesPerUser(): number {
    return this.config.get<number>('BETA_MAX_DEVICES_PER_USER', 2);
  }

  async status() {
    const [users, successfulInvites, activeInviters] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.invite.count({ where: { usedAt: { not: null } } }),
      this.prisma.invite.groupBy({
        by: ['invitedByUserId'],
        where: { usedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    return {
      users,
      userCap: this.userCap,
      seatsLeft: Math.max(0, this.userCap - users),
      successfulInvites,
      invitesPerUser: this.invitesPerUser,
      usersAtInviteLimit: activeInviters.filter((g) => g._count._all >= this.invitesPerUser).length,
    };
  }

  async assertRegistrationAllowed(): Promise<void> {
    const users = await this.prisma.user.count();
    if (users >= this.userCap) {
      throw new ForbiddenException(`ظرفیت بتا پر است (سقف ${this.userCap} کاربر)`);
    }
  }

  async createInvite(invitedByUserId: string, note?: string) {
    const successful = await this.prisma.invite.count({
      where: { invitedByUserId, usedAt: { not: null } },
    });
    if (successful >= this.invitesPerUser) {
      throw new ForbiddenException(`سقف ${this.invitesPerUser} دعوت موفق پر شده است`);
    }
    return this.prisma.invite.create({
      data: { code: this.newCode(), invitedByUserId, note },
    });
  }

  /** Consumes an invite code inside the caller's transaction context. */
  async assertInviteUsable(code: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
    if (!invite) throw new BadRequestException('کد دعوت نامعتبر است');
    if (invite.revoked) throw new BadRequestException('این کد دعوت باطل شده است');
    if (invite.usedAt) throw new ConflictException('این کد قبلاً استفاده شده است');
    const successful = await this.prisma.invite.count({
      where: { invitedByUserId: invite.invitedByUserId, usedAt: { not: null } },
    });
    if (successful >= this.invitesPerUser) {
      throw new ForbiddenException('ظرفیت دعوتِ صادرکننده‌ی این کد پر شده است');
    }
    return invite;
  }

  private newCode(): string {
    // Unambiguous alphabet: no 0/O, 1/I/L.
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[bytes[i]! % alphabet.length]!;
    return `RITMA-${code}`;
  }
  myInvites(userId: string) {
    return this.prisma.invite.findMany({
      where: { invitedByUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: { usedBy: { select: { email: true, name: true } } },
    });
  }
}
