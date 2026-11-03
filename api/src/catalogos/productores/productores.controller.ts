import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../../auditoria/auditar.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import { ActualizarProductorDto } from './dto/actualizar-productor.dto';
import { CrearProductorDto } from './dto/crear-productor.dto';
import { ListarProductoresDto } from './dto/listar-productores.dto';
import { ProductoresService } from './productores.service';

type Usuario = { sub: string; rol: string };

// Los mismos roles que pueden crear y editar productores.
const ROLES_DPI = ['ADMIN', 'SUPERVISOR'];

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('productores')
@ApiBearerAuth()
@Auditar('productor')
@Controller('productores')
export class ProductoresController {
  constructor(private readonly productores: ProductoresService) {}

  // GET /api/v1/productores?buscar=juan&pagina=1&limite=20
  @ApiOperation({ summary: 'Listar productores (búsqueda, filtros y paginación)' })
  @Get()
  listar(@Query() filtros: ListarProductoresDto) {
    return this.productores.listar(filtros);
  }

  // GET /api/v1/productores/:id (el DPI solo para ADMIN y SUPERVISOR)
  @ApiOperation({ summary: 'Detalle de un productor con sus fincas (el DPI solo para ADMIN y SUPERVISOR)' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    return this.productores.obtener(id, ROLES_DPI.includes(usuario.rol));
  }

  // GET /api/v1/productores/:id/recepciones?limite=10
  @ApiOperation({ summary: 'Entregas recientes de un productor' })
  @Get(':id/recepciones')
  recepciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limite', new DefaultValuePipe(10), ParseIntPipe) limite: number,
  ) {
    return this.productores.recepcionesRecientes(id, limite);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear un productor' })
  @Post()
  crear(@Body() dto: CrearProductorDto) {
    return this.productores.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Editar un productor' })
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarProductorDto) {
    return this.productores.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar un productor (no se borra: conserva su historial)' })
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.productores.desactivar(id);
  }
}
