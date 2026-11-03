import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Auditar } from '../auditoria/auditar.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CrearRecepcionDto } from './dto/crear-recepcion.dto';
import { ListarRecepcionesDto } from './dto/listar-recepciones.dto';
import { RegistrarPesajeDto } from './dto/registrar-pesaje.dto';
import { RecepcionesService } from './recepciones.service';

type UsuarioJwt = { sub: string; rol: string };

// Todas las rutas exigen sesión (JwtAuthGuard global). Crear y pesar exigen rol.
@ApiTags('recepciones')
@ApiBearerAuth()
@Auditar('recepcion')
@Controller('recepciones')
export class RecepcionesController {
  constructor(private readonly recepciones: RecepcionesService) {}

  // GET /api/v1/recepciones?centroId=&productorId=&estadoProducto=&desde=&hasta=&pagina=1&limite=20
  @Get()
  @ApiOperation({ summary: 'Lista recepciones con filtros (centro, productor, producto, fechas) y paginación.' })
  listar(@Query() filtros: ListarRecepcionesDto) {
    return this.recepciones.listar(filtros);
  }

  // GET /api/v1/recepciones/:id
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una recepción con su historial de pesajes.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.recepciones.obtener(id);
  }

  // POST /api/v1/recepciones  (idempotente por id)
  // 201 = creada (incluye el QR, que solo se muestra esta vez) · 200 = ya existía.
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA', 'CAMPO')
  @Post()
  @ApiOperation({ summary: 'Registra una recepción. Reintentar con el mismo id no duplica.' })
  async crear(
    @Body() dto: CrearRecepcionDto,
    @UsuarioActual() usuario: UsuarioJwt,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { creada, recepcion, qr } = await this.recepciones.crear(dto, usuario.sub);
    res.status(creada ? HttpStatus.CREATED : HttpStatus.OK);
    return { ...recepcion, qr };
  }

  // POST /api/v1/recepciones/:id/pesajes
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @Post(':id/pesajes')
  @ApiOperation({ summary: 'Registra un pesaje nuevo; el anterior queda en el historial. 409 si la recepción ya está en un lote o liquidada.' })
  registrarPesaje(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarPesajeDto,
    @UsuarioActual() usuario: UsuarioJwt,
  ) {
    return this.recepciones.registrarPesaje(id, dto, usuario.sub);
  }

  // POST /api/v1/recepciones/:id/qr  (reimprimir comprobante: revoca el QR anterior)
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA')
  @Post(':id/qr')
  @ApiOperation({ summary: 'Emite un QR nuevo y revoca el anterior' })
  regenerarQr(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioJwt) {
    return this.recepciones.regenerarQr(id, usuario.sub);
  }
}
