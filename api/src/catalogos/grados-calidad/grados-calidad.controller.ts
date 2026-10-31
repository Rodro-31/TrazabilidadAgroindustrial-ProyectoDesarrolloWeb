import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarGradoCalidadDto } from './dto/actualizar-grado-calidad.dto';
import { CrearGradoCalidadDto } from './dto/crear-grado-calidad.dto';
import { ListarGradosCalidadDto } from './dto/listar-grados-calidad.dto';
import { GradosCalidadService } from './grados-calidad.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Los grados los define el área de calidad: CALIDAD puede crearlos y editarlos.
@ApiTags('grados-calidad')
@ApiBearerAuth()
@Controller('grados-calidad')
export class GradosCalidadController {
  constructor(private readonly grados: GradosCalidadService) {}

  // GET /api/v1/grados-calidad?activo=true (ordenados por "orden")
  @Get()
  listar(@Query() filtros: ListarGradosCalidadDto) {
    return this.grados.listar(filtros);
  }

  // GET /api/v1/grados-calidad/:id (incluye cuántos lotes, inspecciones y precios lo usan)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.grados.obtener(id);
  }

  @Roles('ADMIN', 'CALIDAD')
  @Post()
  crear(@Body() dto: CrearGradoCalidadDto) {
    return this.grados.crear(dto);
  }

  @Roles('ADMIN', 'CALIDAD')
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarGradoCalidadDto) {
    return this.grados.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.grados.desactivar(id);
  }
}
