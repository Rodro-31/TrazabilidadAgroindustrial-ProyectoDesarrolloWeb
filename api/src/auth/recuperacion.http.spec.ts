jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CorreoService } from './correo.service';
import { RecuperacionService } from './recuperacion.service';

// Capa HTTP de la recuperación con los guards reales: rutas públicas, validación y roles.
const USR = '33333333-3333-4333-8333-333333333333';

describe('Recuperación de contraseña (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  let jwt: JwtService;
  const recuperacion = {
    solicitar: jest.fn().mockResolvedValue(undefined),
    restablecer: jest.fn().mockResolvedValue(undefined),
    generarParaUsuario: jest.fn().mockResolvedValue({ enlace: 'https://app/restablecer#t=x', expiraEn: new Date() }),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'secreto-de-prueba-suficientemente-largo';

    @Module({
      imports: [JwtModule.register({ global: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: RecuperacionService, useValue: recuperacion },
        { provide: CorreoService, useValue: {} },
        { provide: TokensService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
    class PruebaModule {}

    app = await NestFactory.create(PruebaModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.JWT_ACCESS_SECRET;
  });

  const post = (ruta: string, cuerpo: unknown, rol?: string) =>
    (async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (rol) headers.Authorization = `Bearer ${await jwt.signAsync({ sub: 'admin-1', rol }, { secret: process.env.JWT_ACCESS_SECRET })}`;
      return fetch(`${url}/api/v1${ruta}`, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
    })();

  it('POST /auth/recuperar es público y responde 204', async () => {
    const r = await post('/auth/recuperar', { email: 'nadie@demo.gt' });
    expect(r.status).toBe(204);
    expect(recuperacion.solicitar).toHaveBeenCalledWith('nadie@demo.gt', expect.any(Object));
  });

  it('POST /auth/recuperar rechaza un correo mal escrito', async () => {
    expect((await post('/auth/recuperar', { email: 'no-es-correo' })).status).toBe(400);
  });

  it('POST /auth/restablecer es público y exige contraseña de al menos 8 caracteres', async () => {
    expect((await post('/auth/restablecer', { token: 'x'.repeat(43), password: 'corta' })).status).toBe(400);
    expect((await post('/auth/restablecer', { token: 'x'.repeat(43), password: 'NuevaClave2026' })).status).toBe(204);
  });

  it('POST /auth/recuperar/enlace exige sesión y rol ADMIN', async () => {
    expect((await post('/auth/recuperar/enlace', { usuarioId: USR })).status).toBe(401);
    expect((await post('/auth/recuperar/enlace', { usuarioId: USR }, 'SUPERVISOR')).status).toBe(403);
    const r = await post('/auth/recuperar/enlace', { usuarioId: USR }, 'ADMIN');
    expect(r.status).toBe(200);
    expect(recuperacion.generarParaUsuario).toHaveBeenCalledWith(USR, expect.objectContaining({ usuarioId: 'admin-1' }));
  });
});
