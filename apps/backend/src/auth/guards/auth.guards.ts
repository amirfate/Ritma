import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { ROLES_KEY } from '../decorators/roles.decorator';

export interface AuthedUser {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      'ritma:public',
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      this.attachIfPresent(context);
      return true;
    }
    const user = this.attachIfPresent(context);
    return user !== null;
  }

  private attachIfPresent(context: ExecutionContext): AuthedUser | null {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthedUser;
    }>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return null;
    }
    try {
      const payload = this.jwt.verify<AuthedUser>(header.slice(7));
      request.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return request.user;
    } catch {
      return null;
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthedUser }>();
    const role = request.user?.role;
    return role !== undefined && required.includes(role);
  }
}
