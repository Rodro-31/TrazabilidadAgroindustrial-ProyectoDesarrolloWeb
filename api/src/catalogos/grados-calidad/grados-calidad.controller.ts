import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../../auditoria/auditar.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarGradoCalidadDto } from './dto/actualizar-grado-calidad.dto';
import { CrearGradoCalidadDto } from './dto/crear-grado-calidad.dto';
import { ListarGradosCalidadDto } from './dto/listar-grados-calidad.dto';
import { GradosCalidadService } from './grados-calidad.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Los grados los define el área de calidad: CALIDAD puede crearlos y editarlos.
@ApiTags('grados-calidad')
@ApiBearerAuth()
@Auditar('gradoCalidad')
@Controller('grados-calidad')
export class GradosCalidadController {
  constructor(private readonly grados: GradosCalidadService) {}

  // GET /api/v1/grados-calidad?activo=true (ordenados por "orden")
  @ApiOperation({ summary: 'Listar grados de calidad (búsqueda, filtros y paginación)' })
  @Get()
  listar(@Query() filtros: ListarGradosCalidadDto) {
    return this.grados.listar(filtros);
  }

  // GET /api/v1/grados-calidad/:id (incluye cuántos lotes, inspecciones y precios lo usan)
  @ApiOperation({ summary: 'Detalle de un grado de calidad' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.grados.obtener(id);
  }

  @Roles('ADMIN', 'CALIDAD')
  @ApiOperation({ summary: 'Crear un grado de calidad' })
  @Post()
  crear(@Body() dto: CrearGradoCalidadDto) {
    return this.grados.crear(dto);
  }

  @Roles('ADMIN', 'CALIDAD')
  @ApiOperation({ summary: 'Editar un grado de calidad' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarGradoCalidadDto) {
    return this.grados.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar un grado de calidad (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.grados.desactivar(id);
  }
}
