import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ArchivosService, MAX_FOTOS_POR_RECEPCION, tipoPorFirma } from './archivos.service';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
const REC = '11111111-1111-4111-8111-111111111111';

const archivo = (buffer: Buffer) => ({ buffer, size: buffer.length }) as Express.Multer.File;

describe('tipoPorFirma', () => {
  it('reconoce JPEG, PNG y WebP por sus primeros bytes', () => {
    expect(tipoPorFirma(JPEG)).toBe('image/jpeg');
    expect(tipoPorFirma(PNG)).toBe('image/png');
    expect(tipoPorFirma(WEBP)).toBe('image/webp');
  });

  it('rechaza otros contenidos aunque se presenten como imagen', () => {
    expect(tipoPorFirma(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(tipoPorFirma(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(tipoPorFirma(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(tipoPorFirma(Buffer.alloc(0))).toBeNull();
  });
});

describe('ArchivosService', () => {
  let carpeta: string;
  let prisma: any;
  let servicio: ArchivosService;

  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), 'uploads-'));
    process.env.UPLOADS_DIR = carpeta;
    prisma = {
      recepcion: { findUnique: jest.fn().mockResolvedValue({ id: REC }) },
      archivo: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', mime: data.mime })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    servicio = new ArchivosService(prisma);
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('guarda una foto válida con nombre aleatorio dentro de la carpeta de subidas', async () => {
    await servicio.guardarFotoRecepcion(REC, archivo(JPEG), 'u1');
    const data = prisma.archivo.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ entidadTipo: 'recepcion', entidadId: REC, mime: 'image/jpeg', subidoPorId: 'u1' });
    expect(data.claveStorage).toMatch(/^recepcion\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    expect(readdirSync(join(carpeta, 'recepcion', REC))).toHaveLength(1);
  });

  it('rechaza si no llega archivo', async () => {
    await expect(servicio.guardarFotoRecepcion(REC, undefined, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza contenido que no es imagen y no escribe nada', async () => {
    await expect(servicio.guardarFotoRecepcion(REC, archivo(Buffer.from('<script>alert(1)</script>')), 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.archivo.create).not.toHaveBeenCalled();
    expect(readdirSync(carpeta)).toHaveLength(0);
  });

  it('rechaza si la recepción no existe', async () => {
    prisma.recepcion.findUnique.mockResolvedValue(null);
    await expect(servicio.guardarFotoRecepcion(REC, archivo(PNG), 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza cuando la recepción ya tiene el máximo de fotos', async () => {
    prisma.archivo.count.mockResolvedValue(MAX_FOTOS_POR_RECEPCION);
    await expect(servicio.guardarFotoRecepcion(REC, archivo(PNG), 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('borra el archivo si falla el registro en la base', async () => {
    prisma.archivo.create.mockRejectedValue(new Error('db caída'));
    await expect(servicio.guardarFotoRecepcion(REC, archivo(WEBP), 'u1')).rejects.toThrow('db caída');
    expect(readdirSync(join(carpeta, 'recepcion', REC))).toHaveLength(0);
  });

  it('no permite claves que salgan de la carpeta de subidas', async () => {
    prisma.archivo.findUnique.mockResolvedValue({ claveStorage: '../../etc/passwd', mime: 'image/jpeg' });
    await expect(servicio.ubicar('x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ubicar da 404 si el archivo no existe en disco', async () => {
    prisma.archivo.findUnique.mockResolvedValue({ claveStorage: `recepcion/${REC}/no-esta.jpg`, mime: 'image/jpeg' });
    await expect(servicio.ubicar('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
