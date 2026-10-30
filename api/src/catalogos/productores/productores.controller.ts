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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActualizarProductorDto } from './dto/actualizar-productor.dto';
import { CrearProductorDto } from './dto/crear-productor.dto';
import { ListarProductoresDto } from './dto/listar-productores.dto';
import { ProductoresService } from './productores.service';

// Todas las rutas exigen sesión (JwtAuthGuard global).
// Las que modifican datos además exigen rol (@Roles + RolesGuard global).
@ApiTags('productores')
@ApiBearerAuth()
@Controller('productores')
export class ProductoresController {
  constructor(private readonly productores: ProductoresService) {}

  // GET /api/v1/productores?buscar=juan&pagina=1&limite=20
  @Get()
  listar(@Query() filtros: ListarProductoresDto) {
    return this.productores.listar(filtros);
  }

  // GET /api/v1/productores/:id
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.productores.obtener(id);
  }

  // GET /api/v1/productores/:id/recepciones?limite=10
  @Get(':id/recepciones')
  recepciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limite', new DefaultValuePipe(10), ParseIntPipe) limite: number,
  ) {
    return this.productores.recepcionesRecientes(id, limite);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  crear(@Body() dto: CrearProductorDto) {
    return this.productores.crear(dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarProductorDto) {
    return this.productores.actualizar(id, dto);
  }

  // DELETE desactiva (soft delete), no borra el registro.
  @Roles('ADMIN')
  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.productores.desactivar(id);
  }
}
