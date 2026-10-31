import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarCentroDto } from './dto/actualizar-centro.dto';
import { CrearCentroDto } from './dto/crear-centro.dto';
import { ListarCentrosDto } from './dto/listar-centros.dto';

// Columnas que se devuelven en listas (la dirección solo se ve en el detalle).
const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  nombre: true,
  telefono: true,
  municipio: true,
  departamento: true,
  activo: true
} satisfies Prisma.CentroSelect;

type CentroLista = Prisma.CentroGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class CentrosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarCentrosDto): Promise<Paginado<CentroLista>> {
    // Un filtro con valor undefined no se aplica: Prisma lo ignora.
    const where: Prisma.CentroWhereInput = {
      activo: filtros.activo,
      ...(filtros.buscar && {
        OR: [
          { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
          { codigo: { contains: filtros.buscar, mode: 'insensitive' } },
        ],
      }),
    };

    // Las dos consultas (página + total) se ejecutan en una sola transacción,
    // así el total corresponde exactamente a los mismos datos.
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.centro.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { nombre: 'asc' },
        ...paginar(filtros),
      }),
      this.prisma.centro.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const centro = await this.prisma.centro.findUnique({
      where: { id },
      include: {
        _count: { select: { recepciones: true, lotes: true } },
      },
    });
    if (!centro) throw new NotFoundException('Centro no encontrado');
    return centro;
  }

  async crear(dto: CrearCentroDto) {
    try {
      return await this.prisma.centro.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarCentroDto) {
    await this.verificarExiste(id);
    try {
      return await this.prisma.centro.update({ where: { id }, data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  // No se borra: sus recepciones y lotes deben conservar su origen (trazabilidad).
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.centro.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.centro.count({ where: { id } });
    if (!existe) throw new NotFoundException('Centro no encontrado');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE (codigo repetido).
      if (error.code === 'P2002') {
        const campos = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo único';
        throw new ConflictException(`Ya existe un centro con ese ${campos}`);
      }
    }
    throw error;
  }
}
