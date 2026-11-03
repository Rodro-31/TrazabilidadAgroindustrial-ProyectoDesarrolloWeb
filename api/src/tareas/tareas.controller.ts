import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Tareas pendientes del usuario: las suyas y las de su rol en sus centros (ADMIN y SUPERVISOR ven todas).' })
  mias(@UsuarioActual() usuario: UsuarioJwt) {
    return this.tareas.mias(usuario);
  }

  // POST /api/v1/tareas/:id/completar
  @HttpCode(200)
  @Post(':id/completar')
  @ApiOperation({ summary: 'Marca como completada una tarea visible para el usuario (la de inspección se cierra al registrar la inspección).' })
  completar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioJwt) {
    return this.tareas.completar(id, usuario);
  }
}
