import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CrearPrecioDto, ListarPreciosDto } from './dto/precios.dto';

const CAMPOS = {
  id: true,
  estadoProducto: true,
  precioPorKg: true,
  moneda: true,
  vigenteDesde: true,
  vigenteHasta: true,
  creadoEn: true,
  gradoCalidad: { select: { id: true, codigo: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.PrecioSelect;

type Fila = Prisma.PrecioGetPayload<{ select: typeof CAMPOS }>;

// Estado calculado a partir de las fechas (no se guarda: así nunca queda desactualizado).
function conEstado(p: Fila, ahora = new Date()) {
  const estado = p.vigenteDesde > ahora ? 'PROGRAMADO' : p.vigenteHasta && p.vigenteHasta <= ahora ? 'CERRADO' : 'VIGENTE';
  return { ...p, estado };
}

// Precios por kg según producto y grado. Son HISTORIA: no se editan ni se borran, porque
// las liquidaciones se calcularon con ellos. Un precio nuevo cierra al anterior
// (vigente_hasta) y el que la liquidación usa es el que estaba vigente en la fecha de
// cada recepción.
@Injectable()
export class PreciosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarPreciosDto) {
    const ahora = new Date();
    const where: Prisma.PrecioWhereInput = {
      estadoProducto: filtros.estadoProducto,
      ...(filtros.vigentes && {
        vigenteDesde: { lte: ahora },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }],
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.precio.findMany({
        where,
        select: CAMPOS,
        orderBy: [{ estadoProducto: 'asc' }, { vigenteDesde: 'desc' }],
        ...paginar(filtros),
      }),
      this.prisma.precio.count({ where }),
    ]);
    return { datos: datos.map((p) => conEstado(p, ahora)), total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async crear(dto: CrearPrecioDto, usuarioId: string) {
    const desde = dto.vigenteDesde ? new Date(dto.vigenteDesde) : new Date();
    const grado = dto.gradoCalidadId ?? null;

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        // Un candado por producto y grado: dos cambios de precio a la vez no se pisan.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`precio:${dto.estadoProducto}:${grado ?? 'general'}`}))`;

        // No se intercala un precio en medio del historial: debe empezar después del último.
        const ultimo = await tx.precio.findFirst({
          where: { estadoProducto: dto.estadoProducto, gradoCalidadId: grado },
          orderBy: { vigenteDesde: 'desc' },
        });
        if (ultimo && ultimo.vigenteDesde >= desde) {
          throw new ConflictException('Ya hay un precio que empieza en esa fecha o después: el nuevo debe empezar más tarde');
        }

        // El anterior queda cerrado justo cuando empieza el nuevo (sin huecos ni traslapes).
        if (ultimo && (!ultimo.vigenteHasta || ultimo.vigenteHasta > desde)) {
          await tx.precio.update({ where: { id: ultimo.id }, data: { vigenteHasta: desde } });
        }

        const precio = await tx.precio.create({
          data: {
            estadoProducto: dto.estadoProducto,
            gradoCalidadId: grado,
            precioPorKg: dto.precioPorKg,
            vigenteDesde: desde,
            creadoPorId: usuarioId,
          },
        });
        return precio.id;
      });
      return conEstado(await this.prisma.precio.findUniqueOrThrow({ where: { id }, select: CAMPOS }));
    } catch (error) {
      // P2003: el grado de calidad no existe.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('El grado de calidad indicado no existe');
      }
      throw error;
    }
  }

  // Cerrar sin reemplazo (por ejemplo, se deja de comprar ese producto). Desde ahora, las
  // recepciones nuevas de ese producto y grado no tienen precio hasta que se cree otro.
  async cerrar(id: string) {
    const ahora = new Date();
    const precio = await this.prisma.precio.findUnique({ where: { id }, select: CAMPOS });
    if (!precio) throw new NotFoundException('Precio no encontrado');
    if (conEstado(precio, ahora).estado !== 'VIGENTE') {
      throw new ConflictException('Solo se cierra un precio vigente');
    }
    const cerrado = await this.prisma.precio.update({ where: { id }, data: { vigenteHasta: ahora }, select: CAMPOS });
    return conEstado(cerrado, ahora);
  }
}
