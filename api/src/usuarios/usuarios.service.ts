import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Paginado, paginar } from '../common/paginacion.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';

// Nunca se devuelve passwordHash ni el contador de intentos.
const CAMPOS = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  bloqueadoHasta: true,
  creadoEn: true,
} satisfies Prisma.UsuarioSelect;

type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof CAMPOS }>;

const COSTO_BCRYPT = 10;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarUsuariosDto): Promise<Paginado<UsuarioPublico>> {
    const where: Prisma.UsuarioWhereInput = {
      rol: filtros.rol,
      activo: filtros.activo,
      ...(filtros.buscar && {
        OR: [
          { nombre: { contains: filtros.buscar, mode: 'insensitive' } },
          { email: { contains: filtros.buscar, mode: 'insensitive' } },
        ],
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({ where, select: CAMPOS, orderBy: { nombre: 'asc' }, ...paginar(filtros) }),
      this.prisma.usuario.count({ where }),
    ]);
    return { datos, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  async obtener(id: string): Promise<UsuarioPublico> {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: CAMPOS });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioPublico> {
    const passwordHash = await bcrypt.hash(dto.password, COSTO_BCRYPT);
    try {
      return await this.prisma.usuario.create({
        data: { email: dto.email, nombre: dto.nombre, rol: dto.rol, passwordHash },
        select: CAMPOS,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw e;
    }
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, actorId: string): Promise<UsuarioPublico> {
    const actual = await this.obtener(id);
    const nuevoRol = dto.rol ?? actual.rol;
    const nuevoActivo = dto.activo ?? actual.activo;

    // Un administrador no puede quitarse el acceso a sí mismo por error.
    if (id === actorId && (nuevoRol !== actual.rol || nuevoActivo !== actual.activo)) {
      throw new BadRequestException('No puedes cambiar tu propio rol ni desactivar tu propia cuenta.');
    }
    // Siempre debe quedar al menos un administrador activo.
    const dejaDeSerAdminActivo = actual.rol === 'ADMIN' && actual.activo && (nuevoRol !== 'ADMIN' || !nuevoActivo);
    if (dejaDeSerAdminActivo) await this.exigirOtroAdminActivo(id);

    const usuario = await this.prisma.usuario.update({ where: { id }, data: dto, select: CAMPOS });
    // Desactivar o cambiar el rol cierra las sesiones abiertas: el refresh token deja de servir.
    if (nuevoRol !== actual.rol || !nuevoActivo) await this.revocarSesiones(id);
    return usuario;
  }

  // El administrador fija una contraseña nueva: se cierran las sesiones y se levanta el bloqueo.
  async restablecerPassword(id: string, password: string): Promise<{ ok: true }> {
    await this.obtener(id);
    const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT);
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await this.revocarSesiones(id);
    return { ok: true };
  }

  async desbloquear(id: string): Promise<UsuarioPublico> {
    await this.obtener(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
      select: CAMPOS,
    });
  }

  private async exigirOtroAdminActivo(excluirId: string) {
    const otros = await this.prisma.usuario.count({
      where: { rol: 'ADMIN', activo: true, id: { not: excluirId } },
    });
    if (otros === 0) throw new BadRequestException('Debe quedar al menos un administrador activo.');
  }

  private revocarSesiones(usuarioId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }
}
