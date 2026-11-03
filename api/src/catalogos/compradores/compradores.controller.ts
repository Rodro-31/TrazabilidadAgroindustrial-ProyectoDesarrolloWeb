import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../../auditoria/auditar.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompradoresService } from './compradores.service';
import { ActualizarCompradorDto } from './dto/actualizar-comprador.dto';
import { CrearCompradorDto } from './dto/crear-comprador.dto';
import { ListarCompradoresDto } from './dto/listar-compradores.dto';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('compradores')
@ApiBearerAuth()
@Auditar('comprador')
@Controller('compradores')
export class CompradoresController {
  constructor(private readonly compradores: CompradoresService) {}

  // GET /api/v1/compradores?buscar=spice&pais=Arabia%20Saudita&activo=true
  @ApiOperation({ summary: 'Listar compradores (búsqueda, filtros y paginación)' })
  @Get()
  listar(@Query() filtros: ListarCompradoresDto) {
    return this.compradores.listar(filtros);
  }

  // GET /api/v1/compradores/:id (incluye cuántas ventas tiene)
  @ApiOperation({ summary: 'Detalle de un comprador' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.compradores.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear un comprador' })
  @Post()
  crear(@Body() dto: CrearCompradorDto) {
    return this.compradores.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Editar un comprador' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCompradorDto) {
    return this.compradores.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar un comprador (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.compradores.desactivar(id);
  }
}
