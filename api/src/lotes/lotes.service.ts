import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLote, Prisma } from '@prisma/client';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { ListarLotesDto } from './dto/listar-lotes.dto';
import { RecepcionesDisponiblesDto } from './dto/recepciones-disponibles.dto';
import { puedeTransicionar } from './transiciones';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  estado: true,
  estadoProducto: true,
  pesoInicialKg: true,
  cosecha: true,
  creadoEn: true,
  centro: { select: { id: true, codigo: true, nombre: true } },
  gradoCalidad: { select: { id: true, codigo: true, nombre: true } },
  // Dónde está hoy el lote y cuánto queda (solo centros con saldo).
  existencias: {
    where: { cantidadKg: { gt: 0 } },
    select: { cantidadKg: true, centro: { select: { id: true, codigo: true, nombre: true } } },
  },
} satisfies Prisma.LoteSelect;

type LoteLista = Prisma.LoteGetPayload<{ select: typeof CAMPOS_LISTA }>;

// Un lote "consume" kg de una recepción solo si no está ANULADO:
// al anular un lote, sus recepciones quedan disponibles otra vez.
const ORIGEN_VIGENTE = { lote: { estado: { not: EstadoLote.ANULADO } } } satisfies Prisma.LoteOrigenRecepcionWhereInput;

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarLotesDto): Promise<Paginado<LoteLista>> {
    const where: Prisma.LoteWhereInput = {
      estado: filtros.estado,
      estadoProducto: filtros.estadoProducto,
      gradoCalidadId: filtros.gradoCalidadId,
      cosecha: filtros.cosecha,
      ...(filtros.buscar && { codigo: { contains: filtros.buscar, mode: 'insensitive' } }),
      ...(filtros.centroId && {
        existencias: { some: { centroId: filtros.centroId, cantidadKg: { gt: 0 } } },
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.lote.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { creadoEn: 'desc' },
        ...paginar(filtros),
      }),
      this.prisma.lote.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  // Detalle completo: origen (recepciones y lotes padre), destino (lotes hijo),
  // existencias e historial de estados. Es la base de la trazabilidad.
  async obtener(id: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: {
        centro: { select: { id: true, codigo: true, nombre: true } },
        gradoCalidad: { select: { id: true, codigo: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true } },
        recepciones: {
          select: {
            cantidadKg: true,
            recepcion: {
              select: {
                id: true,
                capturadoEn: true,
                estadoProducto: true,
                pesoNetoKg: true,
                productor: { select: { id: true, codigo: true, nombre: true } },
                finca: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        padres: { select: { tipo: true, cantidadKg: true, padre: { select: { id: true, codigo: true } } } },
        hijos: { select: { tipo: true, cantidadKg: true, hijo: { select: { id: true, codigo: true } } } },
        existencias: {
          select: { cantidadKg: true, centro: { select: { id: true, codigo: true, nombre: true } } },
        },
        historialEstados: {
          orderBy: { creadoEn: 'asc' },
          select: {
            estadoAnterior: true,
            estadoNuevo: true,
            motivo: true,
            creadoEn: true,
            usuario: { select: { id: true, nombre: true } },
          },
        },
        _count: { select: { inspecciones: true, movimientos: true, traslados: true, ventas: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    return lote;
  }

  // Recepciones del centro con kg todavía sin asignar a un lote vigente.
  async recepcionesDisponibles(filtros: RecepcionesDisponiblesDto) {
    const recepciones = await this.prisma.recepcion.findMany({
      where: { centroId: filtros.centroId, estadoProducto: filtros.estadoProducto },
      orderBy: { capturadoEn: 'asc' },
      take: 200,
      select: {
        id: true,
        capturadoEn: true,
        estadoProducto: true,
        pesoNetoKg: true,
        productor: { select: { id: true, codigo: true, nombre: true } },
        finca: { select: { id: true, nombre: true } },
        lotes: { where: ORIGEN_VIGENTE, select: { cantidadKg: true } },
      },
    });

    return recepciones
      .map(({ lotes, ...recepcion }) => {
        const asignadoKg = lotes.reduce((suma, o) => suma.plus(o.cantidadKg), new Decimal(0));
        return { ...recepcion, asignadoKg, disponibleKg: recepcion.pesoNetoKg.minus(asignadoKg) };
      })
      .filter((r) => r.disponibleKg.gt(0));
  }

  // Crea un lote a partir de recepciones. Todo ocurre en UNA transacción:
  // si cualquier paso falla, PostgreSQL deshace todos (ROLLBACK) y no queda nada a medias.
  async crear(dto: CrearLoteDto, usuarioId: string) {
    const ids = dto.recepciones.map((r) => r.recepcionId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Una recepción aparece más de una vez en el lote');
    }

    try {
      const loteId = await this.prisma.$transaction(
        async (tx) => {
          // 1. Bloquear las recepciones (SELECT ... FOR UPDATE): si otro usuario intenta
          //    usarlas al mismo tiempo, espera a que esta transacción termine. Así nadie
          //    asigna los mismos kg dos veces (condición de carrera).
          await tx.$queryRaw`SELECT id FROM recepcion WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;

          // 2. Validar el centro y las recepciones.
          const centro = await tx.centro.findUnique({ where: { id: dto.centroId } });
          if (!centro || !centro.activo) {
            throw new BadRequestException('El centro no existe o está inactivo');
          }

          const recepciones = await tx.recepcion.findMany({ where: { id: { in: ids } } });
          const porId = new Map(recepciones.map((r) => [r.id, r]));
          const faltantes = ids.filter((id) => !porId.has(id));
          if (faltantes.length) {
            throw new NotFoundException(`Recepciones no encontradas: ${faltantes.join(', ')}`);
          }

          // El producto debe estar físicamente en el centro donde se arma el lote.
          const deOtroCentro = recepciones.find((r) => r.centroId !== dto.centroId);
          if (deOtroCentro) {
            throw new BadRequestException(`La recepción ${deOtroCentro.id} es de otro centro de acopio`);
          }

          // No se mezcla cardamomo en uva con pergamino u oro.
          const estados = new Set(recepciones.map((r) => r.estadoProducto));
          if (estados.size > 1) {
            throw new BadRequestException(
              'Las recepciones tienen distinto estado de producto (uva, pergamino u oro)',
            );
          }
          const [estadoProducto] = estados;
          if (dto.estadoProducto && dto.estadoProducto !== estadoProducto) {
            throw new BadRequestException(`Las recepciones son de producto ${estadoProducto}, no ${dto.estadoProducto}`);
          }

          // 3. Calcular cuánto queda disponible en cada recepción (neto − ya asignado).
          const asignados = await tx.loteOrigenRecepcion.groupBy({
            by: ['recepcionId'],
            where: { recepcionId: { in: ids }, ...ORIGEN_VIGENTE },
            _sum: { cantidadKg: true },
          });
          const asignadoPorId = new Map(asignados.map((a) => [a.recepcionId, a._sum.cantidadKg ?? new Decimal(0)]));

          // Decimal (no number): los kg se suman sin errores de punto flotante.
          let totalKg = new Decimal(0);
          const origenes: { recepcionId: string; cantidadKg: Decimal }[] = [];
          for (const item of dto.recepciones) {
            const recepcion = porId.get(item.recepcionId)!;
            const disponible = recepcion.pesoNetoKg.minus(asignadoPorId.get(item.recepcionId) ?? 0);
            if (disponible.lte(0)) {
              throw new ConflictException(`La recepción ${item.recepcionId} ya fue asignada completamente a otro lote`);
            }
            const cantidad = item.cantidadKg !== undefined ? new Decimal(item.cantidadKg) : disponible;
            if (cantidad.gt(disponible)) {
              throw new BadRequestException(
                `La recepción ${item.recepcionId} solo tiene ${disponible.toFixed(2)} kg disponibles`,
              );
            }
            totalKg = totalKg.plus(cantidad);
            origenes.push({ recepcionId: item.recepcionId, cantidadKg: cantidad });
          }

          // 4. Código legible y correlativo por año: L-2026-00001.
          //    El candado de transacción (advisory lock) evita que dos lotes creados al
          //    mismo tiempo calculen el mismo número. Se libera solo al hacer COMMIT.
          const cosecha = dto.cosecha ?? new Date().getFullYear();
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('lote_codigo'))`;
          const ultimo = await tx.lote.findFirst({
            where: { codigo: { startsWith: `L-${cosecha}-` } },
            orderBy: { codigo: 'desc' },
            select: { codigo: true },
          });
          const siguiente = ultimo ? Number(ultimo.codigo.split('-')[2]) + 1 : 1;
          const codigo = `L-${cosecha}-${String(siguiente).padStart(5, '0')}`;

          // 5. Crear el lote con su origen, su existencia inicial y su primer estado.
          //    Prisma traduce los "create" anidados a varios INSERT dentro de la misma transacción.
          const lote = await tx.lote.create({
            data: {
              codigo,
              centroId: dto.centroId,
              estadoProducto,
              gradoCalidadId: dto.gradoCalidadId,
              pesoInicialKg: totalKg,
              cosecha,
              observaciones: dto.observaciones,
              creadoPorId: usuarioId,
              recepciones: { create: origenes },
              existencias: { create: { centroId: dto.centroId, cantidadKg: totalKg } },
              historialEstados: {
                create: { estadoAnterior: null, estadoNuevo: EstadoLote.ACTIVO, motivo: 'Creación del lote', usuarioId },
              },
            },
          });

          // 6. Libro de inventario: una entrada por recepción, con el saldo acumulado.
          let saldo = new Decimal(0);
          for (const origen of origenes) {
            saldo = saldo.plus(origen.cantidadKg);
            await tx.movimientoInventario.create({
              data: {
                loteId: lote.id,
                centroId: dto.centroId,
                tipo: 'ENTRADA_RECEPCION',
                cantidadKg: origen.cantidadKg,
                saldoKg: saldo,
                referenciaTipo: 'RECEPCION',
                referenciaId: origen.recepcionId,
                usuarioId,
              },
            });
          }

          // TODO(QR): cuando exista el TokensService de Victor, crear aquí el token
          // QR_LOTE (entidadTipo 'LOTE', entidadId lote.id, sin expiración).

          return lote.id;
        },
        { timeout: 15_000 },
      );

      return this.obtener(loteId);
    } catch (error) {
      this.traducirError(error);
    }
  }

  // Anula un lote recién creado por error. Solo si no tuvo movimientos posteriores:
  // si ya se procesó, trasladó o vendió, anularlo rompería la trazabilidad.
  async anular(id: string, motivo: string, usuarioId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lote WHERE id = ${id} FOR UPDATE`;
      const lote = await tx.lote.findUnique({
        where: { id },
        include: { _count: { select: { hijos: true, traslados: true, ventas: true } } },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      if (lote.estado !== EstadoLote.ACTIVO) {
        throw new ConflictException(`Solo se puede anular un lote ACTIVO (estado actual: ${lote.estado})`);
      }
      const { hijos, traslados, ventas } = lote._count;
      if (hijos + traslados + ventas > 0) {
        throw new ConflictException('El lote ya tiene procesos, traslados o ventas: no se puede anular');
      }

      // Sacar del inventario lo que quede, dejando el ajuste registrado.
      const existencias = await tx.existencia.findMany({ where: { loteId: id, cantidadKg: { gt: 0 } } });
      for (const existencia of existencias) {
        await tx.movimientoInventario.create({
          data: {
            loteId: id,
            centroId: existencia.centroId,
            tipo: 'AJUSTE',
            cantidadKg: existencia.cantidadKg.negated(),
            saldoKg: 0,
            referenciaTipo: 'ANULACION',
            referenciaId: id,
            motivo,
            usuarioId,
          },
        });
        await tx.existencia.update({
          where: { loteId_centroId: { loteId: id, centroId: existencia.centroId } },
          data: { cantidadKg: 0 },
        });
      }

      await this.cambiarEstado(tx, id, EstadoLote.ANULADO, usuarioId, motivo);
    });

    return this.obtener(id);
  }

  // Cambia el estado validando la máquina de estados y deja el registro en el historial.
  // Pensado para que lo usen también traslados, procesos, inventario y ventas, dentro
  // de SU transacción (por eso recibe "tx" y no usa this.prisma).
  async cambiarEstado(
    tx: Prisma.TransactionClient,
    loteId: string,
    hacia: EstadoLote,
    usuarioId: string,
    motivo?: string,
  ) {
    const lote = await tx.lote.findUnique({ where: { id: loteId }, select: { estado: true } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (!puedeTransicionar(lote.estado, hacia)) {
      throw new ConflictException(`Un lote ${lote.estado} no puede pasar a ${hacia}`);
    }

    await tx.lote.update({ where: { id: loteId }, data: { estado: hacia } });
    await tx.loteEstadoHistorial.create({
      data: { loteId, estadoAnterior: lote.estado, estadoNuevo: hacia, motivo, usuarioId },
    });
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: llave foránea inválida (gradoCalidadId que no existe).
      if (error.code === 'P2003') {
        throw new BadRequestException('El grado de calidad indicado no existe');
      }
      // P2002: código repetido (no debería ocurrir gracias al advisory lock).
      if (error.code === 'P2002') {
        throw new ConflictException('Conflicto al generar el código del lote, intenta de nuevo');
      }
    }
    throw error;
  }
}
