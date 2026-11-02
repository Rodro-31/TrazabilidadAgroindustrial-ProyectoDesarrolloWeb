import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from './usuarios.service';

// Prisma solo se usa aquí para el enum Rol y el tipo de error P2002; se simula el mínimo.
jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      m: string,
      public code: string,
    ) {
      super(m);
    }
  }
  return {
    PrismaClient: class {},
    Rol: { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', CALIDAD: 'CALIDAD', BASCULA: 'BASCULA', CAMPO: 'CAMPO', AUDITOR: 'AUDITOR' },
    Prisma: { PrismaClientKnownRequestError },
  };
});

const ID = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const base = { id: ID, email: 'a@x.com', nombre: 'Ana', rol: 'CAMPO', activo: true, bloqueadoHasta: null, creadoEn: new Date() };

describe('UsuariosService', () => {
  let prisma: any;
  let servicio: UsuariosService;

  beforeEach(() => {
    prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue(base),
        findMany: jest.fn().mockResolvedValue([base]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...data })),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    servicio = new UsuariosService(prisma);
  });

  it('crea el usuario guardando solo el hash de la contraseña', async () => {
    await servicio.crear({ email: 'n@x.com', nombre: 'Nuevo', rol: 'CAMPO' as any, password: 'ClaveSegura1' });
    const data = prisma.usuario.create.mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe('ClaveSegura1');
    expect(await bcrypt.compare('ClaveSegura1', data.passwordHash)).toBe(true);
    expect(data).not.toHaveProperty('password');
  });

  it('nunca pide passwordHash en lecturas', async () => {
    await servicio.listar({ pagina: 1, limite: 20 } as any);
    await servicio.obtener(ID);
    for (const llamada of [prisma.usuario.findMany.mock.calls[0][0], prisma.usuario.findUnique.mock.calls[0][0]]) {
      expect(llamada.select).toBeDefined();
      expect(llamada.select).not.toHaveProperty('passwordHash');
    }
  });

  it('da 409 si el correo ya existe', async () => {
    const { Prisma } = jest.requireMock('@prisma/client');
    prisma.usuario.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', 'P2002'));
    await expect(
      servicio.crear({ email: 'a@x.com', nombre: 'Ana', rol: 'CAMPO' as any, password: 'ClaveSegura1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('da 404 si el usuario no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un administrador no puede cambiar su propio rol ni desactivarse', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...base, rol: 'ADMIN' });
    await expect(servicio.actualizar(ID, { rol: 'CAMPO' as any }, ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.actualizar(ID, { activo: false }, ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('permite editar el propio nombre', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...base, rol: 'ADMIN' });
    await servicio.actualizar(ID, { nombre: 'Otro Nombre' }, ID);
    expect(prisma.usuario.update).toHaveBeenCalled();
  });

  it('no deja al sistema sin administradores activos', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...base, rol: 'ADMIN' });
    prisma.usuario.count.mockResolvedValue(0); // no hay otro admin activo
    await expect(servicio.actualizar(ID, { activo: false }, OTRO)).rejects.toThrow('al menos un administrador');
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('desactivar a otro admin es válido si queda otro activo, y cierra sus sesiones', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...base, rol: 'ADMIN' });
    prisma.usuario.count.mockResolvedValue(1);
    await servicio.actualizar(ID, { activo: false }, OTRO);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: ID, revocadoEn: null },
      data: { revocadoEn: expect.any(Date) },
    });
  });

  it('cambiar solo el nombre no cierra sesiones', async () => {
    await servicio.actualizar(ID, { nombre: 'Nuevo Nombre' }, OTRO);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('restablecer contraseña guarda hash, levanta el bloqueo y cierra sesiones', async () => {
    await servicio.restablecerPassword(ID, 'OtraClave123');
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('OtraClave123', data.passwordHash)).toBe(true);
    expect(data).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('desbloquear limpia intentos y bloqueo', async () => {
    await servicio.desbloquear(ID);
    expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ intentosFallidos: 0, bloqueadoHasta: null });
  });
});
