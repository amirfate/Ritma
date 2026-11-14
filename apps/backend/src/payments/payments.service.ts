import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PaymentGateway {
  readonly code: string;
  /** Creates a payment session and returns the redirect URL. */
  initiate(amountIrR: number, callbackUrl: string): Promise<{ authority: string; redirectUrl: string }>;
  /** Verifies a callback; returns true when paid. */
  verify(authority: string, amountIrR: number): Promise<boolean>;
}

@Injectable()
export class MockGateway implements PaymentGateway {
  readonly code = 'mock';

  async initiate(amountIrR: number, callbackUrl: string): Promise<{ authority: string; redirectUrl: string }> {
    void amountIrR;
    const authority = `MOCK-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    return { authority, redirectUrl: `${callbackUrl}?authority=${authority}&gateway=mock` };
  }

  async verify(authority: string, _amountIrR: number): Promise<boolean> {
    void _amountIrR;
    return authority.startsWith('MOCK-');
  }
}

@Injectable()
export class PaymentsService {
  private readonly gateways: Map<string, PaymentGateway> = new Map([['mock', new MockGateway()]]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  plans(): Promise<unknown> {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceIrR: 'asc' } });
  }

  async createOrder(userId: string, planCode: string): Promise<{ id: string; amountIrR: number }> {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.isActive) throw new NotFoundException('پلن یافت نشد');
    const order = await this.prisma.order.create({
      data: { userId, planId: plan.id, amountIrR: plan.priceIrR },
    });
    return { id: order.id, amountIrR: order.amountIrR };
  }

  async startPayment(
    userId: string,
    orderId: string,
    gatewayCode: string,
    callbackUrl: string,
  ): Promise<{ redirectUrl: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.status !== 'PENDING') throw new BadRequestException('سفارش قابل پرداخت نیست');
    const gateway = this.gateways.get(gatewayCode);
    if (!gateway) throw new BadRequestException('درگاه پرداخت نامعتبر است');
    const { authority, redirectUrl } = await gateway.initiate(order.amountIrR, callbackUrl);
    await this.prisma.paymentEvent.create({
      data: { orderId, gateway: gateway.code, authority, status: 'REDIRECTED', amountIrR: order.amountIrR },
    });
    return { redirectUrl };
  }

  /** Callback handler shared by mock and real gateways. */
  async handleCallback(orderId: string, authority: string, ok: boolean): Promise<{ status: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { plan: true } });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    const event = await this.prisma.paymentEvent.findFirst({
      where: { orderId, authority },
      orderBy: { createdAt: 'desc' },
    });
    if (!event) throw new BadRequestException('تراکنش یافت نشد');

    const verified = ok && (await this.gateways.get(event.gateway)!.verify(authority, order.amountIrR));
    if (!verified) {
      await this.prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'FAILED' } });
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'FAILED' } });
      return { status: 'FAILED' };
    }

    const durationMs = order.plan.durationDays * 86_400_000;
    await this.prisma.$transaction([
      this.prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'VERIFIED' } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
      this.prisma.user.update({ where: { id: order.userId }, data: { plan: 'PREMIUM' } }),
      this.prisma.subscription.updateMany({
        where: { userId: order.userId, active: true },
        data: { active: false },
      }),
      this.prisma.subscription.create({
        data: { userId: order.userId, endsAt: new Date(Date.now() + durationMs) },
      }),
    ]);
    this.audit.log({
      actorUserId: order.userId,
      action: 'payments.order.paid',
      entityType: 'Order',
      entityId: orderId,
      after: { amountIrR: order.amountIrR, gateway: 'mock' },
    });
    return { status: 'PAID' };
  }

  /** Premium gate used by the catalog streaming endpoints. */
  async isPremium(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, active: true, endsAt: { gt: new Date() } },
    });
    return sub !== null;
  }
}
