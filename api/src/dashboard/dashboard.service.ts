import { Injectable } from '@nestjs/common';
import { EstadoLote, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

type Decimal = Prisma.Decimal;

// Días que muestra la gráfica de recepciones.
const DIAS = 14;
// Guatemala no tiene horario de verano: siempre UTC-6. La base guarda las fechas en UTC,
// así que se restan 6 horas para que "hoy" y cada día coincidan con el reloj local.
const DESFASE_GT = 6 * 60 * 60 * 1000;
const DIA = 24 * 60 * 60 * 1000;

const diaLocal = (fecha: Date) => new Date(fecha.getTime() - DESFASE_GT).toISOString().slice(0, 10);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Todo lo que muestra la pantalla de inicio en UNA petición. Son consultas de
  // solo lectura que se ejecutan en paralelo (Promise.all): el tiempo total es el de
  // la más lenta, no la suma de todas.
  async resumen() {
    const ahora = new Date();
    const inicioHoy = new Date(Date.parse(diaLocal(ahora)) + DESFASE_GT); // 00:00 en Guatemala
    const desde = new Date(inicioHoy.getTime() - (DIAS - 1) * DIA);
    const hace30 = new Date(ahora.getTime() - 30 * DIA);

    const [
      porCentro,
      porProducto,
      porEstado,
      porDia,
      recepcionesHoy,
      productoresActivos,
      procesos30,
      ultimasRecepciones,
      ultimosLotes,
    ] = await Promise.all([
      // Existencia actual por centro. LEFT JOIN: un centro sin producto aparece con 0.
      // ::int porque COUNT devuelve bigint, que JSON no sabe representar.
      this.prisma.$queryRaw<{ id: string; codigo: string; nombre: string; kg: Decimal; lotes: number }[]>`
        SELECT c.id, c.codigo, c.nombre,
               COALESCE(SUM(e.cantidad_kg), 0) AS kg,
               COUNT(e.lote_id)::int AS lotes
        FROM centro c
        LEFT JOIN existencia e ON e.centro_id = c.id AND e.cantidad_kg > 0
        WHERE c.activo
        GROUP BY c.id
        ORDER BY kg DESC, c.codigo`,

      // Existencia actual por estado del producto (uva, pergamino, oro).
      this.prisma.$queryRaw<{ producto: string; kg: Decimal }[]>`
        SELECT l.estado_producto AS producto, SUM(e.cantidad_kg) AS kg
        FROM existencia e
        JOIN lote l ON l.id = e.lote_id
        WHERE e.cantidad_kg > 0
        GROUP BY l.estado_producto`,

      // Cuántos lotes hay en cada estado (GROUP BY estado).
      this.prisma.lote.groupBy({ by: ['estado'], _count: { _all: true } }),

      // Recepciones de los últimos días, agrupadas por día local.
      this.prisma.$queryRaw<{ dia: string; recepciones: number; kg: Decimal }[]>`
        SELECT to_char(capturado_en - interval '6 hours', 'YYYY-MM-DD') AS dia,
               COUNT(*)::int AS recepciones,
               SUM(peso_neto_kg) AS kg
        FROM recepcion
        WHERE capturado_en >= ${desde}
        GROUP BY 1`,

      this.prisma.recepcion.aggregate({
        where: { capturadoEn: { gte: inicioHoy } },
        _count: { _all: true },
        _sum: { pesoNetoKg: true },
      }),

      this.prisma.productor.count({ where: { activo: true } }),

      this.prisma.proceso.aggregate({
        where: { realizadoEn: { gte: hace30 } },
        _count: { _all: true },
        _sum: { mermaKg: true },
      }),

      this.prisma.recepcion.findMany({
        orderBy: { capturadoEn: 'desc' },
        take: 5,
        select: {
          id: true,
          capturadoEn: true,
          estadoProducto: true,
          pesoNetoKg: true,
          productor: { select: { nombre: true } },
          centro: { select: { codigo: true } },
        },
      }),

      this.prisma.lote.findMany({
        orderBy: { creadoEn: 'desc' },
        take: 5,
        select: {
          id: true,
          codigo: true,
          estado: true,
          estadoProducto: true,
          pesoInicialKg: true,
          creadoEn: true,
          centro: { select: { codigo: true } },
        },
      }),
    ]);

    // La consulta solo devuelve los días que tuvieron recepciones; para la gráfica se
    // completan los días vacíos con 0 y así se ven todos los días seguidos.
    const porDiaMapa = new Map(porDia.map((d) => [d.dia, d]));
    const recepcionesPorDia = Array.from({ length: DIAS }, (_, i) => {
      const dia = diaLocal(new Date(desde.getTime() + i * DIA));
      const fila = porDiaMapa.get(dia);
      return { dia, recepciones: fila?.recepciones ?? 0, kg: fila?.kg ?? new Prisma.Decimal(0) };
    });

    // Todos los estados, aunque tengan 0 lotes, en el orden de la máquina de estados.
    const conteo = new Map(porEstado.map((e) => [e.estado, e._count._all]));
    const lotesPorEstado = Object.values(EstadoLote).map((estado) => ({ estado, lotes: conteo.get(estado) ?? 0 }));

    const existenciaKg = porCentro.reduce((suma, c) => suma.plus(c.kg), new Prisma.Decimal(0));

    return {
      generadoEn: ahora,
      indicadores: {
        existenciaKg,
        lotesActivos: conteo.get(EstadoLote.ACTIVO) ?? 0,
        recepcionesHoy: recepcionesHoy._count._all,
        kgRecibidosHoy: recepcionesHoy._sum.pesoNetoKg ?? new Prisma.Decimal(0),
        productoresActivos,
        procesos30Dias: procesos30._count._all,
        merma30DiasKg: procesos30._sum.mermaKg ?? new Prisma.Decimal(0),
      },
      existenciaPorCentro: porCentro,
      existenciaPorProducto: porProducto,
      lotesPorEstado,
      recepcionesPorDia,
      ultimasRecepciones,
      ultimosLotes,
    };
  }
}
