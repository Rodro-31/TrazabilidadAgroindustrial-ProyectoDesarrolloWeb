import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarCompradorDto } from './dto/actualizar-comprador.dto';
import { CrearCompradorDto } from './dto/crear-comprador.dto';
import { ListarCompradoresDto } from './dto/listar-compradores.dto';

// Columnas que se devuelven en listas (el contacto solo se ve en el detalle).
const CAMPOS_LISTA = {
  id: true,
  nombre: true,
  nit: true,
  pais: true,
  email: true,
  telefono: true,
  activo: true,
} satisfies Prisma.CompradorSelect;

type CompradorLista = Prisma.CompradorGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class CompradoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarCompradoresDto): Promise<Paginado<CompradorLista>> {
    const where: Prisma.CompradorWhereInput = {
      activo: filtros.activo,
      ...(filtros.pais && { pais: { equals: filtros.pais, mode: 'insensitive' } }),
      ...(filtros.buscar && {
        OR: [
          { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
          { nit: { contains: filtros.buscar, mode: 'insensitive' } },
        ],
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.comprador.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { nombre: 'asc' },
        ...paginar(filtros),
      }),
      this.prisma.comprador.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const comprador = await this.prisma.comprador.findUnique({
      where: { id },
      include: { _count: { select: { ventas: true } } },
    });
    if (!comprador) throw new NotFoundException('Comprador no encontrado');
    return comprador;
  }

  async crear(dto: CrearCompradorDto) {
    try {
      return await this.prisma.comprador.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarCompradorDto) {
    await this.verificarExiste(id);
    try {
      return await this.prisma.comprador.update({ where: { id }, data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  // No se borra: sus ventas deben seguir indicando a quién se vendió (trazabilidad hacia adelante).
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.comprador.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.comprador.count({ where: { id } });
    if (!existe) throw new NotFoundException('Comprador no encontrado');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE (nit repetido).
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un comprador con ese NIT');
      }
    }
    throw error;
  }
}
