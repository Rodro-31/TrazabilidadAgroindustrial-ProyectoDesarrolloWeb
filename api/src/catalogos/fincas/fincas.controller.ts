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
import { ActualizarFincaDto } from './dto/actualizar-finca.dto';
import { CrearFincaDto } from './dto/crear-finca.dto';
import { ListarFincasDto } from './dto/listar-fincas.dto';
import { FincasService } from './fincas.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('fincas')
@ApiBearerAuth()
@Auditar('finca')
@Controller('fincas')
export class FincasController {
  constructor(private readonly fincas: FincasService) {}

  // GET /api/v1/fincas?buscar=...&roble=1&limite=20
  @ApiOperation({ summary: 'Listar fincas (búsqueda, filtros y paginación); filtro por productor' })
  @Get()
  listar(@Query() filtros: ListarFincasDto) {
    return this.fincas.listar(filtros);
  }

  // GET /api/v1/fincas/:id
  @ApiOperation({ summary: 'Detalle de una finca' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.fincas.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear una finca' })
  @Post()
  crear(@Body() dto: CrearFincaDto) {
    return this.fincas.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Editar una finca' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarFincaDto) {
    return this.fincas.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar una finca (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.fincas.desactivar(id);
  }
}
