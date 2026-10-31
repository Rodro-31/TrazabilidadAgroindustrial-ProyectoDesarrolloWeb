import { Module } from '@nestjs/common';
import { CompradoresController } from './compradores.controller';
import { CompradoresService } from './compradores.service';

@Module({
  controllers: [CompradoresController],
  providers: [CompradoresService],
  exports: [CompradoresService],
})
export class CompradoresModule {}
