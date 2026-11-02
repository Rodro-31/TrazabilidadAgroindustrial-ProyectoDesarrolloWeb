import { Module } from '@nestjs/common';
import { LotesModule } from '../lotes/lotes.module';
import { ProcesosController } from './procesos.controller';
import { ProcesosService } from './procesos.service';

// Importa LotesModule para usar cambiarEstado() y siguienteCodigo() de LotesService.
@Module({
  imports: [LotesModule],
  controllers: [ProcesosController],
  providers: [ProcesosService],
})
export class ProcesosModule {}
