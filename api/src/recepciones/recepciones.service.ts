import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { CrearRecepcionDto } from './dto/crear-recepcion.dto';
import { ListarRecepcionesDto } from './dto/listar-recepciones.dto';
import { RegistrarPesajeDto } from './dto/registrar-pesaje.dto';

// Datos de una recepción. Del productor solo se devuelven código y nombre (nunca el DPI).
const CAMPOS_RECEPCION = {
  id: true,
  estadoProducto: true,
  pesoBrutoKg: true,
  taraKg: true,
  pesoNetoKg: true,
  humedadPct: true,
  observaciones: true,
  capturadoEn: true,
  creadoEn: true,
  centro: { select: { id: true, nombre: true } },
  productor: { select: { id: true, codigo: true, nombre: true } },
  finca: { select: { id: true, nombre: true } },
  registradoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.RecepcionSelect;

const CAMPOS_DETALLE = {
  ...CAMPOS_RECEPCION,
  pesajes: {
    orderBy: { creadoEn: 'asc' },
    select: {
      id: true,
      pesoBrutoKg: true,
      taraKg: true,
      pesoNetoKg: true,
      motivo: true,
      creadoEn: true,
      registradoPor: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.RecepcionSelect;

type RecepcionLista = Prisma.RecepcionGetPayload<{ select: typeof CAMPOS_RECEPCION }>;
type RecepcionDetalle = Prisma.RecepcionGetPayload<{ select: typeof CAMPOS_DETALLE }>;

export interface QrEmitido {
  valor: string;
  url: string | null;
}

@Injectable()
export class RecepcionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async listar(filtros: ListarRecepcionesDto): Promise<Paginado<RecepcionLista>> {
    const where: Prisma.RecepcionWhereInput = {
      centroId: filtros.centroId,
      productorId: filtros.productorId,
      estadoProducto: filtros.estadoProducto,
      ...((filtros.desde || filtros.hasta) && {
        capturadoEn: {
          gte: filtros.desde ? new Date(filtros.desde) : undefined,
          lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
        },
      }),
    };

    const [datos, total] = await this.prisma.$transaction([
      this.prisma.recepcion.findMany({
        where,
        select: CAMPOS_RECEPCION,
        orderBy: { capturadoEn: 'desc' },
        ...paginar(filtros),
      }),
      this.prisma.recepcion.count({ where }),
    ]);

    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string): Promise<RecepcionDetalle> {
    const recepcion = await this.buscar(id);
    if (!recepcion) throw new NotFoundException('Recepción no encontrada');
    return recepcion;
  }

  // Idempotente: el id lo genera el cliente. Si ya existe, no se duplica ni se modifica:
  // se devuelve la recepción existente (creada = false) y no se emite otro QR.
  async crear(dto: CrearRecepcionDto, usuarioId: string) {
    const existente = await this.buscar(dto.id);
    if (existente) return { creada: false, recepcion: existente, qr: null };

    const { bruto, tara, neto } = this.calcularPesos(dto.pesoBrutoKg, dto.taraKg);
    await this.verificarFinca(dto.productorId, dto.fincaId);

    try {
      // Recepción, primer pesaje y token QR se guardan juntos o no se guarda nada.
      const qr = await this.prisma.$transaction(async (tx) => {
        await tx.recepcion.create({
          data: {
            id: dto.id,
            centroId: dto.centroId,
            productorId: dto.productorId,
            fincaId: dto.fincaId,
            estadoProducto: dto.estadoProducto,
            pesoBrutoKg: bruto,
            taraKg: tara,
            pesoNetoKg: neto,
            humedadPct: dto.humedadPct,
            observaciones: dto.observaciones,
            capturadoEn: new Date(dto.capturadoEn),
            registradoPorId: usuarioId,
          },
        });
        await tx.recepcionPesaje.create({
          data: {
            recepcionId: dto.id,
            pesoBrutoKg: bruto,
            taraKg: tara,
            pesoNetoKg: neto,
            motivo: 'Pesaje inicial',
            registradoPorId: usuarioId,
          },
        });
        const token = await this.tokens.crear(
          {
            proposito: 'QR_RECEPCION',
            entidadTipo: 'recepcion',
            entidadId: dto.id,
            creadoPorId: usuarioId,
          },
          tx,
        );
        return { valor: token.valor, url: this.tokens.urlQr(token.valor) } satisfies QrEmitido;
      });

      return { creada: true, recepcion: await this.obtener(dto.id), qr };
    } catch (error) {
      // Dos peticiones con el mismo id a la vez: la segunda recibe la ya creada.
      if (this.esErrorPrisma(error, 'P2002')) {
        const existente = await this.buscar(dto.id);
        if (existente) return { creada: false, recepcion: existente, qr: null };
      }
      this.traducirError(error);
    }
  }

  // Agrega un pesaje al histórico y deja el nuevo como peso vigente de la recepción.
  async registrarPesaje(id: string, dto: RegistrarPesajeDto, usuarioId: string) {
    const recepcion = await this.prisma.recepcion.findUnique({
      where: { id },
      select: { id: true, liquidacion: { select: { id: true } }, _count: { select: { lotes: true } } },
    });
    if (!recepcion) throw new NotFoundException('Recepción no encontrada');
    if (recepcion.liquidacion) {
      throw new ConflictException('La recepción ya fue liquidada: su peso no se puede modificar');
    }
    if (recepcion._count.lotes > 0) {
      throw new ConflictException('La recepción ya forma parte de un lote: su peso no se puede modificar');
    }

    const { bruto, tara, neto } = this.calcularPesos(dto.pesoBrutoKg, dto.taraKg);

    await this.prisma.$transaction([
      this.prisma.recepcionPesaje.create({
        data: {
          recepcionId: id,
          pesoBrutoKg: bruto,
          taraKg: tara,
          pesoNetoKg: neto,
          motivo: dto.motivo,
          registradoPorId: usuarioId,
        },
      }),
      this.prisma.recepcion.update({
        where: { id },
        data: { pesoBrutoKg: bruto, taraKg: tara, pesoNetoKg: neto },
      }),
    ]);

    return this.obtener(id);
  }

  // El valor del QR solo existe al crearlo (en la base solo queda su hash). Para
  // reimprimir un comprobante se revoca el QR anterior y se emite uno nuevo.
  async regenerarQr(id: string, usuarioId: string): Promise<QrEmitido> {
    const existe = await this.prisma.recepcion.count({ where: { id } });
    if (!existe) throw new NotFoundException('Recepción no encontrada');

    return this.prisma.$transaction(async (tx) => {
      await this.tokens.revocarPorEntidad('recepcion', id, 'QR_RECEPCION', tx);
      const token = await this.tokens.crear(
        { proposito: 'QR_RECEPCION', entidadTipo: 'recepcion', entidadId: id, creadoPorId: usuarioId },
        tx,
      );
      return { valor: token.valor, url: this.tokens.urlQr(token.valor) };
    });
  }

  private buscar(id: string) {
    return this.prisma.recepcion.findUnique({ where: { id }, select: CAMPOS_DETALLE });
  }

  // El servidor calcula el neto: nunca se confía en el que mande el cliente.
  // Regla de la base de datos: peso_neto > 0 y peso_neto = peso_bruto - tara.
  private calcularPesos(pesoBrutoKg: number, taraKg?: number) {
    const bruto = new Prisma.Decimal(pesoBrutoKg);
    const tara = new Prisma.Decimal(taraKg ?? 0);
    const neto = bruto.minus(tara);
    if (neto.lte(0)) throw new BadRequestException('La tara debe ser menor que el peso bruto');
    return { bruto, tara, neto };
  }

  private async verificarFinca(productorId: string, fincaId: string) {
    const finca = await this.prisma.finca.findUnique({
      where: { id: fincaId },
      select: { productorId: true },
    });
    if (!finca) throw new BadRequestException('La finca indicada no existe');
    if (finca.productorId !== productorId) {
      throw new BadRequestException('La finca no pertenece al productor indicado');
    }
  }

  private esErrorPrisma(error: unknown, codigo: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === codigo;
  }

  private traducirError(error: unknown): never {
    // P2003: llave foránea inexistente (centro o productor que no existe).
    if (this.esErrorPrisma(error, 'P2003')) {
      throw new BadRequestException('El centro, productor o finca indicado no existe');
    }
    throw error;
  }
}
