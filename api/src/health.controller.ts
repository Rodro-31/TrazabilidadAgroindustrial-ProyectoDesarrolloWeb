import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // Ruta: GET /api/v1/health (pública, la usa el monitoreo y el pipeline)
  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado de la API (público). Lo usan el monitoreo y el pipeline.' })
  estado() {
    return { estado: 'ok', fecha: new Date().toISOString() };
  }
}
