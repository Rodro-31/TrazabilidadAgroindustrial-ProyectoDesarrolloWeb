import { Body, Controller, Get, Headers, HttpCode, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CancelarTrasladoDto, CrearTrasladoDto, ListarTrasladosDto, RecibirTrasladoDto } from './dto/traslados.dto';
import { TrasladosService } from './traslados.service';

type Usuario = { sub: string; rol: string };

// Traslado de un lote entre centros de acopio en dos pasos:
//   1. POST /traslados             despacha: el lote sale del origen y queda EN_TRANSITO
//   2. POST /traslados/:id/recibir el destino lo confirma con el código (token de uso único)
// Mientras está en tránsito se puede cancelar (el lote vuelve al origen).
@ApiTags('traslados')
@ApiBearerAuth()
@Auditar('traslado')
@Controller('traslados')
export class TrasladosController {
  constructor(private readonly traslados: TrasladosService) {}

  // GET /api/v1/traslados?estado=EN_TRANSITO&centroId=...&loteId=...
  @ApiOperation({ summary: 'Listar traslados (filtros por estado, lote y centro)' })
  @Get()
  listar(@Query() filtros: ListarTrasladosDto) {
    return this.traslados.listar(filtros);
  }

  @ApiOperation({ summary: 'Detalle de un traslado' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.traslados.obtener(id);
  }

  // Responde el traslado y el código de confirmación (se muestra una sola vez).
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @ApiOperation({ summary: 'Despachar un lote a otro centro: queda en tránsito y se emite un código de confirmación (vence en 72 h)' })
  @Post()
  crear(@Body() dto: CrearTrasladoDto, @UsuarioActual() usuario: Usuario) {
    return this.traslados.crear(dto, usuario.sub);
  }

  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recibir el traslado en el centro destino con su código de confirmación (uso único)' })
  @Post(':id/recibir')
  recibir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecibirTrasladoDto,
    @UsuarioActual() usuario: Usuario,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.traslados.recibir(id, dto, usuario, { ip, userAgent });
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar un traslado en tránsito: el lote vuelve al origen y el código se revoca' })
  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelarTrasladoDto, @UsuarioActual() usuario: Usuario) {
    return this.traslados.cancelar(id, dto.motivo, usuario.sub);
  }
}
