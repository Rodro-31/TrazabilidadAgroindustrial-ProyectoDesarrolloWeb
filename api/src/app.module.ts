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
import { OrganizacionesModule } from './catalogos/organizaciones/organizaciones.module';
import { CompradoresModule } from './catalogos/compradores/compradores.module';
import { GradosCalidadModule } from './catalogos/grados-calidad/grados-calidad.module';
import { LotesModule } from './lotes/lotes.module';
import { TokensModule } from './tokens/tokens.module';
import { RecepcionesModule } from './recepciones/recepciones.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ArchivosModule } from './archivos/archivos.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ global: true }),
    AuthModule,
    ProductoresModule,
    FincasModule,
    CentrosModule,
    OrganizacionesModule,
    CompradoresModule,
    GradosCalidadModule,
    LotesModule,
    TokensModule,
    RecepcionesModule,
    AuditoriaModule,
    ArchivosModule,
    UsuariosModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
