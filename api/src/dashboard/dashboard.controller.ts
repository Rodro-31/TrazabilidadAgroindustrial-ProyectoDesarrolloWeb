import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  @Get()
  resumen() {
    return this.dashboard.resumen();
  }
}
