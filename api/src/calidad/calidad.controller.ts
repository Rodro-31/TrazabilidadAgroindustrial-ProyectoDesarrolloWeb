import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CalidadService } from './calidad.service';
import { CrearInspeccionDto } from './dto/crear-inspeccion.dto';
import { ListarInspeccionesDto } from './dto/listar-inspecciones.dto';

// Las inspecciones no se editan ni se borran: una corrección es una inspección nueva.
// @Auditar('inspeccionCalidad'): nombre del modelo de Prisma.
@ApiTags('calidad')
@ApiBearerAuth()
@Auditar('inspeccionCalidad')
@Controller('calidad/inspecciones')
export class CalidadController {
  constructor(private readonly calidad: CalidadService) {}

  // GET /api/v1/calidad/inspecciones?recepcionId=...&loteId=...&aprobado=true
  @Get()
  @ApiOperation({ summary: 'Lista inspecciones de calidad, filtrando por recepción, lote o resultado.' })
  listar(@Query() filtros: ListarInspeccionesDto) {
    return this.calidad.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una inspección de calidad.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.calidad.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR', 'CALIDAD')
  @Post()
  @ApiOperation({ summary: 'Registra una inspección. Reintentar con el mismo id no duplica.' })
  async crear(
    @Body() dto: CrearInspeccionDto,
    @UsuarioActual() usuario: { sub: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { creada, inspeccion } = await this.calidad.crear(dto, usuario.sub);
    res.status(creada ? HttpStatus.CREATED : HttpStatus.OK);
    return inspeccion;
  }
}
