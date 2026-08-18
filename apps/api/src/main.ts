import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { configureApp } from './app.config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  app.get(Logger).log(`Ritma API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
