import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLote, Prisma } from '@prisma/client';
import { paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { LotesService } from '../lotes/lotes.service';
import { QrEmitido } from '../recepciones/recepciones.service';
import { ContextoToken, TokensService } from '../tokens/tokens.service';
import { CrearTrasladoDto, ListarTrasladosDto, RecibirTrasladoDto } from './dto/traslados.dto';

const Decimal = Prisma.Decimal;

// El código de confirmación vence a las 72 horas: si el producto no llegó en ese tiempo,
// algo pasó y el supervisor debe revisarlo (cancelar y volver a despachar).
const VIGENCIA_TOKEN_MS = 72 * 60 * 60 * 1000;
// Pueden recibir en cualquier centro; los demás, solo en los centros que tienen asignados.
const VEN_TODOS_LOS_CENTROS = ['ADMIN', 'SUPERVISOR'];

type Usuario = { sub: string; rol: string };

const CAMPOS = {
  id: true,
  codigo: true,
  estado: true,
  cantidadKg: true,
  cantidadRecibidaKg: true,
  observaciones: true,
  solicitadoEn: true,
  despachadoEn: true,
  recibidoEn: true,
  lote: { select: { id: true, codigo: true, estado: true, estadoProducto: true } },
  origen: { select: { id: true, codigo: true, nombre: true } },
  destino: { select: { id: true, codigo: true, nombre: true } },
  solicitadoPor: { select: { id: true, nombre: true } },
  recibidoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.TrasladoSelect;

@Injectable()
export class TrasladosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lotes: LotesService,
    private readonly tokens: TokensService,
  ) {}

  async listar(filtros: ListarTrasladosDto) {
    const where: Prisma.TrasladoWhereInput = {
      estado: filtros.estado,
      loteId: filtros.loteId,
      ...(filtros.centroId && { OR: [{ origenId: filtros.centroId }, { destinoId: filtros.centroId }] }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.traslado.findMany({ where, select: CAMPOS, orderBy: { solicitadoEn: 'desc' }, ...paginar(filtros) }),
      this.prisma.traslado.count({ where }),
    ]);
    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const traslado = await this.prisma.traslado.findUnique({ where: { id }, select: CAMPOS });
    if (!traslado) throw new NotFoundException('Traslado no encontrado');
    return traslado;
  }

  // Despachar: en UNA transacción el lote sale del inventario del origen, pasa a
  // EN_TRANSITO y se emite el código de confirmación (token de uso único que vence).
  async crear(dto: CrearTrasladoDto, usuarioId: string) {
    const { trasladoId, confirmacion } = await this.prisma.$transaction(
      async (tx) => {
        // Bloquear el lote: si alguien lo procesa o traslada a la vez, espera.
        await tx.$queryRaw`SELECT id FROM lote WHERE id = ${dto.loteId} FOR UPDATE`;
        const lote = await tx.lote.findUnique({
          where: { id: dto.loteId },
          include: { existencias: { where: { cantidadKg: { gt: 0 } } } },
        });
        if (!lote) throw new NotFoundException('Lote no encontrado');
        if (lote.estado !== EstadoLote.ACTIVO) {
          throw new ConflictException(`El lote ${lote.codigo} está ${lote.estado}: solo se trasladan lotes ACTIVOS`);
        }
        // Un lote siempre está en un solo centro (se traslada completo), así que su
        // existencia positiva dice de dónde sale.
        const [existencia] = lote.existencias;
        if (!existencia) throw new ConflictException(`El lote ${lote.codigo} no tiene existencia`);
        if (existencia.centroId === dto.destinoId) {
          throw new BadRequestException('El lote ya está en ese centro');
        }
        const destino = await tx.centro.findUnique({ where: { id: dto.destinoId } });
        if (!destino || !destino.activo) throw new BadRequestException('El centro de destino no existe o está inactivo');

        const anio = new Date().getFullYear();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('traslado_codigo'))`;
        const ultimo = await tx.traslado.findFirst({
          where: { codigo: { startsWith: `TR-${anio}-` } },
          orderBy: { codigo: 'desc' },
          select: { codigo: true },
        });
        const codigo = `TR-${anio}-${String(ultimo ? Number(ultimo.codigo.split('-')[2]) + 1 : 1).padStart(4, '0')}`;

        const ahora = new Date();
        const traslado = await tx.traslado.create({
          data: {
            codigo,
            loteId: lote.id,
            origenId: existencia.centroId,
            destinoId: dto.destinoId,
            cantidadKg: existencia.cantidadKg,
            estado: 'EN_TRANSITO',
            observaciones: dto.observaciones,
            solicitadoPorId: usuarioId,
            despachadoEn: ahora,
          },
        });

        // Sale del inventario del origen (el libro registra la salida con saldo 0).
        await tx.existencia.update({
          where: { loteId_centroId: { loteId: lote.id, centroId: existencia.centroId } },
          data: { cantidadKg: 0 },
        });
        await tx.movimientoInventario.create({
          data: {
            loteId: lote.id,
            centroId: existencia.centroId,
            tipo: 'SALIDA_TRASLADO',
            cantidadKg: existencia.cantidadKg.negated(),
            saldoKg: 0,
            referenciaTipo: 'TRASLADO',
            referenciaId: traslado.id,
            usuarioId,
          },
        });
        await this.lotes.cambiarEstado(tx, lote.id, EstadoLote.EN_TRANSITO, usuarioId, `Despachado en el traslado ${codigo}`);

        // Código de confirmación: el transportista lo entrega en destino. En la base
        // queda solo su hash; vence a las 72 horas y sirve una sola vez.
        const token = await this.tokens.crear(
          {
            proposito: 'CONFIRMACION_TRASLADO',
            entidadTipo: 'traslado',
            entidadId: traslado.id,
            expiraEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS),
            creadoPorId: usuarioId,
          },
          tx,
        );

        // Tarea para la báscula del centro destino (la ven en la PWA y en la web).
        await tx.tarea.create({
          data: {
            tipo: 'CONFIRMAR_TRASLADO',
            titulo: `Recibir lote ${lote.codigo} (traslado ${codigo})`,
            rol: 'BASCULA',
            centroId: dto.destinoId,
            entidadTipo: 'traslado',
            entidadId: traslado.id,
            venceEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS),
          },
        });

        const confirmacion: QrEmitido & { expiraEn: Date } = {
          valor: token.valor,
          url: this.tokens.urlQr(token.valor),
          expiraEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS),
        };
        return { trasladoId: traslado.id, confirmacion };
      },
      { timeout: 15_000 },
    );

    return { ...(await this.obtener(trasladoId)), confirmacion };
  }

  // Recibir en destino. Primero se valida el código (queda en la auditoría aunque falle)
  // y después, en una transacción, se marca usado y el lote entra al inventario del destino.
  async recibir(id: string, dto: RecibirTrasladoDto, usuario: Usuario, contexto: ContextoToken) {
    const traslado = await this.obtener(id);
    await this.verificarCentro(usuario, traslado.destino.id);

    const { resultado, token } = await this.tokens.validar(dto.token, 'CONFIRMACION_TRASLADO', {
      ...contexto,
      usuarioId: usuario.sub,
    });
    // Un código de OTRO traslado se trata igual que uno inexistente.
    if (resultado === 'INEXISTENTE' || !token || token.entidadId !== id) {
      throw new BadRequestException('El código de confirmación no corresponde a este traslado');
    }
    if (resultado === 'EXPIRADO') throw new GoneException('El código de confirmación venció: el supervisor debe cancelar y volver a despachar');
    if (resultado !== 'VALIDO') throw new GoneException('El código de confirmación ya fue usado o fue anulado');

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM traslado WHERE id = ${id} FOR UPDATE`;
      const actual = await tx.traslado.findUnique({ where: { id } });
      if (!actual || actual.estado !== 'EN_TRANSITO') {
        throw new ConflictException(`El traslado ya no está en tránsito (estado: ${actual?.estado})`);
      }

      const recibido = dto.cantidadRecibidaKg !== undefined ? new Decimal(dto.cantidadRecibidaKg) : actual.cantidadKg;
      if (recibido.gt(actual.cantidadKg)) {
        throw new BadRequestException(`Se enviaron ${actual.cantidadKg.toFixed(2)} kg: no pueden llegar más`);
      }

      // Uso único y atómico: la condición va en el WHERE. Si dos personas confirman a
      // la vez, solo una actualiza la fila; la otra recibe 409.
      const { count } = await tx.token.updateMany({
        where: { id: token.id, usadoEn: null, revocadoEn: null, expiraEn: { gt: new Date() } },
        data: { usadoEn: new Date() },
      });
      if (count !== 1) throw new ConflictException('El código de confirmación ya fue usado');

      // Entra al inventario del destino (upsert: la fila puede existir de un traslado anterior).
      const existencia = await tx.existencia.upsert({
        where: { loteId_centroId: { loteId: actual.loteId, centroId: actual.destinoId } },
        create: { loteId: actual.loteId, centroId: actual.destinoId, cantidadKg: recibido },
        update: { cantidadKg: { increment: recibido } },
      });
      await tx.movimientoInventario.create({
        data: {
          loteId: actual.loteId,
          centroId: actual.destinoId,
          tipo: 'ENTRADA_TRASLADO',
          cantidadKg: recibido,
          saldoKg: existencia.cantidadKg,
          referenciaTipo: 'TRASLADO',
          referenciaId: id,
          motivo: recibido.lt(actual.cantidadKg)
            ? `Merma en tránsito: ${actual.cantidadKg.minus(recibido).toFixed(2)} kg`
            : undefined,
          usuarioId: usuario.sub,
        },
      });

      await tx.traslado.update({
        where: { id },
        data: { estado: 'RECIBIDO', cantidadRecibidaKg: recibido, recibidoPorId: usuario.sub, recibidoEn: new Date() },
      });
      await this.lotes.cambiarEstado(tx, actual.loteId, EstadoLote.ACTIVO, usuario.sub, `Recibido en destino (traslado ${actual.codigo})`);
      await this.cerrarTareas(tx, id, 'COMPLETADA');
    });

    return this.obtener(id);
  }

  // Cancelar un traslado en tránsito: el lote vuelve al inventario del origen y el
  // código de confirmación se anula.
  async cancelar(id: string, motivo: string, usuarioId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM traslado WHERE id = ${id} FOR UPDATE`;
      const actual = await tx.traslado.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException('Traslado no encontrado');
      if (actual.estado !== 'EN_TRANSITO') {
        throw new ConflictException(`Solo se cancela un traslado en tránsito (estado: ${actual.estado})`);
      }

      const existencia = await tx.existencia.update({
        where: { loteId_centroId: { loteId: actual.loteId, centroId: actual.origenId } },
        data: { cantidadKg: { increment: actual.cantidadKg } },
      });
      await tx.movimientoInventario.create({
        data: {
          loteId: actual.loteId,
          centroId: actual.origenId,
          tipo: 'ENTRADA_TRASLADO',
          cantidadKg: actual.cantidadKg,
          saldoKg: existencia.cantidadKg,
          referenciaTipo: 'TRASLADO',
          referenciaId: id,
          motivo: `Traslado cancelado: ${motivo}`,
          usuarioId,
        },
      });
      await tx.traslado.update({
        where: { id },
        data: { estado: 'CANCELADO', observaciones: [actual.observaciones, `Cancelado: ${motivo}`].filter(Boolean).join(' · ') },
      });
      await this.lotes.cambiarEstado(tx, actual.loteId, EstadoLote.ACTIVO, usuarioId, `Traslado ${actual.codigo} cancelado: ${motivo}`);
      await this.tokens.revocarPorEntidad('traslado', id, 'CONFIRMACION_TRASLADO', tx);
      await this.cerrarTareas(tx, id, 'CANCELADA');
    });

    return this.obtener(id);
  }

  // Solo el personal del centro destino (o quien supervisa todos) puede recibir.
  // Un usuario sin centros asignados trabaja en todos (mismo criterio que las tareas).
  private async verificarCentro(usuario: Usuario, centroId: string) {
    if (VEN_TODOS_LOS_CENTROS.includes(usuario.rol)) return;
    const centros = await this.prisma.usuarioCentro.findMany({ where: { usuarioId: usuario.sub }, select: { centroId: true } });
    if (centros.length > 0 && !centros.some((c) => c.centroId === centroId)) {
      throw new ForbiddenException('Solo el personal del centro de destino puede recibir este traslado');
    }
  }

  private cerrarTareas(tx: Prisma.TransactionClient, trasladoId: string, estado: 'COMPLETADA' | 'CANCELADA') {
    return tx.tarea.updateMany({
      where: { tipo: 'CONFIRMAR_TRASLADO', entidadTipo: 'traslado', entidadId: trasladoId, estado: 'PENDIENTE' },
      data: { estado, completadaEn: new Date() },
    });
  }
}
