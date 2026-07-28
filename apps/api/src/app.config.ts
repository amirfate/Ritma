import { type INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Global pipes/middleware every running instance of this app needs —
 * shared between `main.ts` and the e2e test harness so tests exercise
 * the exact same request pipeline as production, not a stripped-down
 * approximation of it. `Test.createTestingModule(...).createNestApplication()`
 * does not run `main.ts`'s `bootstrap()`, so without this, e2e tests were
 * silently missing `transform`/`whitelist` behavior entirely.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
