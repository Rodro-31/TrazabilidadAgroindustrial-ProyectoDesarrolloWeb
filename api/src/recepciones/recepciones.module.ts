import { Module } from '@nestjs/common';
import { TareasModule } from '../tareas/tareas.module';
import { RecepcionesController } from './recepciones.controller';
import { RecepcionesService } from './recepciones.service';

@Module({
  imports: [TareasModule],
  controllers: [RecepcionesController],
  providers: [RecepcionesService],
})
export class RecepcionesModule {}
