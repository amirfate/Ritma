import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { InvitationController } from '../invitation/invitation.controller';
import { InvitationModule } from '../invitation/invitation.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { OtpService } from './otp.service';
import { SMS_PROVIDER } from './sms/sms-provider';
import { SmsIrProvider } from './sms/sms-ir.provider';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), InvitationModule],
  controllers: [AuthController, InvitationController],
  providers: [
    AuthService,
    OtpService,
    DeviceService,
    TokenService,
    { provide: SMS_PROVIDER, useClass: SmsIrProvider },
  ],
  exports: [TokenService],
})
export class AuthModule {}
