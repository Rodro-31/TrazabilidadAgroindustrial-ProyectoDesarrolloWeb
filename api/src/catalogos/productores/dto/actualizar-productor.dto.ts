import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearProductorDto } from './crear-productor.dto';

// PartialType copia todos los campos de CrearProductorDto, con sus validaciones,
// pero los vuelve opcionales: en un PATCH solo se envía lo que cambia.
export class ActualizarProductorDto extends PartialType(CrearProductorDto) {
  @ApiPropertyOptional({ description: 'Permite reactivar un productor desactivado' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
