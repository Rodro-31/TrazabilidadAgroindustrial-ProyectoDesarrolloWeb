import { Module } from '@nestjs/common';
import { TareasModule } from '../tareas/tareas.module';
import { CalidadController } from './calidad.controller';
import { CalidadService } from './calidad.service';

@Module({
  imports: [TareasModule],
  controllers: [CalidadController],
  providers: [CalidadService],
})
export class CalidadModule {}
