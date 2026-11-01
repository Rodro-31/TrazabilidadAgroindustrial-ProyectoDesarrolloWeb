import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../../common/paginacion.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarFincaDto } from './dto/actualizar-finca.dto';
import { CrearFincaDto } from './dto/crear-finca.dto';
import { ListarFincasDto } from './dto/listar-fincas.dto';

// Columnas de la finca y datos básicos de su productor, para listados.
const CAMPOS_LISTA = {
  id: true,
  nombre: true,
  municipio: true,
  departamento: true,
  altitudMsnm: true,
  areaHa: true,
  activo: true,
  productor: { select: { id: true, codigo: true, nombre: true } },
} satisfies Prisma.FincaSelect;

type FincaLista = Prisma.FincaGetPayload<{ select: typeof CAMPOS_LISTA }>;

@Injectable()
export class FincasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarFincasDto): Promise<Paginado<FincaLista>> {
    // Un filtro con valor undefined no se aplica: Prisma lo ignora.
    const where: Prisma.FincaWhereInput = {
      activo: filtros.activo,
      productorId: filtros.productorId,
      ...(filtros.buscar && { nombre: { contains: filtros.buscar, mode: 'insensitive' } }),
    };

    // Las dos consultas (página + total) se ejecutan en una sola transacción,
    // así el total corresponde exactamente a los mismos datos.
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.finca.findMany({
        where,
        select: CAMPOS_LISTA,
        orderBy: { nombre: 'asc' },
        ...paginar(filtros),
      }),
      this.prisma.finca.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string) {
    const finca = await this.prisma.finca.findUnique({
      where: { id },
      include: {
        productor: { select: { id: true, nombre: true, codigo: true} },
      },
    });
    if (!finca) throw new NotFoundException('Finca no encontrada');
    return finca;
  }

  async crear(dto: CrearFincaDto) {
    try {
      return await this.prisma.finca.create({ data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  async actualizar(id: string, dto: ActualizarFincaDto) {
    await this.verificarExiste(id);
    try {
      return await this.prisma.finca.update({ where: { id }, data: dto, select: CAMPOS_LISTA });
    } catch (error) {
      this.traducirError(error);
    }
  }

  // No se borra: sus recepciones y lotes deben conservar su origen (trazabilidad).
  async desactivar(id: string) {
    await this.verificarExiste(id);
    return this.prisma.finca.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_LISTA,
    });
  }

  private async verificarExiste(id: string) {
    const existe = await this.prisma.finca.count({ where: { id } });
    if (!existe) throw new NotFoundException('Finca no encontrada');
  }

  // Convierte errores de la base de datos en respuestas HTTP claras.
  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: viola una restricción UNIQUE (codigo repetido).
      if (error.code === 'P2002') {
        throw new ConflictException(`El productor ya tiene una finca con ese nombre`);
      }
      // P2003: viola una llave foránea (el productor ya tiene una finca con ese nombre: @@unique([productorId, nombre])).
      if (error.code === 'P2003') {
        throw new BadRequestException('El productor indicado no existe');
      }
    }
    throw error;
  }
}
