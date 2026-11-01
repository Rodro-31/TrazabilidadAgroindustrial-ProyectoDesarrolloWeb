import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { construirRespuestaError } from './http-exception.filter';

describe('construirRespuestaError', () => {
  it('entrega los errores de validación como lista', () => {
    const r = construirRespuestaError(new BadRequestException(['email inválido', 'password muy corta']));
    expect(r).toEqual({
      statusCode: 400,
      mensaje: 'Datos inválidos',
      errores: ['email inválido', 'password muy corta'],
    });
  });

  it('conserva el mensaje de las excepciones HTTP', () => {
    expect(construirRespuestaError(new NotFoundException('Productor no encontrado'))).toEqual({
      statusCode: 404,
      mensaje: 'Productor no encontrado',
    });
    expect(construirRespuestaError(new ForbiddenException('Sin permiso')).statusCode).toBe(403);
  });

  it('traduce errores de Prisma que nadie tradujo antes', () => {
    expect(construirRespuestaError({ code: 'P2002' }).statusCode).toBe(409);
    expect(construirRespuestaError({ code: 'P2025' }).statusCode).toBe(404);
  });

  it('no filtra detalles internos en errores inesperados', () => {
    const r = construirRespuestaError(new Error('connection to 10.0.0.5 refused, password=abc'));
    expect(r).toEqual({ statusCode: 500, mensaje: 'Error interno del servidor' });
  });
});
