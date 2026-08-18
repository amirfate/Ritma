import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type UserRole } from '@prisma/client';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { type AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Authorization, not authentication: must run after `JwtAuthGuard` (it
 * reads `request.auth`, which only `JwtAuthGuard` populates). A route
 * with no `@Roles()` decorator is left unrestricted by this guard — it
 * only enforces roles where explicitly required.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!requiredRoles.includes(request.auth.role)) {
      throw new ForbiddenException('This operation requires a different role');
    }

    return true;
  }
}
