import { SetMetadata } from '@nestjs/common';
import { type UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Marks a route/controller as restricted to the given roles; enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
