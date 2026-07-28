import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';

import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';

describe('Ritma API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns {"status":"ok"}', async () => {
    await request(app.getHttpServer() as App)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
