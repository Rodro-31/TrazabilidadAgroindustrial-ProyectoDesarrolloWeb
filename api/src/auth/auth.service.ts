import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
const DIAS_REFRESH = 7;
const MINUTOS_ACCESS = '15m';

function hashToken(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (!usuario || !usuario.activo) {
      await this.auditarLogin(null, 'LOGIN_FALLIDO', email, ip, userAgent);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente. Intenta más tarde.');
    }

    const coincide = await bcrypt.compare(password, usuario.passwordHash);

    if (!coincide) {
      const intentos = usuario.intentosFallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: bloquear ? 0 : intentos,
          bloqueadoHasta: bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null,
        },
      });
      await this.auditarLogin(usuario.id, 'LOGIN_FALLIDO', email, ip, userAgent);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    await this.auditarLogin(usuario.id, 'LOGIN_EXITOSO', email, ip, userAgent);

    return this.emitirTokens(usuario.id, usuario.rol);
  }

  // Rotación: el refresh token usado queda revocado y se emite uno nuevo.
  // Si llega un token ya revocado, es señal de robo: se revocan todas las sesiones del usuario.
  async refrescar(refreshToken: string) {
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: true },
    });

    if (!registro) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (registro.revocadoEn) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      throw new UnauthorizedException('Sesión revocada. Inicia sesión de nuevo.');
    }

    if (registro.expiraEn < new Date() || !registro.usuario.activo) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    await this.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { revocadoEn: new Date() },
    });

    return this.emitirTokens(registro.usuarioId, registro.usuario.rol);
  }

  async cerrarSesion(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  private async emitirTokens(usuarioId: string, rol: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: usuarioId, rol },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: MINUTOS_ACCESS },
    );

    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        usuarioId,
        tokenHash: hashToken(refreshToken),
        expiraEn: new Date(Date.now() + DIAS_REFRESH * 86_400_000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async auditarLogin(
    usuarioId: string | null,
    accion: string,
    email: string,
    ip?: string,
    userAgent?: string,
  ) {
    await this.prisma.auditoria.create({
      data: {
        usuarioId,
        accion,
        entidad: 'usuario',
        entidadId: usuarioId,
        despues: { email },
        ip,
        userAgent,
      },
    });
  }
}
