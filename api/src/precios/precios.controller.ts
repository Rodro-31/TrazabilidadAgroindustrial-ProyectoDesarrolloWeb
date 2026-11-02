import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CrearPrecioDto, ListarPreciosDto } from './dto/precios.dto';
import { PreciosService } from './precios.service';

type Usuario = { sub: string; rol: string };

// No hay PATCH ni DELETE: un precio no se edita (las liquidaciones se calcularon con él).
// Para cambiarlo se crea uno nuevo, que cierra al anterior y queda todo en el historial.
@ApiTags('precios')
@ApiBearerAuth()
@Auditar('precio')
@Roles('ADMIN', 'SUPERVISOR', 'AUDITOR')
@Controller('precios')
export class PreciosController {
  constructor(private readonly precios: PreciosService) {}

  // GET /api/v1/precios?vigentes=true&estadoProducto=PERGAMINO
  @Get()
  listar(@Query() filtros: ListarPreciosDto) {
    return this.precios.listar(filtros);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  crear(@Body() dto: CrearPrecioDto, @UsuarioActual() usuario: Usuario) {
    return this.precios.crear(dto, usuario.sub);
  }

  @Roles('ADMIN')
  @HttpCode(200)
  @Post(':id/cerrar')
  cerrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.precios.cerrar(id);
  }
}
