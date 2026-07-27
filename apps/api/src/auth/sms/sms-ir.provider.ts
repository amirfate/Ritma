import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type SmsProvider } from './sms-provider';

const SMS_IR_VERIFY_ENDPOINT = 'https://api.sms.ir/v1/send/verify';

/**
 * sms.ir Verify API integration. Sends the OTP code as the `CODE`
 * template parameter of a pre-configured sms.ir template — the code
 * itself is never logged, only whether the request succeeded.
 */
@Injectable()
export class SmsIrProvider implements SmsProvider {
  private readonly logger = new Logger(SmsIrProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const apiKey = this.configService.getOrThrow<string>('SMS_IR_API_KEY');
    const templateId = this.configService.getOrThrow<string>('SMS_IR_TEMPLATE_ID');

    const response = await fetch(SMS_IR_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        mobile: phoneNumber,
        templateId,
        parameters: [{ name: 'CODE', value: code }],
      }),
    });

    if (!response.ok) {
      this.logger.error(`sms.ir Verify API request failed with status ${response.status}`);
      throw new Error('Failed to send OTP via sms.ir');
    }
  }
}
