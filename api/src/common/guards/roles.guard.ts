import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Guard global: si la ruta tiene @Roles(...), el usuario debe tener uno de esos roles.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para esta operación');
    }
    return true;
  }
}
