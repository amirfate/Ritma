import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/guards/auth.guards';
import { WalletService } from './wallet.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallet')
  balance(@CurrentUser() user: AuthedUser) {
    return this.wallet.balance(user.sub);
  }

  @Get('wallet/tx')
  tx(@CurrentUser() user: AuthedUser) {
    return this.wallet.tx(user.sub);
  }

  @Post('wallet/charge')
  charge(@CurrentUser() user: AuthedUser, @Body() dto: { amountIrR: number }) {
    return this.wallet.createCharge(user.sub, Number(dto.amountIrR));
  }

  @Post('tracks/:id/purchase')
  purchase(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.wallet.purchaseTrack(user.sub, id);
  }

  @Post('artists/:id/donate')
  donate(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: { amountIrR: number; isAnonymous?: boolean },
  ) {
    return this.wallet.donate(user.sub, id, Number(dto.amountIrR), !!dto.isAnonymous);
  }

  @Get('pay/:ref')
  payRef(@CurrentUser() user: AuthedUser, @Param('ref') ref: string) {
    return this.wallet.getPayRef(user.sub, ref);
  }

  @Post('pay/:ref/confirm')
  confirm(@CurrentUser() user: AuthedUser, @Param('ref') ref: string) {
    return this.wallet.settleByOwner(user.sub, ref);
  }

  @Post('pay/:ref/cancel')
  cancel(@CurrentUser() user: AuthedUser, @Param('ref') ref: string) {
    return this.wallet.cancelPayRef(user.sub, ref);
  }

  @Get('library')
  library(@CurrentUser() user: AuthedUser) {
    return this.wallet.library(user.sub);
  }

  @Post('artists/:id/follow')
  follow(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.wallet.follow(user.sub, id);
  }

  @Delete('artists/:id/follow')
  unfollow(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.wallet.unfollow(user.sub, id);
  }

  @Get('follows')
  follows(@CurrentUser() user: AuthedUser) {
    return this.wallet.follows(user.sub);
  }

  @Get('history')
  history(@CurrentUser() user: AuthedUser) {
    return this.wallet.history(user.sub);
  }

  // ===== artist panel =====

  @Get('artist/panel')
  artistPanel(@CurrentUser() user: AuthedUser) {
    return this.wallet.artistPanel(user.sub);
  }

  @Get('artist/tracks')
  artistTracks(@CurrentUser() user: AuthedUser) {
    return this.wallet.artistTracks(user.sub);
  }

  @Get('artist/donations')
  artistDonations(@CurrentUser() user: AuthedUser) {
    return this.wallet.artistDonations(user.sub);
  }

  @Get('artist/ledger')
  artistLedger(@CurrentUser() user: AuthedUser) {
    return this.wallet.artistLedger(user.sub);
  }

  @Get('artist/payouts')
  artistPayouts(@CurrentUser() user: AuthedUser) {
    return this.wallet.artistPayouts(user.sub);
  }

  @Post('artist/payouts')
  requestPayout(@CurrentUser() user: AuthedUser, @Body() dto: { amountIrR: number }) {
    return this.wallet.requestPayout(user.sub, Number(dto.amountIrR));
  }
}
