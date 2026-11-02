import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { PrismaService } from '../common/prisma/prisma.service';

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por imagen
export const MAX_FOTOS_POR_RECEPCION = 5;
const ENTIDAD_RECEPCION = 'recepcion';

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// El tipo real se decide por los primeros bytes del archivo, no por el nombre ni por el
// Content-Type que declara el cliente (ambos se pueden falsificar).
export function tipoPorFirma(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export const carpetaUploads = () => resolve(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'));

@Injectable()
export class ArchivosService {
  constructor(private readonly prisma: PrismaService) {}

  // Guarda una foto de una recepción. El archivo se escribe con un nombre aleatorio
  // dentro de UPLOADS_DIR; en la base solo queda la clave relativa y los metadatos.
  async guardarFotoRecepcion(recepcionId: string, archivo: Express.Multer.File | undefined, usuarioId: string) {
    if (!archivo?.buffer?.length) throw new BadRequestException('Falta la imagen (campo "archivo").');
    if (archivo.size > MAX_BYTES) throw new PayloadTooLargeException('La imagen supera 5 MB.');

    const mime = tipoPorFirma(archivo.buffer);
    if (!mime) throw new BadRequestException('Solo se permiten imágenes JPEG, PNG o WebP.');

    const recepcion = await this.prisma.recepcion.findUnique({ where: { id: recepcionId }, select: { id: true } });
    if (!recepcion) throw new NotFoundException('La recepción no existe.');

    const existentes = await this.prisma.archivo.count({
      where: { entidadTipo: ENTIDAD_RECEPCION, entidadId: recepcionId },
    });
    if (existentes >= MAX_FOTOS_POR_RECEPCION) {
      throw new BadRequestException(`Una recepción admite máximo ${MAX_FOTOS_POR_RECEPCION} fotos.`);
    }

    const clave = `${ENTIDAD_RECEPCION}/${recepcionId}/${randomUUID()}.${EXTENSION[mime]}`;
    const ruta = this.rutaSegura(clave);
    await fs.mkdir(dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, archivo.buffer, { flag: 'wx' });

    try {
      return await this.prisma.archivo.create({
        data: {
          entidadTipo: ENTIDAD_RECEPCION,
          entidadId: recepcionId,
          claveStorage: clave,
          mime,
          tamanoBytes: archivo.size,
          subidoPorId: usuarioId,
        },
        select: { id: true, mime: true, tamanoBytes: true, creadoEn: true },
      });
    } catch (e) {
      await fs.rm(ruta, { force: true }); // sin fila en la base no debe quedar archivo huérfano
      throw e;
    }
  }

  listarFotosRecepcion(recepcionId: string) {
    return this.prisma.archivo.findMany({
      where: { entidadTipo: ENTIDAD_RECEPCION, entidadId: recepcionId },
      orderBy: { creadoEn: 'asc' },
      select: { id: true, mime: true, tamanoBytes: true, creadoEn: true },
    });
  }

  // Devuelve la ruta en disco y el tipo para servir el archivo.
  async ubicar(id: string): Promise<{ ruta: string; mime: string }> {
    const a = await this.prisma.archivo.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('El archivo no existe.');
    const ruta = this.rutaSegura(a.claveStorage);
    try {
      await fs.access(ruta);
    } catch {
      throw new NotFoundException('El archivo no está disponible.');
    }
    return { ruta, mime: a.mime };
  }

  // Impide que una clave rara salga de la carpeta de subidas.
  private rutaSegura(clave: string): string {
    const base = carpetaUploads();
    const ruta = resolve(base, clave);
    if (!ruta.startsWith(base + sep)) throw new BadRequestException('Ruta de archivo inválida.');
    return ruta;
  }
}
