import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarGradoCalidadDto } from './dto/actualizar-grado-calidad.dto';
import { CrearGradoCalidadDto } from './dto/crear-grado-calidad.dto';
import { ListarGradosCalidadDto } from './dto/listar-grados-calidad.dto';

const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  nombre: true,
  descripcion: true,
  orden: true,
  activo: true,
} satisfies Prisma.GradoCalidadSelect;

type GradoCalidadLista = Prisma.GradoCalidadGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class GradosCalidadService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarGradosCalidadDto): Promise<Paginado<GradoCalidadLista>> {
    const where: Prisma.GradoCalidadWhereInput = { activo: filtros.activo };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.gradoCalidad.findMany({
        where,
        select: CAMPOS_LISTA,
        // Primero por el orden definido por calidad; a igual orden, por nombre.
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        ...paginar(filtros),
      }),
      this.prisma.gradoCalidad.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const grado = await this.prisma.gradoCalidad.findUnique({
      where: { id },
      include: { _count: { select: { lotes: true, inspecciones: true, precios: true } } },
    });
    if (!grado) throw new NotFoundException('Grado de calidad no encontrado');
    return grado;
  }

  async crear(dto: CrearGradoCalidadDto) {
    try {
      return await this.prisma.gradoCalidad.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarGradoCalidadDto) {
    await this.verificarExiste(id);
    return this.prisma.gradoCalidad.update({ where: { id }, data: dto, select: CAMPOS_LISTA });
  }

  // No se borra: lotes, inspecciones y precios históricos siguen apuntando a él.
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.gradoCalidad.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.gradoCalidad.count({ where: { id } });
    if (!existe) throw new NotFoundException('Grado de calidad no encontrado');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE (codigo repetido).
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un grado de calidad con ese código');
      }
    }
    throw error;
  }
}
