import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../../auditoria/auditar.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarCentroDto } from './dto/actualizar-centro.dto';
import { CrearCentroDto } from './dto/crear-centro.dto';
import { ListarCentrosDto } from './dto/listar-centros.dto';
import { CentrosService } from './centros.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('centros')
@ApiBearerAuth()
@Auditar('centro')
@Controller('centros')
export class CentrosController {
  constructor(private readonly centros: CentrosService) {}

  // GET /api/v1/centros?buscar=coban&activo=true&pagina=1&limite=20
  @ApiOperation({ summary: 'Listar centros de acopio (búsqueda, filtros y paginación)' })
  @Get()
  listar(@Query() filtros: ListarCentrosDto) {
    return this.centros.listar(filtros);
  }

  // GET /api/v1/centros/:id
  @ApiOperation({ summary: 'Detalle de un centro de acopio' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.centros.obtener(id);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un centro de acopio' })
  @Post()
  crear(@Body() dto: CrearCentroDto) {
    return this.centros.crear(dto);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar un centro de acopio' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCentroDto) {
    return this.centros.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar un centro de acopio (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.centros.desactivar(id);
  }
}
