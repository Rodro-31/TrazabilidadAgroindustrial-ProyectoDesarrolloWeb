import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../../auditoria/auditar.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ListarOrganizacionesDto } from './dto/listar-organizaciones.dto';
import { OrganizacionesService } from './organizaciones.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('organizaciones')
@ApiBearerAuth()
@Auditar('organizacion')
@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizaciones: OrganizacionesService) {}

  // GET /api/v1/organizaciones?buscar=chisec&tipo=COOPERATIVA&activo=true
  @ApiOperation({ summary: 'Listar organizaciones (búsqueda, filtros y paginación)' })
  @Get()
  listar(@Query() filtros: ListarOrganizacionesDto) {
    return this.organizaciones.listar(filtros);
  }

  // GET /api/v1/organizaciones/:id (incluye sus productores activos)
  @ApiOperation({ summary: 'Detalle de una organización' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizaciones.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear una organización' })
  @Post()
  crear(@Body() dto: CrearOrganizacionDto) {
    return this.organizaciones.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Editar una organización' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarOrganizacionDto) {
    return this.organizaciones.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar una organización (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizaciones.desactivar(id);
  }
}
