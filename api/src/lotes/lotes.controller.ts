import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { AnularLoteDto } from './dto/anular-lote.dto';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { ListarLotesDto } from './dto/listar-lotes.dto';
import { RecepcionesDisponiblesDto } from './dto/recepciones-disponibles.dto';
import { LotesService } from './lotes.service';

// Payload del JWT que deja JwtAuthGuard en la petición: sub = id del usuario.
type Usuario = { sub: string; rol: string };

// No hay PATCH ni DELETE: un lote no se edita a mano. Cambia solo por operaciones
// (traslados, procesos, ventas) o se anula con motivo, y todo queda en el historial.
// @Auditar('lote'): nombre del modelo de Prisma, para que la auditoría guarde el estado
// del lote ANTES de cada operación (la ruta "lotes" no coincide con el modelo "lote").
@ApiTags('lotes')
@ApiBearerAuth()
@Auditar('lote')
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  // GET /api/v1/lotes?centroId=...&estado=ACTIVO&estadoProducto=UVA&cosecha=2026
  @ApiOperation({ summary: 'Listar lotes y su existencia (filtros por centro, estado, producto, grado y cosecha)' })
  @Get()
  listar(@Query() filtros: ListarLotesDto) {
    return this.lotes.listar(filtros);
  }

  // Va ANTES de ':id': si no, Nest interpretaría "recepciones-disponibles" como un id.
  // GET /api/v1/lotes/recepciones-disponibles?centroId=...&estadoProducto=UVA
  @ApiOperation({ summary: 'Recepciones de un centro con kg todavía sin asignar a un lote' })
  @Get('recepciones-disponibles')
  recepcionesDisponibles(@Query() filtros: RecepcionesDisponiblesDto) {
    return this.lotes.recepcionesDisponibles(filtros);
  }

  // GET /api/v1/lotes/:id (origen, existencias e historial de estados)
  @ApiOperation({ summary: 'Detalle del lote: origen, existencias, relación con otros lotes e historial de estados' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.obtener(id);
  }

  // GET /api/v1/lotes/:id/movimientos (kárdex: entradas y salidas de inventario)
  @ApiOperation({ summary: 'Kárdex del lote: entradas y salidas de inventario con su saldo' })
  @Get(':id/movimientos')
  movimientos(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.movimientos(id);
  }

  // GET /api/v1/lotes/:id/trazabilidad (hacia atrás y hacia adelante)
  @ApiOperation({ summary: 'Trazabilidad del lote hacia atrás (productores y fincas) y hacia adelante (lotes derivados y ventas)' })
  @Get(':id/trazabilidad')
  trazabilidad(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.trazabilidad(id);
  }

  // Responde el lote y su QR ({ valor, url }) para imprimir la etiqueta.
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @ApiOperation({ summary: 'Crear un lote a partir de recepciones (genera su código y su QR)' })
  @Post()
  crear(@Body() dto: CrearLoteDto, @UsuarioActual() usuario: Usuario) {
    return this.lotes.crear(dto, usuario.sub);
  }

  // POST /api/v1/lotes/:id/qr  (reimprimir etiqueta: revoca el QR anterior)
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @ApiOperation({ summary: 'Reimprimir la etiqueta: revoca el QR anterior y emite uno nuevo' })
  @Post(':id/qr')
  regenerarQr(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    return this.lotes.regenerarQr(id, usuario.sub);
  }

  // POST porque es una acción con efectos (no un simple cambio de campos);
  // 200 y no 201 porque no crea un recurso nuevo.
  @Roles('ADMIN', 'SUPERVISOR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Anular un lote activo sin movimientos posteriores (con motivo)' })
  @Post(':id/anular')
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularLoteDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.lotes.anular(id, dto.motivo, usuario.sub);
  }
}
