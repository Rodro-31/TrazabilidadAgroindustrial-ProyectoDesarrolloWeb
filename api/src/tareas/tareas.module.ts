import { Module } from '@nestjs/common';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';

// Exporta TareasService: recepciones y calidad crean y cierran tareas dentro de sus transacciones.
@Module({
  controllers: [TareasController],
  providers: [TareasService],
  exports: [TareasService],
})
export class TareasModule {}
