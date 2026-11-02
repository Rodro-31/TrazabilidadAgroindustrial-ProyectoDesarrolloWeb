import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { TareasService } from '../tareas/tareas.service';
import { CrearInspeccionDto } from './dto/crear-inspeccion.dto';
import { ListarInspeccionesDto } from './dto/listar-inspecciones.dto';

const CAMPOS = {
  id: true,
  recepcionId: true,
  loteId: true,
  humedadPct: true,
  impurezasPct: true,
  defectosPct: true,
  aprobado: true,
  observaciones: true,
  inspeccionadoEn: true,
  creadoEn: true,
  gradoCalidad: { select: { id: true, codigo: true, nombre: true } },
  inspector: { select: { id: true, nombre: true } },
  recepcion: { select: { id: true, productor: { select: { codigo: true, nombre: true } } } },
  lote: { select: { id: true, codigo: true } },
} satisfies Prisma.InspeccionCalidadSelect;

type Inspeccion = Prisma.InspeccionCalidadGetPayload<{ select: typeof CAMPOS }>;

// Margen para relojes de teléfono adelantados.
const TOLERANCIA_FUTURO_MS = 10 * 60_000;

// Control de calidad: cada inspección es de una recepción o de un lote (nunca ambos) y
// nunca se edita; una nueva inspección deja historial. Si la inspección de un lote trae
// grado, ese pasa a ser el grado del lote.
@Injectable()
export class CalidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tareas: TareasService,
  ) {}

  async listar(filtros: ListarInspeccionesDto): Promise<Paginado<Inspeccion>> {
    const where: Prisma.InspeccionCalidadWhereInput = {
      recepcionId: filtros.recepcionId,
      loteId: filtros.loteId,
      aprobado: filtros.aprobado,
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.inspeccionCalidad.findMany({ where, select: CAMPOS, orderBy: { inspeccionadoEn: 'desc' }, ...paginar(filtros) }),
      this.prisma.inspeccionCalidad.count({ where }),
    ]);
    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string): Promise<Inspeccion> {
    const i = await this.prisma.inspeccionCalidad.findUnique({ where: { id }, select: CAMPOS });
    if (!i) throw new NotFoundException('Inspección no encontrada');
    return i;
  }

  // Idempotente: el id lo genera el cliente (la PWA la guarda sin conexión y la reintenta).
  // Si ya existe, se devuelve la existente sin cambiar nada.
  async crear(dto: CrearInspeccionDto, inspectorId: string): Promise<{ creada: boolean; inspeccion: Inspeccion }> {
    const existente = await this.prisma.inspeccionCalidad.findUnique({ where: { id: dto.id }, select: CAMPOS });
    if (existente) return { creada: false, inspeccion: existente };

    if (Boolean(dto.recepcionId) === Boolean(dto.loteId)) {
      throw new BadRequestException('Indica la recepción o el lote inspeccionado (solo uno de los dos).');
    }
    const inspeccionadoEn = new Date(dto.inspeccionadoEn);
    if (inspeccionadoEn.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
      throw new BadRequestException('La fecha de inspección no puede estar en el futuro.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.recepcionId) {
          const existe = await tx.recepcion.count({ where: { id: dto.recepcionId } });
          if (!existe) throw new NotFoundException('La recepción no existe');
        } else {
          const lote = await tx.lote.findUnique({ where: { id: dto.loteId }, select: { estado: true, codigo: true } });
          if (!lote) throw new NotFoundException('El lote no existe');
          if (lote.estado === 'ANULADO') throw new ConflictException(`El lote ${lote.codigo} está anulado`);
        }
        if (dto.gradoCalidadId) {
          const grado = await tx.gradoCalidad.findUnique({ where: { id: dto.gradoCalidadId }, select: { activo: true } });
          if (!grado?.activo) throw new BadRequestException('El grado de calidad no existe o está inactivo');
        }

        await tx.inspeccionCalidad.create({
          data: {
            id: dto.id,
            recepcionId: dto.recepcionId ?? null,
            loteId: dto.loteId ?? null,
            gradoCalidadId: dto.gradoCalidadId ?? null,
            humedadPct: dto.humedadPct,
            impurezasPct: dto.impurezasPct,
            defectosPct: dto.defectosPct,
            aprobado: dto.aprobado,
            observaciones: dto.observaciones,
            inspectorId,
            inspeccionadoEn,
          },
        });

        if (dto.loteId && dto.gradoCalidadId) {
          await tx.lote.update({ where: { id: dto.loteId }, data: { gradoCalidadId: dto.gradoCalidadId } });
        }

        await this.tareas.completarPorEntidad(
          tx,
          'INSPECCION_CALIDAD',
          dto.recepcionId ? 'recepcion' : 'lote',
          (dto.recepcionId ?? dto.loteId)!,
        );
      });
    } catch (error) {
      // Dos envíos con el mismo id a la vez: el segundo recibe la ya creada.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const ya = await this.prisma.inspeccionCalidad.findUnique({ where: { id: dto.id }, select: CAMPOS });
        if (ya) return { creada: false, inspeccion: ya };
      }
      throw error;
    }

    return { creada: true, inspeccion: await this.obtener(dto.id) };
  }
}
