import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard, type AuthedUser } from '../auth/guards/auth.guards';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('plans')
  plans() {
    return this.payments.plans();
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders')
  createOrder(@Body() dto: { planCode: string }, @Req() req: Request & { user?: AuthedUser }) {
    if (!req.user) throw new ForbiddenException();
    return this.payments.createOrder(req.user.sub, dto.planCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/pay')
  pay(
    @Body() dto: { orderId: string; gateway?: string; callbackUrl?: string },
    @Req() req: Request & { user?: AuthedUser },
  ) {
    if (!req.user) throw new ForbiddenException();
    return this.payments.startPayment(
      req.user.sub,
      dto.orderId,
      dto.gateway ?? 'mock',
      dto.callbackUrl ?? 'http://localhost:3001/payments/callback',
    );
  }

  @Get('callback')
  callback(@Query('orderId') orderId: string, @Query('authority') authority: string, @Query('ok') ok?: string) {
    return this.payments.handleCallback(orderId, authority, ok !== 'false');
  }
}
