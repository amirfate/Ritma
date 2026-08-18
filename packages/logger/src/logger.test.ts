import { describe, expect, it } from 'vitest';

import { createLoggerModuleOptions, redactionPaths } from './logger';

describe('redactionPaths', () => {
  it('forbids logging OTP codes, JWT/refresh secrets, and payment secrets', () => {
    expect(redactionPaths).toContain('*.otp');
    expect(redactionPaths).toContain('*.otpCode');
    expect(redactionPaths).toContain('*.jwtSecret');
    expect(redactionPaths).toContain('*.refreshToken');
    expect(redactionPaths).toContain('*.paymentSecret');
    expect(redactionPaths).toContain('*.cardNumber');
    expect(redactionPaths).toContain('*.code');
    expect(redactionPaths).toContain('*.invitationCode');
  });
});

describe('createLoggerModuleOptions', () => {
  it('uses pretty-printed debug output in development', () => {
    const options = createLoggerModuleOptions('development');

    expect(options.pinoHttp).toMatchObject({ level: 'debug' });
    expect(options.pinoHttp).toHaveProperty('transport');
  });

  it('uses structured info-level output outside development', () => {
    const options = createLoggerModuleOptions('production');

    expect(options.pinoHttp).toMatchObject({ level: 'info', transport: undefined });
  });

  it('applies the shared redaction paths to every environment', () => {
    const options = createLoggerModuleOptions('production');

    expect(options.pinoHttp).toMatchObject({
      redact: { paths: redactionPaths, censor: '[REDACTED]' },
    });
  });
});
