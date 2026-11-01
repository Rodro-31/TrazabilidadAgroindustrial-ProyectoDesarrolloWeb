import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

// Formato único de error de toda la API: { statusCode, mensaje, errores? }
export interface RespuestaError {
  statusCode: number;
  mensaje: string;
  errores?: string[];
}

// Errores de Prisma que ninguna capa tradujo antes (por código). Evita responder 500 a
// problemas que en realidad son del cliente.
const ERRORES_PRISMA: Record<string, { status: number; mensaje: string }> = {
  P2002: { status: HttpStatus.CONFLICT, mensaje: 'Ya existe un registro con esos datos' },
  P2003: { status: HttpStatus.BAD_REQUEST, mensaje: 'Un dato relacionado no existe' },
  P2025: { status: HttpStatus.NOT_FOUND, mensaje: 'Registro no encontrado' },
};

export function construirRespuestaError(excepcion: unknown): RespuestaError {
  if (excepcion instanceof HttpException) {
    const statusCode = excepcion.getStatus();
    const cuerpo = excepcion.getResponse();

    if (typeof cuerpo === 'string') return { statusCode, mensaje: cuerpo };

    const { message } = cuerpo as { message?: string | string[] };
    // class-validator devuelve una lista de mensajes: se entrega como "errores".
    if (Array.isArray(message)) {
      return { statusCode, mensaje: 'Datos inválidos', errores: message };
    }
    return { statusCode, mensaje: message ?? excepcion.message };
  }

  const codigo = (excepcion as { code?: unknown } | null)?.code;
  if (typeof codigo === 'string' && ERRORES_PRISMA[codigo]) {
    const { status, mensaje } = ERRORES_PRISMA[codigo];
    return { statusCode: status, mensaje };
  }

  // Cualquier otra cosa es un error nuestro: no se filtran detalles internos al cliente.
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, mensaje: 'Error interno del servidor' };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(excepcion: unknown, host: ArgumentsHost) {
    const respuesta = construirRespuestaError(excepcion);

    if (respuesta.statusCode >= 500) {
      this.logger.error(
        excepcion instanceof Error ? excepcion.message : String(excepcion),
        excepcion instanceof Error ? excepcion.stack : undefined,
      );
    }

    host.switchToHttp().getResponse<Response>().status(respuesta.statusCode).json(respuesta);
  }
}
