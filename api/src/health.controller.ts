import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Ruta: GET /api/v1/health
  // TODO (Victor): marcar con @Public() cuando exista JwtAuthGuard global.
  @Get()
  estado() {
    return { estado: 'ok', fecha: new Date().toISOString() };
  }
}
