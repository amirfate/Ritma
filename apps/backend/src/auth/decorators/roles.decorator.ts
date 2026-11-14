import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'ritma:roles';

export function Roles(...roles: string[]) {
  return SetMetadata(ROLES_KEY, roles);
}
