import { Injectable } from '@nestjs/common';
import { Prisma, PropositoToken } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

export type ResultadoToken = 'VALIDO' | 'EXPIRADO' | 'USADO' | 'REVOCADO' | 'INEXISTENTE';

export interface ContextoToken {
  usuarioId?: string | null;
  ip?: string;
  userAgent?: string;
}

export interface TokenResuelto {
  id: string;
  proposito: PropositoToken;
  entidadTipo: string;
  entidadId: string;
}

// Acepta el PrismaService normal o el cliente de una transacción ($transaction).
type Cliente = PrismaService | Prisma.TransactionClient;

function hashear(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

// Servicio de tokens de todo el sistema (QR de lotes y recepciones, confirmación de
// traslados, recuperación de contraseña). El valor aleatorio solo existe en el momento
// de crearlo; en la base de datos se guarda únicamente su hash SHA-256.
@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    datos: {
      proposito: PropositoToken;
      entidadTipo: string;
      entidadId: string;
      expiraEn?: Date | null; // null = no expira (QR de lote o recepción)
      creadoPorId?: string | null;
    },
    cliente: Cliente = this.prisma,
  ): Promise<{ id: string; valor: string }> {
    const valor = randomBytes(32).toString('base64url');
    const token = await cliente.token.create({
      data: {
        valorHash: hashear(valor),
        proposito: datos.proposito,
        entidadTipo: datos.entidadTipo,
        entidadId: datos.entidadId,
        expiraEn: datos.expiraEn ?? null,
        creadoPorId: datos.creadoPorId ?? null,
      },
      select: { id: true },
    });
    return { id: token.id, valor };
  }

  // Siempre deja un registro de auditoría, también cuando el token no existe.
  // En la auditoría nunca se guarda el valor del token, solo su id y el resultado.
  async validar(
    valor: string,
    proposito: PropositoToken | PropositoToken[],
    contexto: ContextoToken = {},
  ): Promise<{ resultado: ResultadoToken; token: TokenResuelto | null }> {
    const propositos = Array.isArray(proposito) ? proposito : [proposito];

    let token: TokenResuelto | null = null;
    let resultado: ResultadoToken = 'INEXISTENTE';

    if (typeof valor === 'string' && valor.length > 0 && valor.length <= 200) {
      const fila = await this.prisma.token.findUnique({
        where: { valorHash: hashear(valor) },
      });
      // Un token con otro propósito se trata como inexistente (no se revela que existe).
      if (fila && propositos.includes(fila.proposito)) {
        token = {
          id: fila.id,
          proposito: fila.proposito,
          entidadTipo: fila.entidadTipo,
          entidadId: fila.entidadId,
        };
        if (fila.revocadoEn) resultado = 'REVOCADO';
        else if (fila.usadoEn) resultado = 'USADO';
        else if (fila.expiraEn && fila.expiraEn <= new Date()) resultado = 'EXPIRADO';
        else resultado = 'VALIDO';
      }
    }

    await this.prisma.auditoria.create({
      data: {
        usuarioId: contexto.usuarioId ?? null,
        accion: 'TOKEN_VALIDADO',
        entidad: 'token',
        entidadId: token?.id ?? null,
        despues: { propositos, resultado },
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      },
    });

    return { resultado, token };
  }

  // Uso único. La condición va en el WHERE para que sea atómico: si dos peticiones
  // intentan usar el mismo token a la vez, solo una de ellas lo logra.
  async marcarUsado(id: string): Promise<boolean> {
    const { count } = await this.prisma.token.updateMany({
      where: {
        id,
        usadoEn: null,
        revocadoEn: null,
        OR: [{ expiraEn: null }, { expiraEn: { gt: new Date() } }],
      },
      data: { usadoEn: new Date() },
    });
    return count === 1;
  }

  async revocar(id: string): Promise<boolean> {
    const { count } = await this.prisma.token.updateMany({
      where: { id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    return count === 1;
  }

  // Revoca los tokens vigentes de una entidad (por ejemplo, antes de reimprimir un QR).
  async revocarPorEntidad(
    entidadTipo: string,
    entidadId: string,
    proposito: PropositoToken,
    cliente: Cliente = this.prisma,
  ): Promise<number> {
    const { count } = await cliente.token.updateMany({
      where: { entidadTipo, entidadId, proposito, revocadoEn: null, usadoEn: null },
      data: { revocadoEn: new Date() },
    });
    return count;
  }

  // URL que se codifica en el QR. Solo contiene el valor aleatorio: sin IDs ni datos
  // personales. Devuelve null si PWA_URL no está configurada.
  urlQr(valor: string): string | null {
    const base = process.env.PWA_URL?.replace(/\/+$/, '');
    return base ? `${base}/q/${valor}` : null;
  }
}
