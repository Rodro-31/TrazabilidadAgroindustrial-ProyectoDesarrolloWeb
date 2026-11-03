import { Body, Controller, Get, Headers, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { EnlaceRecuperacionDto, RestablecerConTokenDto, SolicitarRecuperacionDto } from './dto/recuperacion.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RecuperacionService } from './recuperacion.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recuperacion: RecuperacionService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @ApiHeader({ name: 'user-agent', required: false })
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión con correo y contraseña. Devuelve access token (15 min) y refresh token (7 días). Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.auth.login(dto.email, dto.password, ip, userAgent);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Renueva la sesión: el refresh token usado se revoca y se emite uno nuevo. Reusar uno revocado cierra todas las sesiones.' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refrescar(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  @ApiOperation({ summary: 'Cierra la sesión revocando el refresh token.' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.cerrarSesion(dto.refreshToken);
  }

  // Siempre responde 204, exista o no la cuenta (no revela qué correos están registrados).
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(204)
  @Post('recuperar')
  @ApiOperation({ summary: 'Solicita un enlace de recuperación por correo (vence en 30 min, un solo uso). Responde 204 exista o no la cuenta.' })
  async recuperar(@Body() dto: SolicitarRecuperacionDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    await this.recuperacion.solicitar(dto.email, { ip, userAgent });
  }

  // Cambia la contraseña con el token del enlace (uso único, vence en 30 minutos).
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(204)
  @Post('restablecer')
  @ApiOperation({ summary: 'Fija una contraseña nueva con el token del enlace. Levanta el bloqueo y cierra todas las sesiones.' })
  async restablecer(@Body() dto: RestablecerConTokenDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    await this.recuperacion.restablecer(dto.token, dto.password, { ip, userAgent });
  }

  // El administrador genera un enlace de recuperación para entregarlo por otro medio.
  @ApiBearerAuth()
  @Roles('ADMIN')
  @HttpCode(200)
  @Post('recuperar/enlace')
  @ApiOperation({ summary: 'ADMIN: genera el enlace de recuperación de un usuario para entregarlo por otro medio.' })
  enlace(
    @Body() dto: EnlaceRecuperacionDto,
    @UsuarioActual() actor: { sub: string },
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.recuperacion.generarParaUsuario(dto.usuarioId, { usuarioId: actor.sub, ip, userAgent });
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Devuelve el id y el rol del usuario de la sesión.' })
  yo(@UsuarioActual() usuario: { sub: string; rol: string }) {
    return { id: usuario.sub, rol: usuario.rol };
  }
}
