import { createHash } from 'crypto';
import { TokensService } from './tokens.service';

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

const filaBase = {
  id: 'tok-1',
  proposito: 'QR_RECEPCION',
  entidadTipo: 'recepcion',
  entidadId: 'rec-1',
  expiraEn: null,
  usadoEn: null,
  revocadoEn: null,
};

function crearServicio(fila: unknown = null) {
  const prisma = {
    token: {
      create: jest.fn().mockResolvedValue({ id: 'tok-1' }),
      findUnique: jest.fn().mockResolvedValue(fila),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma, servicio: new TokensService(prisma as any) };
}

describe('TokensService', () => {
  describe('crear', () => {
    it('guarda solo el hash SHA-256, nunca el valor', async () => {
      const { prisma, servicio } = crearServicio();
      const { valor } = await servicio.crear({
        proposito: 'QR_RECEPCION',
        entidadTipo: 'recepcion',
        entidadId: 'rec-1',
      });

      const datos = prisma.token.create.mock.calls[0][0].data;
      expect(valor.length).toBeGreaterThanOrEqual(43);
      expect(datos.valorHash).toBe(sha256(valor));
      expect(JSON.stringify(datos)).not.toContain(valor);
      expect(datos.expiraEn).toBeNull();
    });

    it('genera un valor distinto cada vez', async () => {
      const { servicio } = crearServicio();
      const a = await servicio.crear({ proposito: 'QR_LOTE', entidadTipo: 'lote', entidadId: 'l1' });
      const b = await servicio.crear({ proposito: 'QR_LOTE', entidadTipo: 'lote', entidadId: 'l1' });
      expect(a.valor).not.toBe(b.valor);
    });
  });

  describe('validar', () => {
    const casos: [string, unknown, string][] = [
      ['VALIDO', { ...filaBase }, 'VALIDO'],
      ['REVOCADO', { ...filaBase, revocadoEn: new Date() }, 'REVOCADO'],
      ['USADO', { ...filaBase, usadoEn: new Date() }, 'USADO'],
      ['EXPIRADO', { ...filaBase, expiraEn: new Date(Date.now() - 1000) }, 'EXPIRADO'],
      ['INEXISTENTE', null, 'INEXISTENTE'],
      ['otro propósito', { ...filaBase, proposito: 'RECUPERACION_PASSWORD' }, 'INEXISTENTE'],
    ];

    it.each(casos)('responde %s y siempre audita', async (_nombre, fila, esperado) => {
      const { prisma, servicio } = crearServicio(fila);
      const { resultado } = await servicio.validar('valor-secreto-123', 'QR_RECEPCION', {
        usuarioId: 'u1',
        ip: '1.2.3.4',
      });

      expect(resultado).toBe(esperado);
      expect(prisma.token.findUnique).toHaveBeenCalledWith({ where: { valorHash: sha256('valor-secreto-123') } });
      expect(prisma.auditoria.create).toHaveBeenCalledTimes(1);
      const auditoria = prisma.auditoria.create.mock.calls[0][0].data;
      expect(auditoria.accion).toBe('TOKEN_VALIDADO');
      expect(auditoria.usuarioId).toBe('u1');
      expect(JSON.stringify(auditoria)).not.toContain('valor-secreto-123');
    });

    it('acepta varios propósitos (el escáner de la PWA)', async () => {
      const { servicio } = crearServicio({ ...filaBase, proposito: 'QR_LOTE' });
      const { resultado } = await servicio.validar('x', ['QR_RECEPCION', 'QR_LOTE']);
      expect(resultado).toBe('VALIDO');
    });

    it('un valor vacío es inexistente, no consulta la base y audita', async () => {
      const { prisma, servicio } = crearServicio();
      const { resultado } = await servicio.validar('', 'QR_LOTE');
      expect(resultado).toBe('INEXISTENTE');
      expect(prisma.token.findUnique).not.toHaveBeenCalled();
      expect(prisma.auditoria.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('marcarUsado', () => {
    it('solo lo logra una vez: la condición va en el WHERE', async () => {
      const { prisma, servicio } = crearServicio();
      expect(await servicio.marcarUsado('tok-1')).toBe(true);
      const where = prisma.token.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ id: 'tok-1', usadoEn: null, revocadoEn: null });

      prisma.token.updateMany.mockResolvedValueOnce({ count: 0 });
      expect(await servicio.marcarUsado('tok-1')).toBe(false);
    });
  });
});
