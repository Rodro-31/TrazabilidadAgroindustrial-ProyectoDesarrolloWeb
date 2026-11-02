jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { TareasService } from './tareas.service';

const YO = 'u-calidad';
const C1 = 'c-1';
const TAREA = '55555555-5555-4555-8555-555555555555';

describe('TareasService', () => {
  let prisma: any;
  let servicio: TareasService;

  beforeEach(() => {
    prisma = {
      usuarioCentro: { findMany: jest.fn().mockResolvedValue([{ centroId: C1 }]) },
      tarea: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: TAREA, tipo: 'CONFIRMAR_TRASLADO', estado: 'PENDIENTE' }),
        update: jest.fn().mockResolvedValue({ id: TAREA, estado: 'COMPLETADA' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    servicio = new TareasService(prisma);
  });

  it('mias: pendientes asignadas a mí o a mi rol en mis centros', async () => {
    await servicio.mias({ sub: YO, rol: 'CALIDAD' });
    const where = prisma.tarea.findMany.mock.calls[0][0].where;
    expect(where.estado).toBe('PENDIENTE');
    expect(where.OR).toEqual([
      { usuarioId: YO },
      { usuarioId: null, rol: 'CALIDAD', OR: [{ centroId: null }, { centroId: { in: [C1] } }] },
    ]);
  });

  it('mias: sin centros asignados ve las de su rol en todos los centros', async () => {
    prisma.usuarioCentro.findMany.mockResolvedValue([]);
    await servicio.mias({ sub: YO, rol: 'CALIDAD' });
    const where = prisma.tarea.findMany.mock.calls[0][0].where;
    expect(where.OR[1]).toEqual({ usuarioId: null, rol: 'CALIDAD' });
  });

  it('mias: ADMIN y SUPERVISOR ven todas las pendientes', async () => {
    await servicio.mias({ sub: 'admin', rol: 'SUPERVISOR' });
    expect(prisma.tarea.findMany.mock.calls[0][0].where).toEqual({ estado: 'PENDIENTE' });
    expect(prisma.usuarioCentro.findMany).not.toHaveBeenCalled();
  });

  it('completar: cierra una tarea visible y pendiente', async () => {
    await servicio.completar(TAREA, { sub: YO, rol: 'BASCULA' });
    expect(prisma.tarea.update.mock.calls[0][0].data).toMatchObject({ estado: 'COMPLETADA' });
  });

  it('completar: 404 si no es una tarea del usuario; 409 si ya no está pendiente', async () => {
    prisma.tarea.findFirst.mockResolvedValueOnce(null);
    await expect(servicio.completar(TAREA, { sub: YO, rol: 'CAMPO' })).rejects.toBeInstanceOf(NotFoundException);
    prisma.tarea.findFirst.mockResolvedValueOnce({ id: TAREA, tipo: 'CONFIRMAR_TRASLADO', estado: 'COMPLETADA' });
    await expect(servicio.completar(TAREA, { sub: YO, rol: 'CAMPO' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('completar: la de inspección solo se cierra registrando la inspección', async () => {
    prisma.tarea.findFirst.mockResolvedValue({ id: TAREA, tipo: 'INSPECCION_CALIDAD', estado: 'PENDIENTE' });
    await expect(servicio.completar(TAREA, { sub: YO, rol: 'CALIDAD' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tarea.update).not.toHaveBeenCalled();
  });

  it('crea la tarea de inspección para CALIDAD del centro de la recepción', async () => {
    await servicio.crearInspeccionRecepcion(prisma, 'rec-1', C1, 'Inspeccionar recepción');
    expect(prisma.tarea.create.mock.calls[0][0].data).toEqual({
      tipo: 'INSPECCION_CALIDAD',
      titulo: 'Inspeccionar recepción',
      rol: 'CALIDAD',
      centroId: C1,
      entidadTipo: 'recepcion',
      entidadId: 'rec-1',
    });
  });

  it('completarPorEntidad solo toca las pendientes de ese tipo y entidad', async () => {
    await servicio.completarPorEntidad(prisma, 'INSPECCION_CALIDAD', 'lote', 'l-1');
    expect(prisma.tarea.updateMany.mock.calls[0][0].where).toEqual({
      tipo: 'INSPECCION_CALIDAD',
      entidadTipo: 'lote',
      entidadId: 'l-1',
      estado: 'PENDIENTE',
    });
  });
});
