import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class AsignarCentrosDto {
  @ApiProperty({ type: [String], description: 'Lista completa de centros del usuario (reemplaza la anterior). Vacía = ninguno.' })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true, message: 'centroIds: cada valor debe ser un UUID' })
  centroIds!: string[];
}
