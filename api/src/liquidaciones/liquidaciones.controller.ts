import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CalcularLiquidacionDto, ListarLiquidacionesDto } from './dto/liquidaciones.dto';
import { LiquidacionesService } from './liquidaciones.service';

type Usuario = { sub: string; rol: string };

// Liquidaciones a productores: kg recibidos × precio vigente (por producto y grado).
// Montos de dinero: solo los ven ADMIN, SUPERVISOR y AUDITOR.
@ApiTags('liquidaciones')
@ApiBearerAuth()
@Auditar('liquidacion')
@Roles('ADMIN', 'SUPERVISOR', 'AUDITOR')
@Controller('liquidaciones')
export class LiquidacionesController {
  constructor(private readonly liquidaciones: LiquidacionesService) {}

  // GET /api/v1/liquidaciones?estado=BORRADOR&productorId=...
  @ApiOperation({ summary: 'Listar liquidaciones (filtros por estado y productor)' })
  @Get()
  listar(@Query() filtros: ListarLiquidacionesDto) {
    return this.liquidaciones.listar(filtros);
  }

  // Vista previa sin guardar. Va ANTES de ':id' para que "calcular" no se tome como id.
  // GET /api/v1/liquidaciones/calcular?productorId=...&periodoInicio=2026-10-01&periodoFin=2026-10-31
  @ApiOperation({ summary: 'Vista previa de la liquidación de un productor en un período (no guarda nada)' })
  @Get('calcular')
  calcular(@Query() dto: CalcularLiquidacionDto) {
    return this.liquidaciones.calcular(dto);
  }

  @ApiOperation({ summary: 'Detalle de una liquidación con sus recepciones' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.liquidaciones.obtener(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear la liquidación en BORRADOR con las recepciones que tienen precio' })
  @Post()
  crear(@Body() dto: CalcularLiquidacionDto, @UsuarioActual() usuario: Usuario) {
    return this.liquidaciones.crear(dto, usuario.sub);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aprobar una liquidación (debe hacerlo una persona distinta de quien la creó)' })
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: Usuario) {
    return this.liquidaciones.aprobar(id, usuario.sub);
  }

  // Pagar mueve dinero: solo ADMIN.
  @Roles('ADMIN')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar el pago de una liquidación aprobada (solo ADMIN)' })
  @Post(':id/pagar')
  pagar(@Param('id', ParseUUIDPipe) id: string) {
    return this.liquidaciones.pagar(id);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Anular una liquidación no pagada: sus recepciones quedan libres' })
  @Post(':id/anular')
  anular(@Param('id', ParseUUIDPipe) id: string) {
    return this.liquidaciones.anular(id);
  }
}
