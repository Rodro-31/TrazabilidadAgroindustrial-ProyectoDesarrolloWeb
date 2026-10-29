import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  // Ruta: GET /api/v1/health (pública, la usa el monitoreo y el pipeline)
  @Public()
  @Get()
  estado() {
    return { estado: 'ok', fecha: new Date().toISOString() };
  }
}
