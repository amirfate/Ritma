import { Module } from '@nestjs/common';

import { BetaModule } from '../beta/beta.module';
import { DevicesModule } from '../devices/devices.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BetaModule, DevicesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
