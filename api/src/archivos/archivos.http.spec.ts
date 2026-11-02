import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';

// Prueba de punta a punta de la capa HTTP: multipart real, límites de tamaño y descarga.
// (La base de datos se simula; los guards de sesión/rol se prueban en su propio lugar.)
const REC = '11111111-1111-4111-8111-111111111111';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);

describe('Fotos de recepción (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  let carpeta: string;
  const filas: any[] = [];

  beforeAll(async () => {
    carpeta = mkdtempSync(join(tmpdir(), 'uploads-http-'));
    process.env.UPLOADS_DIR = carpeta;
    const prisma = {
      recepcion: { findUnique: async ({ where }: any) => (where.id === REC ? { id: REC } : null) },
      archivo: {
        count: async () => filas.length,
        create: async ({ data }: any) => {
          const f = { id: '22222222-2222-4222-8222-222222222222', ...data, creadoEn: new Date() };
          filas.push(f);
          return { id: f.id, mime: f.mime, tamanoBytes: f.tamanoBytes, creadoEn: f.creadoEn };
        },
        findUnique: async ({ where }: any) => filas.find((f) => f.id === where.id) ?? null,
        findMany: async () => filas.map(({ id, mime, tamanoBytes, creadoEn }) => ({ id, mime, tamanoBytes, creadoEn })),
      },
    };

    @Module({
      controllers: [ArchivosController],
      providers: [ArchivosService, { provide: PrismaService, useValue: prisma }],
    })
    class PruebaModule {}

    app = await NestFactory.create(PruebaModule, { logger: false });
    app.use((req: any, _res: any, next: () => void) => ((req.user = { sub: 'u1', rol: 'CAMPO' }), next()));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.close();
    delete process.env.UPLOADS_DIR;
    rmSync(carpeta, { recursive: true, force: true });
  });

  const subir = (bytes: Buffer, id = REC) => {
    const form = new FormData();
    form.append('archivo', new Blob([bytes]), 'foto.jpg');
    return fetch(`${url}/api/v1/recepciones/${id}/fotos`, { method: 'POST', body: form });
  };

  it('sube una foto, la lista y la descarga idéntica', async () => {
    const r = await subir(JPEG);
    expect(r.status).toBe(201);
    const meta = await r.json();
    expect(meta).toMatchObject({ mime: 'image/jpeg', tamanoBytes: JPEG.length });

    const lista = await (await fetch(`${url}/api/v1/recepciones/${REC}/fotos`)).json();
    expect(lista).toHaveLength(1);

    const d = await fetch(`${url}/api/v1/archivos/${meta.id}`);
    expect(d.status).toBe(200);
    expect(d.headers.get('content-type')).toBe('image/jpeg');
    expect(d.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await d.arrayBuffer()).equals(JPEG)).toBe(true);
  });

  it('rechaza con 413 una imagen de más de 5 MB', async () => {
    const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    expect((await subir(grande)).status).toBe(413);
  });

  it('rechaza con 400 algo que no es imagen aunque se llame foto.jpg', async () => {
    const r = await subir(Buffer.from('<script>alert(1)</script>'));
    expect(r.status).toBe(400);
    expect((await r.json()).mensaje).toMatch(/JPEG, PNG o WebP/);
  });

  it('da 404 si la recepción no existe y 400 si el id no es UUID', async () => {
    expect((await subir(JPEG, '33333333-3333-4333-8333-333333333333')).status).toBe(404);
    expect((await subir(JPEG, 'abc')).status).toBe(400);
  });

  it('da 400 si no se envía ningún archivo', async () => {
    const r = await fetch(`${url}/api/v1/recepciones/${REC}/fotos`, { method: 'POST', body: new FormData() });
    expect(r.status).toBe(400);
  });
});
