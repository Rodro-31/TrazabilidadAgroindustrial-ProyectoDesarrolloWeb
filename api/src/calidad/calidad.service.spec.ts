jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      m: string,
      public code: string,
    ) {
      super(m);
    }
  }
  return { PrismaClient: class {}, Prisma: { PrismaClientKnownRequestError } };
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CalidadService } from './calidad.service';

const ID = '11111111-1111-4111-8111-111111111111';
const REC = '22222222-2222-4222-8222-222222222222';
const LOTE = '33333333-3333-4333-8333-333333333333';
const GRADO = '44444444-4444-4444-8444-444444444444';

describe('CalidadService', () => {
  let tx: any;
  let prisma: any;
  let tareas: any;
  let servicio: CalidadService;
  const base = { id: ID, aprobado: true, inspeccionadoEn: new Date().toISOString() };

  beforeEach(() => {
    tx = {
      recepcion: { count: jest.fn().mockResolvedValue(1) },
      lote: {
        findUnique: jest.fn().mockResolvedValue({ estado: 'ACTIVO', codigo: 'L-2026-00001' }),
        update: jest.fn().mockResolvedValue({}),
      },
      gradoCalidad: { findUnique: jest.fn().mockResolvedValue({ activo: true }) },
      inspeccionCalidad: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      inspeccionCalidad: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: ID }),
      },
      $transaction: jest.fn().mockImplementation((fn: (t: any) => unknown) => fn(tx)),
    };
    tareas = { completarPorEntidad: jest.fn().mockResolvedValue(1) };
    servicio = new CalidadService(prisma, tareas);
  });

  it('registra la inspección de una recepción y cierra su tarea de inspección', async () => {
    const r = await servicio.crear({ ...base, recepcionId: REC, humedadPct: 11.5 }, 'insp');
    expect(r.creada).toBe(true);
    expect(tx.inspeccionCalidad.create.mock.calls[0][0].data).toMatchObject({
      id: ID,
      recepcionId: REC,
      loteId: null,
      inspectorId: 'insp',
      humedadPct: 11.5,
    });
    expect(tareas.completarPorEntidad).toHaveBeenCalledWith(tx, 'INSPECCION_CALIDAD', 'recepcion', REC);
    expect(tx.lote.update).not.toHaveBeenCalled();
  });

  it('en un lote con grado, actualiza el grado del lote', async () => {
    await servicio.crear({ ...base, loteId: LOTE, gradoCalidadId: GRADO }, 'insp');
    expect(tx.lote.update).toHaveBeenCalledWith({ where: { id: LOTE }, data: { gradoCalidadId: GRADO } });
  });

  it('es idempotente: si el id ya existe devuelve la existente sin crear otra', async () => {
    prisma.inspeccionCalidad.findUnique = jest.fn().mockResolvedValue({ id: ID });
    const r = await servicio.crear({ ...base, recepcionId: REC }, 'insp');
    expect(r.creada).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('si dos envíos llegan a la vez (P2002) el segundo recibe la ya creada', async () => {
    prisma.$transaction.mockRejectedValue(new (Prisma as any).PrismaClientKnownRequestError('dup', 'P2002'));
    const r = await servicio.crear({ ...base, recepcionId: REC }, 'insp');
    expect(r).toEqual({ creada: false, inspeccion: { id: ID } });
  });

  it.each([
    ['ninguno', {}],
    ['ambos', { recepcionId: REC, loteId: LOTE }],
  ])('exige recepción o lote, exactamente uno (%s)', async (_n, objetivo) => {
    await expect(servicio.crear({ ...base, ...objetivo }, 'insp')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha de inspección en el futuro', async () => {
    const futuro = new Date(Date.now() + 3_600_000).toISOString();
    await expect(servicio.crear({ ...base, recepcionId: REC, inspeccionadoEn: futuro }, 'insp')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404 si la recepción o el lote no existen', async () => {
    tx.recepcion.count.mockResolvedValue(0);
    await expect(servicio.crear({ ...base, recepcionId: REC }, 'insp')).rejects.toBeInstanceOf(NotFoundException);
    prisma.inspeccionCalidad.findUnique = jest.fn().mockResolvedValue(null);
    tx.lote.findUnique.mockResolvedValue(null);
    await expect(servicio.crear({ ...base, loteId: LOTE }, 'insp')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no inspecciona un lote anulado', async () => {
    tx.lote.findUnique.mockResolvedValue({ estado: 'ANULADO', codigo: 'L-2026-00001' });
    await expect(servicio.crear({ ...base, loteId: LOTE }, 'insp')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inspeccionCalidad.create).not.toHaveBeenCalled();
  });

  it('rechaza un grado inexistente o inactivo', async () => {
    tx.gradoCalidad.findUnique.mockResolvedValue({ activo: false });
    await expect(servicio.crear({ ...base, loteId: LOTE, gradoCalidadId: GRADO }, 'insp')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.lote.update).not.toHaveBeenCalled();
  });
});
