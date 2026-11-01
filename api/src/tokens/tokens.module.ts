import { Global, Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { TokensService } from './tokens.service';

// Global: cualquier módulo (traslados, lotes, recepciones) puede inyectar TokensService.
@Global()
@Module({
  controllers: [QrController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
