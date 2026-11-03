import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

// Solo lectura: no lleva @Auditar (la auditoría registra cambios, no consultas).
// CAMPO trabaja en la PWA y no ve el panel.
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // GET /api/v1/dashboard
  @Roles('ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR')
  @ApiOperation({ summary: 'Resumen del dashboard con datos reales (existencias, lotes por estado, recepciones por día, procesos y merma)' })
  @Get()
  resumen() {
    return this.dashboard.resumen();
  }
}
