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

@Module({
  imports: [PrismaModule, JwtModule.register({ global: true }), AuthModule, ProductoresModule, FincasModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
