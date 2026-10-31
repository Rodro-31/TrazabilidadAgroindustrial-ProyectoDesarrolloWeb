import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearCompradorDto } from './crear-comprador.dto';

// Todos los campos se pueden cambiar: las ventas apuntan al comprador por su id (UUID).
export class ActualizarCompradorDto extends PartialType(CrearCompradorDto) {
  @ApiPropertyOptional({ description: 'Permite reactivar un comprador desactivado' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
