import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { Auditar } from './auditar.decorator';
import { AuditoriaInterceptor } from './auditoria.interceptor';

@Auditar('recepcion')
class ControladorDePrueba {
  modificar() {}
}

function crearInterceptor() {
  const prisma = {
    auditoria: { create: jest.fn().mockResolvedValue({}) },
    recepcion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', pesoBrutoKg: '10.00' }) },
  };
  return { prisma, interceptor: new AuditoriaInterceptor(prisma as any, new Reflector()) };
}

function contexto(req: Record<string, unknown>, clase: Function = class Otro {}, metodo: Function = () => {}) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => metodo,
    getClass: () => clase,
  } as any;
}

const solicitud = (extra: Record<string, unknown> = {}) => ({
  method: 'POST',
  route: { path: '/api/v1/recepciones' },
  params: {},
  user: { sub: 'u1', rol: 'BASCULA' },
  ip: '10.0.0.9',
  headers: { 'user-agent': 'jest' },
  ...extra,
});

describe('AuditoriaInterceptor', () => {
  it('audita un POST con usuario, IP y respuesta sin campos sensibles', async () => {
    const { prisma, interceptor } = crearInterceptor();
    const respuesta = { id: 'r1', pesoNetoKg: '8.00', qr: { valor: 'secreto' } };

    const salida = await lastValueFrom(interceptor.intercept(contexto(solicitud()), { handle: () => of(respuesta) }));

    expect(salida).toBe(respuesta); // la respuesta al cliente no se altera
    const datos = prisma.auditoria.create.mock.calls[0][0].data;
    expect(datos).toMatchObject({
      usuarioId: 'u1',
      accion: 'POST /api/v1/recepciones',
      entidad: 'recepciones', // sin @Auditar usa el nombre del controlador
      entidadId: 'r1',
      ip: '10.0.0.9',
      userAgent: 'jest',
    });
    expect(JSON.stringify(datos)).not.toContain('secreto');
  });

  it('guarda el estado anterior en PATCH usando la entidad de @Auditar', async () => {
    const { prisma, interceptor } = crearInterceptor();
    const req = solicitud({ method: 'PATCH', params: { id: 'r1' }, route: { path: '/api/v1/recepciones/:id' } });

    await lastValueFrom(
      interceptor.intercept(contexto(req, ControladorDePrueba, ControladorDePrueba.prototype.modificar), {
        handle: () => of({ id: 'r1', pesoNetoKg: '9.00' }),
      }),
    );

    expect(prisma.recepcion.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
    const datos = prisma.auditoria.create.mock.calls[0][0].data;
    expect(datos.entidad).toBe('recepcion');
    expect(datos.antes).toEqual({ id: 'r1', pesoBrutoKg: '10.00' });
    expect(datos.despues).toEqual({ id: 'r1', pesoNetoKg: '9.00' });
  });

  it('no audita lecturas (GET)', async () => {
    const { prisma, interceptor } = crearInterceptor();
    await lastValueFrom(interceptor.intercept(contexto(solicitud({ method: 'GET' })), { handle: () => of([]) }));
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });

  it('no audita /auth: el servicio ya audita el login y su cuerpo trae contraseñas', async () => {
    const { prisma, interceptor } = crearInterceptor();
    const req = solicitud({ route: { path: '/api/v1/auth/login' } });
    await lastValueFrom(interceptor.intercept(contexto(req), { handle: () => of({ accessToken: 'a' }) }));
    expect(prisma.auditoria.create).not.toHaveBeenCalled();
  });

  it('si falla el registro de auditoría, la respuesta al cliente no se rompe', async () => {
    const { prisma, interceptor } = crearInterceptor();
    prisma.auditoria.create.mockRejectedValue(new Error('base caída'));
    const salida = await lastValueFrom(
      interceptor.intercept(contexto(solicitud()), { handle: () => of({ id: 'r1' }) }),
    );
    expect(salida).toEqual({ id: 'r1' });
  });
});
