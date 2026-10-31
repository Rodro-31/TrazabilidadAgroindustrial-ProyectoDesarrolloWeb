import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto';
import { ListarOrganizacionesDto } from './dto/listar-organizaciones.dto';
import { OrganizacionesService } from './organizaciones.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('organizaciones')
@ApiBearerAuth()
@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizaciones: OrganizacionesService) {}

  // GET /api/v1/organizaciones?buscar=chisec&tipo=COOPERATIVA&activo=true
  @Get()
  listar(@Query() filtros: ListarOrganizacionesDto) {
    return this.organizaciones.listar(filtros);
  }

  // GET /api/v1/organizaciones/:id (incluye sus productores activos)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizaciones.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  crear(@Body() dto: CrearOrganizacionDto) {
    return this.organizaciones.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarOrganizacionDto) {
    return this.organizaciones.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizaciones.desactivar(id);
  }
}
