import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoLiquidacion, Prisma } from '@prisma/client';
import { paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CalcularLiquidacionDto, ListarLiquidacionesDto } from './dto/liquidaciones.dto';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
type Cliente = PrismaService | Prisma.TransactionClient;

// Ciclo de vida: BORRADOR → APROBADA → PAGADA. BORRADOR y APROBADA se pueden ANULAR
// (las recepciones vuelven a quedar disponibles); una liquidación PAGADA ya no cambia.
const ANULABLES: EstadoLiquidacion[] = ['BORRADOR', 'APROBADA'];

const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  estado: true,
  periodoInicio: true,
  periodoFin: true,
  totalKg: true,
  totalMonto: true,
  moneda: true,
  creadoEn: true,
  aprobadoEn: true,
  pagadoEn: true,
  productor: { select: { id: true, codigo: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  aprobadoPor: { select: { id: true, nombre: true } },
  _count: { select: { detalles: true } },
} satisfies Prisma.LiquidacionSelect;

// Una línea calculada: la recepción con su precio, o el motivo por el que no se puede pagar.
export interface LineaCalculada {
  recepcionId: string;
  capturadoEn: Date;
  estadoProducto: string;
  finca: string;
  centro: string;
  grado: { id: string; nombre: string } | null;
  pesoKg: Decimal;
  precioPorKg: Decimal | null;
  subtotal: Decimal | null;
  problema: string | null;
}

// Fechas "YYYY-MM-DD" como día completo en hora de Guatemala (UTC-6, sin horario de verano).
const inicioDia = (fecha: string) => new Date(`${fecha.slice(0, 10)}T00:00:00-06:00`);
const finDia = (fecha: string) => new Date(inicioDia(fecha).getTime() + 24 * 60 * 60 * 1000);

@Injectable()
export class LiquidacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarLiquidacionesDto) {
    const where: Prisma.LiquidacionWhereInput = { estado: filtros.estado, productorId: filtros.productorId };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.liquidacion.findMany({ where, select: CAMPOS_LISTA, orderBy: { creadoEn: 'desc' }, ...paginar(filtros) }),
      this.prisma.liquidacion.count({ where }),
    ]);
    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const liquidacion = await this.prisma.liquidacion.findUnique({
      where: { id },
      select: {
        ...CAMPOS_LISTA,
        detalles: {
          orderBy: { recepcion: { capturadoEn: 'asc' } },
          select: {
            pesoKg: true,
            precioPorKg: true,
            subtotal: true,
            recepcion: {
              select: {
                id: true,
                capturadoEn: true,
                estadoProducto: true,
                finca: { select: { nombre: true } },
                centro: { select: { codigo: true } },
              },
            },
          },
        },
      },
    });
    if (!liquidacion) throw new NotFoundException('Liquidación no encontrada');
    return liquidacion;
  }

  // Vista previa (no guarda nada): qué recepciones del período faltan por liquidar,
  // con su precio vigente y subtotal, y cuáles no se pueden pagar todavía y por qué.
  async calcular(dto: CalcularLiquidacionDto, cliente: Cliente = this.prisma) {
    const desde = inicioDia(dto.periodoInicio);
    const hasta = finDia(dto.periodoFin);
    if (hasta <= desde) throw new BadRequestException('El período termina antes de empezar');

    const productor = await cliente.productor.findUnique({ where: { id: dto.productorId }, select: { id: true, codigo: true, nombre: true } });
    if (!productor) throw new NotFoundException('Productor no encontrado');

    // Recepciones del período que no están en ninguna liquidación vigente
    // (al anular una liquidación se borran sus detalles: la recepción queda libre).
    const recepciones = await cliente.recepcion.findMany({
      where: { productorId: dto.productorId, capturadoEn: { gte: desde, lt: hasta }, liquidacion: { is: null } },
      orderBy: { capturadoEn: 'asc' },
      select: {
        id: true,
        capturadoEn: true,
        estadoProducto: true,
        pesoNetoKg: true,
        finca: { select: { nombre: true } },
        centro: { select: { codigo: true } },
        // Grado de la última inspección de calidad (módulo de calidad).
        inspecciones: {
          where: { gradoCalidadId: { not: null } },
          orderBy: { inspeccionadoEn: 'desc' },
          take: 1,
          select: { gradoCalidad: { select: { id: true, nombre: true } } },
        },
      },
    });

    // Todos los precios del producto que pudieron estar vigentes en el período, en una
    // sola consulta; la búsqueda por recepción se hace en memoria (sin N+1).
    const precios = await cliente.precio.findMany({
      where: {
        estadoProducto: { in: [...new Set(recepciones.map((r) => r.estadoProducto))] },
        vigenteDesde: { lt: hasta },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: desde } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });

    const lineas: LineaCalculada[] = recepciones.map((r) => {
      const grado = r.inspecciones[0]?.gradoCalidad ?? null;
      const vigentes = precios.filter(
        (p) =>
          p.estadoProducto === r.estadoProducto &&
          p.vigenteDesde <= r.capturadoEn &&
          (!p.vigenteHasta || p.vigenteHasta > r.capturadoEn),
      );
      // Primero el precio del grado exacto; si no hay, el precio general del producto (sin grado).
      const precio =
        (grado && vigentes.find((p) => p.gradoCalidadId === grado.id)) || vigentes.find((p) => p.gradoCalidadId === null);

      let problema: string | null = null;
      if (!precio) {
        problema = grado
          ? `No hay precio vigente para ${r.estadoProducto} grado ${grado.nombre}`
          : vigentes.length > 0
            ? `${r.estadoProducto} se paga por grado: falta la inspección de calidad`
            : `No hay precio vigente para ${r.estadoProducto}`;
      }
      return {
        recepcionId: r.id,
        capturadoEn: r.capturadoEn,
        estadoProducto: r.estadoProducto,
        finca: r.finca.nombre,
        centro: r.centro.codigo,
        grado,
        pesoKg: r.pesoNetoKg,
        precioPorKg: precio?.precioPorKg ?? null,
        // Decimal: kg × precio sin errores de redondeo; se redondea a centavos.
        subtotal: precio ? r.pesoNetoKg.times(precio.precioPorKg).toDecimalPlaces(2) : null,
        problema,
      };
    });

    const pagables = lineas.filter((l) => !l.problema);
    return {
      productor,
      periodoInicio: dto.periodoInicio.slice(0, 10),
      periodoFin: dto.periodoFin.slice(0, 10),
      lineas,
      totalKg: pagables.reduce((s, l) => s.plus(l.pesoKg), new Decimal(0)),
      totalMonto: pagables.reduce((s, l) => s.plus(l.subtotal!), new Decimal(0)),
      sinPrecio: lineas.length - pagables.length,
    };
  }

  // Crea el BORRADOR con las recepciones que tienen precio. Las que no, quedan pendientes
  // para otra liquidación (cuando tengan inspección o precio).
  async crear(dto: CalcularLiquidacionDto, usuarioId: string) {
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          // Un candado por productor: dos personas liquidando al mismo productor a la vez
          // esperan su turno y la segunda ya no ve las recepciones de la primera.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`liquidacion:${dto.productorId}`}))`;
          const calculo = await this.calcular(dto, tx);
          const lineas = calculo.lineas.filter((l) => !l.problema);
          if (lineas.length === 0) {
            throw new BadRequestException(
              calculo.lineas.length === 0
                ? 'El productor no tiene recepciones pendientes de liquidar en ese período'
                : 'Ninguna recepción del período tiene precio: revisa las inspecciones de calidad o los precios',
            );
          }

          const anio = new Date().getFullYear();
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('liquidacion_codigo'))`;
          const ultimo = await tx.liquidacion.findFirst({
            where: { codigo: { startsWith: `LQ-${anio}-` } },
            orderBy: { codigo: 'desc' },
            select: { codigo: true },
          });
          const codigo = `LQ-${anio}-${String(ultimo ? Number(ultimo.codigo.split('-')[2]) + 1 : 1).padStart(4, '0')}`;

          const liquidacion = await tx.liquidacion.create({
            data: {
              codigo,
              productorId: dto.productorId,
              periodoInicio: new Date(`${calculo.periodoInicio}T00:00:00Z`),
              periodoFin: new Date(`${calculo.periodoFin}T00:00:00Z`),
              totalKg: calculo.totalKg,
              totalMonto: calculo.totalMonto,
              creadoPorId: usuarioId,
              detalles: {
                create: lineas.map((l) => ({
                  recepcionId: l.recepcionId,
                  pesoKg: l.pesoKg,
                  precioPorKg: l.precioPorKg!,
                  subtotal: l.subtotal!,
                })),
              },
            },
          });

          // Tarea para que un supervisor la apruebe.
          await tx.tarea.create({
            data: {
              tipo: 'APROBAR_LIQUIDACION',
              titulo: `Aprobar liquidación ${codigo} de ${calculo.productor.nombre}`,
              rol: 'SUPERVISOR',
              entidadTipo: 'liquidacion',
              entidadId: liquidacion.id,
            },
          });
          return liquidacion.id;
        },
        { timeout: 15_000 },
      );
      return this.obtener(id);
    } catch (error) {
      // P2002: una recepción ya está en otra liquidación (UNIQUE recepcion_id), la última barrera.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Una de las recepciones ya fue liquidada por otra persona; vuelve a calcular');
      }
      throw error;
    }
  }

  // Segregación de funciones: quien crea la liquidación no puede aprobarla.
  async aprobar(id: string, usuarioId: string) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.bloquear(tx, id);
      if (actual.estado !== 'BORRADOR') throw new ConflictException(`Solo se aprueba un BORRADOR (estado: ${actual.estado})`);
      if (actual.creadoPorId === usuarioId) {
        throw new ForbiddenException('Quien creó la liquidación no puede aprobarla: debe hacerlo otra persona');
      }
      await tx.liquidacion.update({ where: { id }, data: { estado: 'APROBADA', aprobadoPorId: usuarioId, aprobadoEn: new Date() } });
      await this.cerrarTareas(tx, id, 'COMPLETADA');
    });
    return this.obtener(id);
  }

  async pagar(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.bloquear(tx, id);
      if (actual.estado !== 'APROBADA') throw new ConflictException(`Solo se paga una liquidación APROBADA (estado: ${actual.estado})`);
      await tx.liquidacion.update({ where: { id }, data: { estado: 'PAGADA', pagadoEn: new Date() } });
    });
    return this.obtener(id);
  }

  // Anular libera las recepciones (se borran los detalles) pero conserva la cabecera con
  // sus totales originales, para que quede constancia de lo que se había calculado.
  // Quién y cuándo la anuló queda en la auditoría (interceptor global).
  async anular(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.bloquear(tx, id);
      if (!ANULABLES.includes(actual.estado)) {
        throw new ConflictException(`Una liquidación ${actual.estado} no se puede anular`);
      }
      await tx.liquidacionDetalle.deleteMany({ where: { liquidacionId: id } });
      await tx.liquidacion.update({ where: { id }, data: { estado: 'ANULADA' } });
      await this.cerrarTareas(tx, id, 'CANCELADA');
    });
    return this.obtener(id);
  }

  private async bloquear(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM liquidacion WHERE id = ${id} FOR UPDATE`;
    const actual = await tx.liquidacion.findUnique({ where: { id }, select: { estado: true, creadoPorId: true } });
    if (!actual) throw new NotFoundException('Liquidación no encontrada');
    return actual;
  }

  private cerrarTareas(tx: Prisma.TransactionClient, id: string, estado: 'COMPLETADA' | 'CANCELADA') {
    return tx.tarea.updateMany({
      where: { tipo: 'APROBAR_LIQUIDACION', entidadTipo: 'liquidacion', entidadId: id, estado: 'PENDIENTE' },
      data: { estado, completadaEn: new Date() },
    });
  }
}
