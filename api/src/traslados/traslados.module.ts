import { Module } from '@nestjs/common';
import { LotesModule } from '../lotes/lotes.module';
import { TrasladosController } from './traslados.controller';
import { TrasladosService } from './traslados.service';

// Importa LotesModule para cambiar el estado del lote con cambiarEstado().
@Module({
  imports: [LotesModule],
  controllers: [TrasladosController],
  providers: [TrasladosService],
})
export class TrasladosModule {}
