import { Controller, Get } from '@nestjs/common';
import { API_ROUTES, type HealthResponse } from '@ritma/api-contracts';

@Controller(API_ROUTES.health)
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
