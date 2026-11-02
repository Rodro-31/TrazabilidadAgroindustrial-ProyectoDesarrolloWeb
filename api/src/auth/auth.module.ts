import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CorreoService } from './correo.service';
import { RecuperacionService } from './recuperacion.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [AuthController],
  providers: [AuthService, RecuperacionService, CorreoService],
})
export class AuthModule {}
