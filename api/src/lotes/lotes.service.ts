import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLote, Prisma } from '@prisma/client';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { QrEmitido } from '../recepciones/recepciones.service';
import { TokensService } from '../tokens/tokens.service';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { ListarLotesDto } from './dto/listar-lotes.dto';
import { RecepcionesDisponiblesDto } from './dto/recepciones-disponibles.dto';
import { puedeTransicionar } from './transiciones';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Una arista del grafo de lotes, como la devuelven las consultas WITH RECURSIVE.
interface FilaGrafo {
  padre_id: string;
  hijo_id: string;
  tipo: string;
  cantidad_kg: Decimal;
  nivel: number;
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) { }

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
      const { loteId, qr } = await this.prisma.$transaction(
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

          // 4. Código legible y correlativo por año: L-2026-00001 (ver siguienteCodigo).
          const cosecha = dto.cosecha ?? new Date().getFullYear();
          const codigo = await this.siguienteCodigo(tx, cosecha);

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

          // 7. QR del lote (TokensService de Victor), dentro de la misma transacción.
          //    El QR solo lleva un valor aleatorio: ningún dato del lote ni del productor.
          //    En la base se guarda solo su hash, por eso el valor se devuelve ahora
          //    (para imprimir la etiqueta) y no se puede volver a consultar.
          const token = await this.tokens.crear(
            { proposito: 'QR_LOTE', entidadTipo: 'lote', entidadId: lote.id, creadoPorId: usuarioId },
            tx,
          );
          const qr: QrEmitido = { valor: token.valor, url: this.tokens.urlQr(token.valor) };

          return { loteId: lote.id, qr };
        },
        { timeout: 15_000 },
      );

      return { ...(await this.obtener(loteId)), qr };
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

      // Un lote anulado no debe poder identificarse con su etiqueta: se revoca su QR.
      await this.tokens.revocarPorEntidad('lote', id, 'QR_LOTE', tx);
    });

    return this.obtener(id);
  }

  // Kárdex del lote: su libro de inventario completo (solo se inserta, nunca se edita).
  // Cada movimiento trae el saldo que quedó en ese centro después de aplicarlo.
  async movimientos(id: string) {
    const lote = await this.prisma.lote.findUnique({ where: { id }, select: { id: true } });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    // Los movimientos de una misma transacción comparten la hora (now() es la hora de
    // inicio de la transacción); entre ellos, el saldo creciente da el orden real.
    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: { loteId: id },
      orderBy: [{ creadoEn: 'asc' }, { saldoKg: 'asc' }],
      select: {
        id: true,
        tipo: true,
        cantidadKg: true,
        saldoKg: true,
        referenciaTipo: true,
        referenciaId: true,
        motivo: true,
        creadoEn: true,
        centro: { select: { codigo: true } },
        usuario: { select: { nombre: true } },
      },
    });

    // La referencia es un id suelto (puede ser de una recepción o de un proceso):
    // se traduce a algo legible con una consulta por tipo, no una por movimiento.
    const ids = (tipo: string) => movimientos.filter((m) => m.referenciaTipo === tipo).map((m) => m.referenciaId!);
    const [recepciones, procesos] = await Promise.all([
      this.prisma.recepcion.findMany({
        where: { id: { in: ids('RECEPCION') } },
        select: { id: true, productor: { select: { nombre: true } } },
      }),
      this.prisma.proceso.findMany({ where: { id: { in: ids('PROCESO') } }, select: { id: true, codigo: true, tipo: true } }),
    ]);
    const nombres = new Map<string, string>([
      ...recepciones.map((r) => [r.id, `Recepción de ${r.productor.nombre}`] as [string, string]),
      ...procesos.map((p) => [p.id, `Proceso ${p.codigo} (${p.tipo})`] as [string, string]),
    ]);
    const legible = (m: (typeof movimientos)[number]) => {
      if (m.referenciaTipo === 'ANULACION') return 'Anulación del lote';
      return m.referenciaId ? (nombres.get(m.referenciaId) ?? m.referenciaTipo) : null;
    };

    return movimientos.map((m) => ({ ...m, referencia: legible(m) }));
  }

  // Para reimprimir la etiqueta: el valor del QR solo existe al crearlo (en la base
  // queda su hash), así que se revoca el anterior y se emite uno nuevo. Mismo
  // criterio que el comprobante de recepciones.
  async regenerarQr(id: string, usuarioId: string): Promise<QrEmitido> {
    const lote = await this.prisma.lote.findUnique({ where: { id }, select: { estado: true } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (lote.estado === EstadoLote.ANULADO) {
      throw new ConflictException('Un lote anulado no tiene etiqueta');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.tokens.revocarPorEntidad('lote', id, 'QR_LOTE', tx);
      const token = await this.tokens.crear(
        { proposito: 'QR_LOTE', entidadTipo: 'lote', entidadId: id, creadoPorId: usuarioId },
        tx,
      );
      return { valor: token.valor, url: this.tokens.urlQr(token.valor) };
    });
  }

  // Código legible y correlativo por año (L-2026-00001). Lo usan también los procesos
  // para sus lotes hijo. El candado de transacción (advisory lock) evita que dos lotes
  // creados al mismo tiempo calculen el mismo número; se libera solo al hacer COMMIT.
  async siguienteCodigo(tx: Prisma.TransactionClient, cosecha: number): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('lote_codigo'))`;
    const ultimo = await tx.lote.findFirst({
      where: { codigo: { startsWith: `L-${cosecha}-` } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const siguiente = ultimo ? Number(ultimo.codigo.split('-')[2]) + 1 : 1;
    return `L-${cosecha}-${String(siguiente).padStart(5, '0')}`;
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

  // Trazabilidad del lote: hacia atrás (de dónde viene) y hacia adelante (en qué se convirtió).
  async trazabilidad(id: string) {
    // 1. Lote de partida
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        estadoProducto: true,
        pesoInicialKg: true,
        centro: { select: { codigo: true, nombre: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    // 2. Hacia atrás: padres, abuelos, bisabuelos... (WITH RECURSIVE)
    const ancestros = await this.prisma.$queryRaw<FilaGrafo[]>`
      WITH RECURSIVE ancestros AS (
        -- Punto de partida: los padres directos del lote
        SELECT padre_id, hijo_id, tipo, cantidad_kg, 1 AS nivel
        FROM lote_relacion
        WHERE hijo_id = ${id}

        UNION ALL

        -- Paso que se repite: los padres de los padres ya encontrados
        SELECT r.padre_id, r.hijo_id, r.tipo, r.cantidad_kg, a.nivel + 1
        FROM lote_relacion r
        JOIN ancestros a ON r.hijo_id = a.padre_id
        WHERE a.nivel < 50 -- red de seguridad contra ciclos
      )
      SELECT * FROM ancestros
    `;

    // 3. Hacia adelante: hijos, nietos... (WITH RECURSIVE)
    const descendientes = await this.prisma.$queryRaw<FilaGrafo[]>`
      WITH RECURSIVE descendientes AS (
        -- Punto de partida: los hijos directos del lote
        SELECT padre_id, hijo_id, tipo, cantidad_kg, 1 AS nivel
        FROM lote_relacion
        WHERE padre_id = ${id}

        UNION ALL

        -- Paso que se repite: los hijos de los hijos ya encontrados
        SELECT r.padre_id, r.hijo_id, r.tipo, r.cantidad_kg, d.nivel + 1
        FROM lote_relacion r
        JOIN descendientes d ON r.padre_id = d.hijo_id
        WHERE d.nivel < 50 -- red de seguridad contra ciclos
      )
      SELECT * FROM descendientes
    `;

    // 4. (lo completamos juntos después)
        // 4. Ids de todo el árbol: hacia atrás (el lote + sus ancestros) y hacia adelante.
    const idsAtras = [id, ...ancestros.map((a) => a.padre_id)];
    const idsAdelante = [id, ...descendientes.map((d) => d.hijo_id)];

    // Códigos legibles de todos los lotes del grafo.
    const codigos = new Map(
      (
        await this.prisma.lote.findMany({
          where: { id: { in: [...idsAtras, ...idsAdelante] } },
          select: { id: true, codigo: true },
        })
      ).map((l) => [l.id, l.codigo]),
    );

    // Recepciones de origen del lote y de sus ancestros.
    const recepciones = await this.prisma.loteOrigenRecepcion.findMany({
      where: { loteId: { in: idsAtras } },
      select: {
        cantidadKg: true,
        lote: {
          select: { codigo: true },
        },
        recepcion: {
          select: {
            id: true,
            capturadoEn: true,
            productor: {
              select: { codigo: true, nombre: true },
            },
            finca: {
              select: { nombre: true },
            },
          },
        },
      },
    });

    // Ventas del lote y de sus descendientes.
    const ventas = await this.prisma.venta.findMany({
      where: { loteId: { in: idsAdelante } },
      select: {
        id: true,
        cantidadKg: true,
        vendidoEn: true,
        destino: true,
        lote: {
          select: { codigo: true },
        },
        comprador: {
          select: {
            id: true,
            nombre: true,
            pais: true,
          },
        },
      },
    });

    // Une cada arista del grafo con los códigos legibles de padre e hijo.
    const conCodigos = (filas: FilaGrafo[]) =>
      filas.map((f) => ({
        nivel: f.nivel,
        tipo: f.tipo,
        cantidadKg: f.cantidad_kg,
        padre: { id: f.padre_id, codigo: codigos.get(f.padre_id) },
        hijo: { id: f.hijo_id, codigo: codigos.get(f.hijo_id) },
      }));

    return {
      lote,
      haciaAtras: { lotes: conCodigos(ancestros), recepciones },
      haciaAdelante: { lotes: conCodigos(descendientes), ventas },
    };
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
