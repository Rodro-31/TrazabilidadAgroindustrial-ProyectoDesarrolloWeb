import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

// Envío de correo por SMTP. Si SMTP_HOST no está configurado, el envío se omite (queda
// un aviso en los logs, sin el contenido del correo) y la recuperación se hace con el
// enlace que genera el administrador desde la pantalla Usuarios.
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporte: Transporter | null = null;

  get configurado(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  async enviar(para: string, asunto: string, texto: string, html: string): Promise<boolean> {
    if (!this.configurado) {
      this.logger.warn('SMTP_HOST no está configurado: no se envió el correo de recuperación.');
      return false;
    }
    try {
      await this.cliente().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: para,
        subject: asunto,
        text: texto,
        html,
      });
      return true;
    } catch (error) {
      // No se propaga: la respuesta al usuario es la misma exista o no el correo.
      this.logger.error('No se pudo enviar el correo de recuperación', (error as Error)?.message);
      return false;
    }
  }

  private cliente(): Transporter {
    if (!this.transporte) {
      const puerto = Number(process.env.SMTP_PORT ?? 587);
      this.transporte = createTransport({
        host: process.env.SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    }
    return this.transporte;
  }
}
