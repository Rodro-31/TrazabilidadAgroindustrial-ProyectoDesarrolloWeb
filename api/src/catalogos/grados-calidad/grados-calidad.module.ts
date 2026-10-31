import { Module } from '@nestjs/common';
import { GradosCalidadController } from './grados-calidad.controller';
import { GradosCalidadService } from './grados-calidad.service';

@Module({
  controllers: [GradosCalidadController],
  providers: [GradosCalidadService],
  exports: [GradosCalidadService],
})
export class GradosCalidadModule {}
