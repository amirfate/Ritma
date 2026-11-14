import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthedUser } from '../guards/auth.guards';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthedUser }>().user,
);
