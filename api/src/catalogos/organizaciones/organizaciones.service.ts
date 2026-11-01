import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ListarOrganizacionesDto } from './dto/listar-organizaciones.dto';

// Columnas de la organización y cuántos productores tiene (COUNT en PostgreSQL).
const CAMPOS_LISTA = {
  id: true,
  nombre: true,
  tipo: true,
  nit: true,
  telefono: true,
  activo: true,
  _count: { select: { productores: true } },
} satisfies Prisma.OrganizacionSelect;

type OrganizacionLista = Prisma.OrganizacionGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class OrganizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarOrganizacionesDto): Promise<Paginado<OrganizacionLista>> {
    const where: Prisma.OrganizacionWhereInput = {
      activo: filtros.activo,
      tipo: filtros.tipo,
      ...(filtros.buscar && {
        OR: [
          { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
          { nit: { contains: filtros.buscar, mode: 'insensitive' } },
        ],
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.organizacion.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { nombre: 'asc' },
        ...paginar(filtros),
      }),
      this.prisma.organizacion.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const organizacion = await this.prisma.organizacion.findUnique({
      where: { id },
      include: {
        productores: {
          where: { activo: true },
          select: { id: true, codigo: true, nombre: true },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!organizacion) throw new NotFoundException('Organización no encontrada');
    return organizacion;
  }

  async crear(dto: CrearOrganizacionDto) {
    try {
      return await this.prisma.organizacion.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarOrganizacionDto) {
    await this.verificarExiste(id);
    try {
      return await this.prisma.organizacion.update({
        where: { id },
        data: dto,
        select: CAMPOS_LISTA,
      });
    } catch (error) {
      this.traducirError(error);
    }
  }

  // No se borra: sus productores siguen apuntando a ella.
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.organizacion.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.organizacion.count({ where: { id } });
    if (!existe) throw new NotFoundException('Organización no encontrada');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE. Hay dos (nombre y nit): se indica cuál.
      if (error.code === 'P2002') {
        const campos = (error.meta?.target as string[] | undefined) ?? [];
        const campo = campos.includes('nit') ? 'NIT' : 'nombre';
        throw new ConflictException(`Ya existe una organización con ese ${campo}`);
      }
    }
    throw error;
  }
}
