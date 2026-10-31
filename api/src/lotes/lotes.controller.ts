import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
@ApiTags('lotes')
@ApiBearerAuth()
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  // GET /api/v1/lotes?centroId=...&estado=ACTIVO&estadoProducto=UVA&cosecha=2026
  @Get()
  listar(@Query() filtros: ListarLotesDto) {
    return this.lotes.listar(filtros);
  }

  // Va ANTES de ':id': si no, Nest interpretaría "recepciones-disponibles" como un id.
  // GET /api/v1/lotes/recepciones-disponibles?centroId=...&estadoProducto=UVA
  @Get('recepciones-disponibles')
  recepcionesDisponibles(@Query() filtros: RecepcionesDisponiblesDto) {
    return this.lotes.recepcionesDisponibles(filtros);
  }

  // GET /api/v1/lotes/:id (origen, existencias e historial de estados)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @Post()
  crear(@Body() dto: CrearLoteDto, @UsuarioActual() usuario: Usuario) {
    return this.lotes.crear(dto, usuario.sub);
  }

  // POST porque es una acción con efectos (no un simple cambio de campos);
  // 200 y no 201 porque no crea un recurso nuevo.
  @Roles('ADMIN', 'SUPERVISOR')
  @HttpCode(200)
  @Post(':id/anular')
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularLoteDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.lotes.anular(id, dto.motivo, usuario.sub);
  }
}
