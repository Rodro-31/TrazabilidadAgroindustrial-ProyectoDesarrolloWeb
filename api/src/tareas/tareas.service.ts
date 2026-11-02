import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoTarea } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

type Cliente = PrismaService | Prisma.TransactionClient;
export type UsuarioJwt = { sub: string; rol: string };

// Quienes supervisan ven todas las tareas pendientes, no solo las de su rol.
const VEN_TODO = ['ADMIN', 'SUPERVISOR'];

const CAMPOS = {
  id: true,
  tipo: true,
  titulo: true,
  rol: true,
  centroId: true,
  entidadTipo: true,
  entidadId: true,
  estado: true,
  venceEn: true,
  creadoEn: true,
} satisfies Prisma.TareaSelect;

// Tareas pendientes de la PWA y la web. Una tarea se asigna a un usuario concreto o a
// todos los de un rol (opcionalmente de un centro). Los módulos que generan trabajo
// (recepciones → inspección, traslados → confirmación) solo insertan su tarea.
@Injectable()
export class TareasService {
  constructor(private readonly prisma: PrismaService) {}

  // Pendientes del usuario: las suyas y las de su rol en sus centros. Si el usuario no
  // tiene centros asignados, ve las de su rol en todos los centros.
  async mias(usuario: UsuarioJwt) {
    return this.prisma.tarea.findMany({
      where: await this.visibles(usuario),
      select: CAMPOS,
      orderBy: [{ venceEn: { sort: 'asc', nulls: 'last' } }, { creadoEn: 'asc' }],
      take: 100,
    });
  }

  // Cierra a mano una tarea visible para el usuario. La de inspección se cierra sola al
  // registrar la inspección, para que no quede "hecha" sin su resultado.
  async completar(id: string, usuario: UsuarioJwt) {
    const tarea = await this.prisma.tarea.findFirst({
      where: { AND: [{ id }, await this.visibles(usuario, false)] },
      select: { id: true, tipo: true, estado: true },
    });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');
    if (tarea.estado !== 'PENDIENTE') throw new ConflictException('La tarea ya no está pendiente');
    if (tarea.tipo === 'INSPECCION_CALIDAD') {
      throw new ConflictException('Esta tarea se completa al registrar la inspección de calidad');
    }
    return this.prisma.tarea.update({
      where: { id },
      data: { estado: 'COMPLETADA', completadaEn: new Date() },
      select: CAMPOS,
    });
  }

  // Al registrar una recepción: inspección de calidad para el rol CALIDAD de ese centro.
  crearInspeccionRecepcion(tx: Cliente, recepcionId: string, centroId: string, titulo: string) {
    return tx.tarea.create({
      data: {
        tipo: 'INSPECCION_CALIDAD',
        titulo,
        rol: 'CALIDAD',
        centroId,
        entidadTipo: 'recepcion',
        entidadId: recepcionId,
      },
    });
  }

  // Cierra las tareas pendientes de un tipo sobre una entidad (p. ej. al inspeccionarla).
  async completarPorEntidad(tx: Cliente, tipo: TipoTarea, entidadTipo: string, entidadId: string): Promise<number> {
    const { count } = await tx.tarea.updateMany({
      where: { tipo, entidadTipo, entidadId, estado: 'PENDIENTE' },
      data: { estado: 'COMPLETADA', completadaEn: new Date() },
    });
    return count;
  }

  private async visibles(usuario: UsuarioJwt, soloPendientes = true): Promise<Prisma.TareaWhereInput> {
    const estado = soloPendientes ? { estado: 'PENDIENTE' as const } : {};
    if (VEN_TODO.includes(usuario.rol)) return estado;

    const centros = await this.prisma.usuarioCentro.findMany({
      where: { usuarioId: usuario.sub },
      select: { centroId: true },
    });
    const ids = centros.map((c) => c.centroId);
    return {
      ...estado,
      OR: [
        { usuarioId: usuario.sub },
        {
          usuarioId: null,
          rol: usuario.rol as Prisma.TareaWhereInput['rol'],
          ...(ids.length > 0 && { OR: [{ centroId: null }, { centroId: { in: ids } }] }),
        },
      ],
    };
  }
}
