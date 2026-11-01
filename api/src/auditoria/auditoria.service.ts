import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto';

const CAMPOS_AUDITORIA = {
  id: true,
  accion: true,
  entidad: true,
  entidadId: true,
  antes: true,
  despues: true,
  ip: true,
  userAgent: true,
  creadoEn: true,
  usuario: { select: { id: true, nombre: true, email: true, rol: true } },
} satisfies Prisma.AuditoriaSelect;

type RegistroAuditoria = Prisma.AuditoriaGetPayload<{ select: typeof CAMPOS_AUDITORIA }>;

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarAuditoriaDto): Promise<Paginado<RegistroAuditoria>> {
    const where: Prisma.AuditoriaWhereInput = {
      usuarioId: filtros.usuarioId,
      entidad: filtros.entidad,
      entidadId: filtros.entidadId,
      ...(filtros.accion && { accion: { contains: filtros.accion, mode: 'insensitive' } }),
      ...((filtros.desde || filtros.hasta) && {
        creadoEn: {
          gte: filtros.desde ? new Date(filtros.desde) : undefined,
          lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
        },
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        select: CAMPOS_AUDITORIA,
        orderBy: { creadoEn: 'desc' },
        ...paginar(filtros),
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }
}
