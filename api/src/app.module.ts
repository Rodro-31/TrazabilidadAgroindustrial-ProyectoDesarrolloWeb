import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './auth/auth.module';
import { ProductoresModule } from './catalogos/productores/productores.module';
import { HealthController } from './health.controller';
import { FincasModule } from './catalogos/fincas/fincas.module';
import { CentrosModule } from './catalogos/centros/centros.module';
import { TokensModule } from './tokens/tokens.module';
import { RecepcionesModule } from './recepciones/recepciones.module';
import { AuditoriaModule } from './auditoria/auditoria.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ global: true }),
    AuthModule,
    ProductoresModule,
    FincasModule,
    CentrosModule,
    TokensModule,
    RecepcionesModule,
    AuditoriaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
