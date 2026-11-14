import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { AlbumsController, ArtistsController, TracksController } from './catalog.controller';
import { AlbumsService, ArtistsService, TracksService } from './catalog.service';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [ArtistsController, AlbumsController, TracksController],
  providers: [ArtistsService, AlbumsService, TracksService],
  exports: [TracksService],
})
export class CatalogModule {}
