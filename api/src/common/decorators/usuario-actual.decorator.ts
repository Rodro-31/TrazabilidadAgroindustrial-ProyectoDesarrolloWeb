import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Devuelve el payload del JWT validado: { sub, rol }
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
