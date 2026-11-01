import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, mergeMap } from 'rxjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { AUDITAR_KEY } from './auditar.decorator';
import { sanitizar } from './sanitizar';

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Rutas que no se auditan aquí: /auth ya audita sus propios eventos (login exitoso y
// fallido) y su cuerpo trae contraseñas.
const RUTAS_EXCLUIDAS = /^\/api\/v1\/auth(\/|$)/;

// Interceptor global: toda operación que modifica datos (POST, PUT, PATCH, DELETE) y
// termina bien deja un registro con usuario, acción, entidad, id, estado antes y después,
// IP y user-agent. Las operaciones rechazadas por los guards (401/403) no llegan aquí.
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const ruta: string = req.route?.path ?? req.path ?? '';
    if (!METODOS_AUDITADOS.has(req.method) || RUTAS_EXCLUIDAS.test(ruta)) {
      return next.handle();
    }

    const entidad: string =
      this.reflector.getAllAndOverride<string>(AUDITAR_KEY, [ctx.getHandler(), ctx.getClass()]) ??
      this.entidadDelControlador(ruta);

    // El "antes" se lee antes de ejecutar la operación; el "después" es lo que responde.
    return from(this.leerAntes(entidad, req.params?.id)).pipe(
      mergeMap((antes) =>
        next.handle().pipe(
          mergeMap((respuesta) =>
            from(this.registrar(req, ruta, entidad, antes, respuesta)).pipe(
              mergeMap(() => [respuesta]),
            ),
          ),
        ),
      ),
    );
  }

  // Sin @Auditar, la entidad es el primer segmento de la ruta: /api/v1/productores/:id → productores
  private entidadDelControlador(ruta: string): string {
    return ruta.replace(/^\/api\/v1\//, '').split('/')[0] || 'desconocida';
  }

  private async leerAntes(entidad: string, id?: string): Promise<unknown> {
    if (!id) return null;
    const modelo = (this.prisma as unknown as Record<string, { findUnique?: Function }>)[entidad];
    if (!modelo || typeof modelo.findUnique !== 'function') return null;
    try {
      return await modelo.findUnique({ where: { id } });
    } catch {
      return null; // el id no tiene el formato de esa tabla: no hay "antes" que guardar
    }
  }

  // Si la auditoría falla no se rompe la respuesta (el cambio ya se hizo en la base),
  // pero queda en los logs para atenderlo.
  private async registrar(req: any, ruta: string, entidad: string, antes: unknown, respuesta: unknown) {
    try {
      const cuerpo = respuesta as { id?: unknown } | null;
      const entidadId =
        req.params?.id ?? (typeof cuerpo?.id === 'string' ? cuerpo.id : null);

      await this.prisma.auditoria.create({
        data: {
          usuarioId: req.user?.sub ?? null,
          accion: `${req.method} ${ruta}`,
          entidad,
          entidadId,
          antes: (sanitizar(antes) as object) ?? undefined,
          despues: (sanitizar(respuesta) as object) ?? undefined,
          ip: req.ip,
          userAgent: req.headers?.['user-agent'],
        },
      });
    } catch (error) {
      this.logger.error(`No se pudo registrar la auditoría de ${req.method} ${ruta}`, (error as Error)?.stack);
    }
  }
}
