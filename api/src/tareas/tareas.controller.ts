import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { TareasService, type UsuarioJwt } from './tareas.service';

// Cualquier usuario con sesión consulta y completa SUS tareas (el filtro va en el service).
@ApiTags('tareas')
@ApiBearerAuth()
@Auditar('tarea')
@Controller('tareas')
export class TareasController {
  constructor(private readonly tareas: TareasService) {}

  // GET /api/v1/tareas/mias → pendientes del usuario, de su rol y de sus centros
  @Get('mias')
  mias(@UsuarioActual() usuario: UsuarioJwt) {
    return this.tareas.mias(usuario);
  }

  // POST /api/v1/tareas/:id/completar
  @HttpCode(200)
  @Post(':id/completar')
  completar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioJwt) {
    return this.tareas.completar(id, usuario);
  }
}
