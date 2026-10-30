import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarProductorDto } from './dto/actualizar-productor.dto';
import { CrearProductorDto } from './dto/crear-productor.dto';
import { ListarProductoresDto } from './dto/listar-productores.dto';

// Columnas que se devuelven en listas: todo menos el DPI (dato sensible).
const CAMPOS_LISTA = {
  id: true,
  codigo: true,
  nombre: true,
  telefono: true,
  municipio: true,
  departamento: true,
  activo: true,
  organizacion: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductorSelect;

type ProductorLista = Prisma.ProductorGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarProductoresDto): Promise<Paginado<ProductorLista>> {
    // Un filtro con valor undefined no se aplica: Prisma lo ignora.
    const where: Prisma.ProductorWhereInput = {
      activo: filtros.activo,
      organizacionId: filtros.organizacionId,
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
      this.prisma.productor.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { nombre: 'asc' },
        ...paginar(filtros),
      }),
      this.prisma.productor.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const productor = await this.prisma.productor.findUnique({
      where: { id },
      include: {
        organizacion: { select: { id: true, nombre: true } },
        fincas: { where: { activo: true }, orderBy: { nombre: 'asc' } },
      },
    });
    if (!productor) throw new NotFoundException('Productor no encontrado');
    return productor;
  }

  // Entregas recientes del productor (la usa la PWA al consultar un productor).
  async recepcionesRecientes(id: string, limite: number) {
    await this.verificarExiste(id);
    return this.prisma.recepcion.findMany({
      where: { productorId: id },
      orderBy: { capturadoEn: 'desc' },
      take: Math.min(Math.max(limite, 1), 50),
      select: {
        id: true,
        capturadoEn: true,
        estadoProducto: true,
        pesoNetoKg: true,
        centro: { select: { id: true, nombre: true } },
        finca: { select: { id: true, nombre: true } },
      },
    });
  }

  async crear(dto: CrearProductorDto) {
    try {
      return await this.prisma.productor.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarProductorDto) {
    await this.verificarExiste(id);
    try {
      return await this.prisma.productor.update({ where: { id }, data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  // No se borra: sus recepciones y lotes deben conservar su origen (trazabilidad).
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.productor.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.productor.count({ where: { id } });
    if (!existe) throw new NotFoundException('Productor no encontrado');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE (codigo o dpi repetido).
      if (error.code === 'P2002') {
        const campos = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo único';
        throw new ConflictException(`Ya existe un productor con ese ${campos}`);
      }
      // P2003: viola una llave foránea (organizacionId que no existe).
      if (error.code === 'P2003') {
        throw new BadRequestException('La organización indicada no existe');
      }
    }
    throw error;
  }
}
