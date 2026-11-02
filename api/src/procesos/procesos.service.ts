import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoLote, Prisma } from '@prisma/client';
import { paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { LotesService } from '../lotes/lotes.service';
import { QrEmitido } from '../recepciones/recepciones.service';
import { TokensService } from '../tokens/tokens.service';
import { CrearProcesoDto } from './dto/crear-proceso.dto';
import { ListarProcesosDto } from './dto/listar-procesos.dto';
import { REGLAS, tipoRelacion, validarForma } from './reglas';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  tipo: true,
  mermaKg: true,
  realizadoEn: true,
  centro: { select: { id: true, codigo: true, nombre: true } },
  realizadoPor: { select: { id: true, nombre: true } },
  relaciones: {
    select: {
      tipo: true,
      cantidadKg: true,
      padre: { select: { id: true, codigo: true } },
      hijo: { select: { id: true, codigo: true } },
    },
  },
} satisfies Prisma.ProcesoSelect;

@Injectable()
export class ProcesosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lotes: LotesService,
    private readonly tokens: TokensService,
  ) {}

  async listar(filtros: ListarProcesosDto) {
    const where: Prisma.ProcesoWhereInput = {
      tipo: filtros.tipo,
      centroId: filtros.centroId,
      ...(filtros.loteId && {
        relaciones: { some: { OR: [{ padreId: filtros.loteId }, { hijoId: filtros.loteId }] } },
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.proceso.findMany({ where, select: CAMPOS_LISTA, orderBy: { realizadoEn: 'desc' }, ...paginar(filtros) }),
      this.prisma.proceso.count({ where }),
    ]);
    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  // Entradas y salidas salen del libro de inventario (movimientos con referencia al
  // proceso): ahí están los kg exactos que salió cada padre y entró a cada hijo.
  async obtener(id: string) {
    const proceso = await this.prisma.proceso.findUnique({
      where: { id },
      select: { ...CAMPOS_LISTA, observaciones: true, creadoEn: true },
    });
    if (!proceso) throw new NotFoundException('Proceso no encontrado');

    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: { referenciaTipo: 'PROCESO', referenciaId: id },
      orderBy: { creadoEn: 'asc' },
      select: {
        tipo: true,
        cantidadKg: true,
        lote: { select: { id: true, codigo: true, estado: true, estadoProducto: true } },
      },
    });

    const comoLinea = (m: (typeof movimientos)[number]) => ({ lote: m.lote, cantidadKg: m.cantidadKg.abs() });
    return {
      ...proceso,
      entradas: movimientos.filter((m) => m.tipo === 'SALIDA_PROCESO').map(comoLinea),
      salidas: movimientos.filter((m) => m.tipo === 'ENTRADA_PROCESO').map(comoLinea),
    };
  }

  // Registra un proceso terminado: consume los lotes de entrada y crea los de salida.
  // Todo en UNA transacción, igual que crear un lote: o queda todo o no queda nada.
  async crear(dto: CrearProcesoDto, usuarioId: string) {
    const error = validarForma(dto.tipo, dto.entradas.length, dto.salidas.length);
    if (error) throw new BadRequestException(error);

    const ids = dto.entradas.map((e) => e.loteId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un lote aparece más de una vez en las entradas');
    }

    try {
      const { procesoId, qrs } = await this.prisma.$transaction(
        async (tx) => {
          // 1. Bloquear los lotes de entrada. ORDER BY id: si dos procesos usan los mismos
          //    lotes, ambos los bloquean en el mismo orden y no se quedan esperando el uno
          //    al otro para siempre (deadlock).
          await tx.$queryRaw`SELECT id FROM lote WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;

          // 2. Validar centro y lotes.
          const centro = await tx.centro.findUnique({ where: { id: dto.centroId } });
          if (!centro || !centro.activo) throw new BadRequestException('El centro no existe o está inactivo');

          const lotes = await tx.lote.findMany({
            where: { id: { in: ids } },
            include: { existencias: { where: { centroId: dto.centroId } } },
          });
          const porId = new Map(lotes.map((l) => [l.id, l]));
          const faltantes = ids.filter((id) => !porId.has(id));
          if (faltantes.length) throw new NotFoundException(`Lotes no encontrados: ${faltantes.join(', ')}`);

          const noActivo = lotes.find((l) => l.estado !== EstadoLote.ACTIVO);
          if (noActivo) {
            throw new ConflictException(`El lote ${noActivo.codigo} está ${noActivo.estado}: solo se procesan lotes ACTIVOS`);
          }

          // No se mezcla uva con pergamino; y cada transformación exige su producto de entrada.
          const productos = new Set(lotes.map((l) => l.estadoProducto));
          if (productos.size > 1) throw new BadRequestException('Los lotes tienen distinto estado de producto');
          const [productoEntrada] = productos;
          const { transforma } = REGLAS[dto.tipo];
          if (transforma && productoEntrada !== transforma.desde) {
            throw new BadRequestException(`${dto.tipo} recibe producto ${transforma.desde}, no ${productoEntrada}`);
          }
          const productoSalida = transforma?.hacia ?? productoEntrada;

          // 3. Cuánto sale de cada lote: no más de lo que tiene en este centro.
          const tomados = dto.entradas.map((entrada) => {
            const lote = porId.get(entrada.loteId)!;
            const existencia = lote.existencias[0]?.cantidadKg ?? new Decimal(0);
            if (existencia.lte(0)) throw new BadRequestException(`El lote ${lote.codigo} no tiene existencia en este centro`);
            const cantidad = entrada.cantidadKg !== undefined ? new Decimal(entrada.cantidadKg) : existencia;
            if (cantidad.gt(existencia)) {
              throw new BadRequestException(`El lote ${lote.codigo} solo tiene ${existencia.toFixed(2)} kg en este centro`);
            }
            return { lote, cantidad, saldo: existencia.minus(cantidad) };
          });

          // 4. Balance de masa: lo que sale no puede superar lo que entra.
          //    La diferencia es la merma (agua evaporada en el secado, cáscara, polvo...).
          const totalEntrada = tomados.reduce((s, t) => s.plus(t.cantidad), new Decimal(0));
          const totalSalida = dto.salidas.reduce((s, x) => s.plus(x.cantidadKg), new Decimal(0));
          const merma = totalEntrada.minus(totalSalida);
          if (merma.lt(0)) {
            throw new BadRequestException(
              `Salen ${totalSalida.toFixed(2)} kg pero solo entran ${totalEntrada.toFixed(2)} kg`,
            );
          }

          // 5. Código del proceso (PR-2026-0001), con el mismo candado que los lotes.
          const anio = new Date().getFullYear();
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('proceso_codigo'))`;
          const ultimo = await tx.proceso.findFirst({
            where: { codigo: { startsWith: `PR-${anio}-` } },
            orderBy: { codigo: 'desc' },
            select: { codigo: true },
          });
          const siguiente = ultimo ? Number(ultimo.codigo.split('-')[2]) + 1 : 1;
          const codigo = `PR-${anio}-${String(siguiente).padStart(4, '0')}`;

          const proceso = await tx.proceso.create({
            data: {
              codigo,
              tipo: dto.tipo,
              centroId: dto.centroId,
              mermaKg: merma,
              observaciones: dto.observaciones,
              realizadoPorId: usuarioId,
              realizadoEn: dto.realizadoEn ? new Date(dto.realizadoEn) : new Date(),
            },
          });
          const referencia = { referenciaTipo: 'PROCESO', referenciaId: proceso.id, usuarioId };

          // 6. Sacar del inventario los lotes de entrada (movimiento negativo).
          //    Si un lote se queda sin existencia en ningún centro, pasa a AGOTADO.
          for (const { lote, cantidad, saldo } of tomados) {
            await tx.existencia.update({
              where: { loteId_centroId: { loteId: lote.id, centroId: dto.centroId } },
              data: { cantidadKg: saldo },
            });
            await tx.movimientoInventario.create({
              data: { loteId: lote.id, centroId: dto.centroId, tipo: 'SALIDA_PROCESO', cantidadKg: cantidad.negated(), saldoKg: saldo, ...referencia },
            });
            const resto = await tx.existencia.aggregate({ where: { loteId: lote.id }, _sum: { cantidadKg: true } });
            if ((resto._sum.cantidadKg ?? new Decimal(0)).lte(0)) {
              await this.lotes.cambiarEstado(tx, lote.id, EstadoLote.AGOTADO, usuarioId, `Consumido en el proceso ${codigo}`);
            }
          }

          // 7. Crear los lotes de salida (hijos), cada uno con su existencia, su primer
          //    estado, su entrada de inventario y su QR, igual que un lote de recepciones.
          const cosecha = Math.max(...lotes.map((l) => l.cosecha));
          const grados = new Set(lotes.map((l) => l.gradoCalidadId));
          const gradoHeredado = grados.size === 1 ? [...grados][0] : null;
          const relacion = tipoRelacion(dto.tipo, dto.salidas.length);
          const qrs: { loteId: string; codigo: string; qr: QrEmitido }[] = [];

          for (const salida of dto.salidas) {
            const cantidad = new Decimal(salida.cantidadKg);
            const hijo = await tx.lote.create({
              data: {
                codigo: await this.lotes.siguienteCodigo(tx, cosecha),
                centroId: dto.centroId,
                estadoProducto: productoSalida,
                gradoCalidadId: salida.gradoCalidadId ?? gradoHeredado,
                pesoInicialKg: cantidad,
                cosecha,
                creadoPorId: usuarioId,
                existencias: { create: { centroId: dto.centroId, cantidadKg: cantidad } },
                historialEstados: {
                  create: { estadoAnterior: null, estadoNuevo: EstadoLote.ACTIVO, motivo: `Creado por el proceso ${codigo}`, usuarioId },
                },
              },
            });
            await tx.movimientoInventario.create({
              data: { loteId: hijo.id, centroId: dto.centroId, tipo: 'ENTRADA_PROCESO', cantidadKg: cantidad, saldoKg: cantidad, ...referencia },
            });

            // 8. Aristas del grafo (lo que recorre WITH RECURSIVE en la trazabilidad).
            //    Con un solo hijo, cada padre aporta lo que se le tomó; con varios hijos
            //    (división) hay un solo padre y cada arista lleva los kg de ese hijo.
            await tx.loteRelacion.createMany({
              data: tomados.map((t) => ({
                padreId: t.lote.id,
                hijoId: hijo.id,
                procesoId: proceso.id,
                tipo: relacion,
                cantidadKg: dto.salidas.length === 1 ? t.cantidad : cantidad,
              })),
            });

            const token = await this.tokens.crear(
              { proposito: 'QR_LOTE', entidadTipo: 'lote', entidadId: hijo.id, creadoPorId: usuarioId },
              tx,
            );
            qrs.push({ loteId: hijo.id, codigo: hijo.codigo, qr: { valor: token.valor, url: this.tokens.urlQr(token.valor) } });
          }

          return { procesoId: proceso.id, qrs };
        },
        { timeout: 20_000 },
      );

      // Los QR de los lotes nuevos solo se pueden leer ahora (en la base queda su hash).
      return { ...(await this.obtener(procesoId)), qrs };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('El grado de calidad indicado no existe');
      }
      throw error;
    }
  }
}
