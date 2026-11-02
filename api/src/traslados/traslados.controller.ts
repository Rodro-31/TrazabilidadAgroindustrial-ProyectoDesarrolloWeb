import { Body, Controller, Get, Headers, HttpCode, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  @Get()
  listar(@Query() filtros: ListarTrasladosDto) {
    return this.traslados.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.traslados.obtener(id);
  }

  // Responde el traslado y el código de confirmación (se muestra una sola vez).
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @Post()
  crear(@Body() dto: CrearTrasladoDto, @UsuarioActual() usuario: Usuario) {
    return this.traslados.crear(dto, usuario.sub);
  }

  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @HttpCode(200)
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
  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelarTrasladoDto, @UsuarioActual() usuario: Usuario) {
    return this.traslados.cancelar(id, dto.motivo, usuario.sub);
  }
}
