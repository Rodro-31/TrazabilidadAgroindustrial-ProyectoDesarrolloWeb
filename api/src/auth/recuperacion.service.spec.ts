jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MINUTOS_RECUPERACION, RecuperacionService } from './recuperacion.service';

const USR = '22222222-2222-4222-8222-222222222222';

describe('RecuperacionService', () => {
  let prisma: any;
  let tokens: any;
  let correo: any;
  let servicio: RecuperacionService;

  beforeEach(() => {
    process.env.APP_URL = 'https://app.ejemplo.gt/';
    prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ id: USR, nombre: 'Ana', email: 'ana@demo.gt', activo: true }),
        update: jest.fn().mockReturnValue('upd'),
      },
      refreshToken: { updateMany: jest.fn().mockReturnValue('rev') },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    tokens = {
      crear: jest.fn().mockResolvedValue({ id: 't1', valor: 'VALOR_SECRETO_DEL_TOKEN_123' }),
      revocarPorEntidad: jest.fn().mockResolvedValue(1),
      validar: jest.fn(),
      marcarUsado: jest.fn().mockResolvedValue(true),
    };
    correo = { enviar: jest.fn().mockResolvedValue(true) };
    servicio = new RecuperacionService(prisma, tokens, correo);
  });

  afterEach(() => delete process.env.APP_URL);

  it('solicitar: crea un token que vence en 30 min, invalida el anterior y envía el enlace', async () => {
    const antes = Date.now();
    await servicio.solicitar('ana@demo.gt', {});
    expect(tokens.revocarPorEntidad).toHaveBeenCalledWith('usuario', USR, 'RECUPERACION_PASSWORD');
    const datos = tokens.crear.mock.calls[0][0];
    expect(datos.proposito).toBe('RECUPERACION_PASSWORD');
    const minutos = (datos.expiraEn.getTime() - antes) / 60_000;
    expect(minutos).toBeGreaterThan(MINUTOS_RECUPERACION - 1);
    expect(minutos).toBeLessThanOrEqual(MINUTOS_RECUPERACION + 0.1);
    expect(correo.enviar.mock.calls[0][2]).toContain('https://app.ejemplo.gt/restablecer#t=VALOR_SECRETO_DEL_TOKEN_123');
  });

  it('solicitar: con un correo que no existe no crea token ni envía nada, y no falla', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(servicio.solicitar('nadie@demo.gt', {})).resolves.toBeUndefined();
    expect(tokens.crear).not.toHaveBeenCalled();
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it('la auditoría nunca guarda el token ni el enlace', async () => {
    await servicio.solicitar('ana@demo.gt', {});
    await servicio.generarParaUsuario(USR, { usuarioId: 'admin' });
    const auditado = JSON.stringify(prisma.auditoria.create.mock.calls);
    expect(auditado).not.toContain('VALOR_SECRETO_DEL_TOKEN_123');
    expect(auditado).not.toContain('restablecer');
  });

  it('generarParaUsuario: devuelve el enlace y la expiración; 404 si no existe; 400 si está desactivado', async () => {
    const r = await servicio.generarParaUsuario(USR, { usuarioId: 'admin' });
    expect(r.enlace).toBe('https://app.ejemplo.gt/restablecer#t=VALOR_SECRETO_DEL_TOKEN_123');
    expect(tokens.crear.mock.calls[0][0].creadoPorId).toBe('admin');
    prisma.usuario.findUnique.mockResolvedValueOnce(null);
    await expect(servicio.generarParaUsuario(USR, {})).rejects.toBeInstanceOf(NotFoundException);
    prisma.usuario.findUnique.mockResolvedValueOnce({ id: USR, activo: false });
    await expect(servicio.generarParaUsuario(USR, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restablecer: con token válido cambia el hash, desbloquea y cierra las sesiones', async () => {
    tokens.validar.mockResolvedValue({ resultado: 'VALIDO', token: { id: 't1', entidadTipo: 'usuario', entidadId: USR } });
    await servicio.restablecer('VALOR_SECRETO_DEL_TOKEN_123', 'NuevaClave2026', {});
    expect(tokens.marcarUsado).toHaveBeenCalledWith('t1');
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('NuevaClave2026', data.passwordHash)).toBe(true);
    expect(data).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId: USR, revocadoEn: null } }));
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it.each(['EXPIRADO', 'USADO', 'REVOCADO', 'INEXISTENTE'])('restablecer: rechaza un token %s sin tocar la contraseña', async (resultado) => {
    tokens.validar.mockResolvedValue({ resultado, token: null });
    await expect(servicio.restablecer('x'.repeat(30), 'NuevaClave2026', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('restablecer: si otra petición ya consumió el token, falla (uso único)', async () => {
    tokens.validar.mockResolvedValue({ resultado: 'VALIDO', token: { id: 't1', entidadTipo: 'usuario', entidadId: USR } });
    tokens.marcarUsado.mockResolvedValue(false);
    await expect(servicio.restablecer('x'.repeat(30), 'NuevaClave2026', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});
