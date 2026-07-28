import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

import { type AuthenticatedRequest } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

function contextWithRole(role: string | undefined): ExecutionContext {
  const request = { auth: role ? { role } : undefined } as unknown as AuthenticatedRequest;
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when the route has no @Roles() metadata', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole('LISTENER'))).toBe(true);
  });

  it('allows the request through when the caller has one of the required roles', () => {
    const reflector = { getAllAndOverride: () => ['ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole('ADMIN'))).toBe(true);
  });

  it('rejects the request when the caller lacks the required role', () => {
    const reflector = { getAllAndOverride: () => ['ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithRole('LISTENER'))).toThrow(ForbiddenException);
  });
});
