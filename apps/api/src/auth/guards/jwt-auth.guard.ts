import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';

import { type AccessTokenPayload, TokenService } from '../token.service';

export interface AuthenticatedRequest extends Request {
  auth: AccessTokenPayload;
}

function extractBearerToken(request: Request): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing bearer token');
  }
  return header.slice('Bearer '.length);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);
    request.auth = await this.tokenService.verifyAccessToken(token);
    return true;
  }
}
