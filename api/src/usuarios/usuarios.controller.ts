import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { AsignarCentrosDto } from './dto/asignar-centros.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { UsuariosService } from './usuarios.service';

type UsuarioJwt = { sub: string; rol: string };

// Toda la gestión de cuentas es solo para ADMIN (JwtAuthGuard + RolesGuard globales).
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles('ADMIN')
@Auditar('usuario')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  // GET /api/v1/usuarios?buscar=&rol=&activo=&pagina=1&limite=20
  @Get()
  @ApiOperation({ summary: 'ADMIN: lista usuarios con filtros (texto, rol, activo) y paginación. Nunca devuelve el hash de la contraseña.' })
  listar(@Query() filtros: ListarUsuariosDto) {
    return this.usuarios.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ADMIN: detalle de un usuario con sus centros.' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'ADMIN: crea un usuario (la contraseña se guarda con bcrypt).' })
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  // Cambia nombre, rol o activo (desactivar no borra: la cuenta queda bloqueada para entrar).
  @Patch(':id')
  @ApiOperation({ summary: 'ADMIN: cambia nombre, rol o estado. Cambiar el rol o desactivar cierra sus sesiones; siempre queda un ADMIN activo.' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() actor: UsuarioJwt,
  ) {
    return this.usuarios.actualizar(id, dto, actor.sub);
  }

  // POST /api/v1/usuarios/:id/password  → fija una contraseña nueva y cierra sus sesiones
  @Post(':id/password')
  @ApiOperation({ summary: 'ADMIN: fija una contraseña nueva, levanta el bloqueo y cierra sus sesiones.' })
  restablecerPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RestablecerPasswordDto) {
    return this.usuarios.restablecerPassword(id, dto.password);
  }

  // PUT /api/v1/usuarios/:id/centros  { centroIds: [...] } → reemplaza sus centros de acopio
  @Put(':id/centros')
  @ApiOperation({ summary: 'ADMIN: reemplaza los centros de acopio asignados al usuario.' })
  asignarCentros(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AsignarCentrosDto) {
    return this.usuarios.asignarCentros(id, dto.centroIds);
  }

  // POST /api/v1/usuarios/:id/desbloquear  → levanta el bloqueo por intentos fallidos
  @Post(':id/desbloquear')
  @ApiOperation({ summary: 'ADMIN: levanta el bloqueo por intentos fallidos.' })
  desbloquear(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.desbloquear(id);
  }
}
