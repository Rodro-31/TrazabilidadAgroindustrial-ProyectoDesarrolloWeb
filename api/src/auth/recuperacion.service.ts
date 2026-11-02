import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { CorreoService } from './correo.service';

export const MINUTOS_RECUPERACION = 30;
const COSTO_BCRYPT = 10;
const ENTIDAD = 'usuario';
const MENSAJE_INVALIDO = 'El enlace no es válido o ya expiró. Solicita uno nuevo.';

export interface Contexto {
  ip?: string;
  userAgent?: string;
  usuarioId?: string | null;
}

// Recuperación de contraseña con token de un solo uso que expira en 30 minutos.
// En la base solo se guarda el hash del token (TokensService); el valor viaja únicamente
// en el enlace. Pedir un enlace nuevo invalida el anterior.
@Injectable()
export class RecuperacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly correo: CorreoService,
  ) {}

  // Autoservicio: siempre termina igual, exista o no el correo, para no revelar qué
  // cuentas existen. Si la cuenta existe y está activa, se envía el enlace por correo.
  async solicitar(email: string, ctx: Contexto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nombre: true, email: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      await this.auditar('RECUPERACION_SOLICITADA', null, { email, existe: false }, ctx);
      return;
    }
    const { enlace } = await this.emitir(usuario.id, null);
    const enviado = await this.correo.enviar(
      usuario.email,
      'Recupera tu contraseña – Trazabilidad',
      `Hola ${usuario.nombre}:\n\nPara crear una contraseña nueva abre este enlace (vence en ${MINUTOS_RECUPERACION} minutos y sirve una sola vez):\n${enlace}\n\nSi no lo pediste, ignora este correo.`,
      `<p>Hola ${escapar(usuario.nombre)}:</p><p>Para crear una contraseña nueva abre este enlace (vence en ${MINUTOS_RECUPERACION} minutos y sirve una sola vez):</p><p><a href="${escapar(enlace)}">Crear contraseña nueva</a></p><p>Si no lo pediste, ignora este correo.</p>`,
    );
    await this.auditar('RECUPERACION_SOLICITADA', usuario.id, { email, correoEnviado: enviado }, ctx);
  }

  // El administrador genera el enlace para entregarlo por otro medio (sin depender del correo).
  async generarParaUsuario(usuarioId: string, ctx: Contexto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, activo: true } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.activo) throw new BadRequestException('La cuenta está desactivada. Actívala antes de generar el enlace.');
    const { enlace, expiraEn } = await this.emitir(usuario.id, ctx.usuarioId ?? null);
    await this.auditar('RECUPERACION_GENERADA_ADMIN', usuario.id, { generadoPor: ctx.usuarioId }, ctx);
    return { enlace, expiraEn };
  }

  // Cambia la contraseña con el token. Uso único y atómico: si dos peticiones llegan a la
  // vez, solo una lo consume. Levanta el bloqueo y cierra todas las sesiones abiertas.
  async restablecer(valor: string, password: string, ctx: Contexto): Promise<void> {
    const { resultado, token } = await this.tokens.validar(valor, 'RECUPERACION_PASSWORD', ctx);
    if (resultado !== 'VALIDO' || !token || token.entidadTipo !== ENTIDAD) {
      throw new BadRequestException(MENSAJE_INVALIDO);
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id: token.entidadId }, select: { activo: true } });
    if (!usuario?.activo) throw new BadRequestException(MENSAJE_INVALIDO);
    if (!(await this.tokens.marcarUsado(token.id))) throw new BadRequestException(MENSAJE_INVALIDO);

    const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: token.entidadId },
        data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { usuarioId: token.entidadId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      }),
    ]);
    await this.auditar('PASSWORD_RESTABLECIDA', token.entidadId, { medio: 'enlace' }, ctx);
  }

  private async emitir(usuarioId: string, creadoPorId: string | null) {
    await this.tokens.revocarPorEntidad(ENTIDAD, usuarioId, 'RECUPERACION_PASSWORD');
    const expiraEn = new Date(Date.now() + MINUTOS_RECUPERACION * 60_000);
    const { valor } = await this.tokens.crear({
      proposito: 'RECUPERACION_PASSWORD',
      entidadTipo: ENTIDAD,
      entidadId: usuarioId,
      expiraEn,
      creadoPorId,
    });
    // El token va después de "#": el navegador no lo envía al servidor, así no queda en
    // los logs de acceso de Caddy ni en el encabezado Referer.
    const base = (process.env.APP_URL ?? '').replace(/\/+$/, '');
    return { enlace: `${base}/restablecer#t=${valor}`, expiraEn };
  }

  // En la auditoría nunca va el token ni el enlace.
  private auditar(accion: string, usuarioId: string | null, despues: object, ctx: Contexto) {
    return this.prisma.auditoria.create({
      data: {
        usuarioId: ctx.usuarioId ?? usuarioId,
        accion,
        entidad: ENTIDAD,
        entidadId: usuarioId,
        despues,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  }
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
