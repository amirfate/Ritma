import { type Params } from 'nestjs-pino';

/**
 * Paths redacted from every log line, regardless of nesting depth (the
 * trailing `.*` wildcard). Covers the fields the specification forbids
 * logging: OTP codes, JWT secrets, and payment secrets.
 *
 * Field names are kept generic on purpose — this list is defined before any
 * module that emits these fields exists, so it must survive naming choices
 * made later (e.g. `otpCode` vs `code`, `refreshToken` vs `token`).
 */
export const redactionPaths: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.otp',
  '*.otpCode',
  '*.code',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.jwtSecret',
  '*.cardNumber',
  '*.cvv',
  '*.paymentSecret',
];

/**
 * Builds the options object for `nestjs-pino`'s `LoggerModule.forRoot()`.
 *
 * `NODE_ENV=development` gets human-readable `pino-pretty` output; every
 * other environment logs structured JSON, which is what a production log
 * pipeline expects.
 */
export function createLoggerModuleOptions(nodeEnv: string): Params {
  const isDevelopment = nodeEnv === 'development';

  return {
    pinoHttp: {
      level: isDevelopment ? 'debug' : 'info',
      redact: {
        paths: redactionPaths,
        censor: '[REDACTED]',
      },
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: { singleLine: true },
          }
        : undefined,
    },
  };
}
