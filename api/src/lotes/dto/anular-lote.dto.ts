import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

// Anular es una operación sensible: el motivo es obligatorio y queda en el historial.
export class AnularLoteDto {
  @ApiProperty({ example: 'Lote creado por error: recepción equivocada' })
  @IsString()
  @Length(5, 300)
  motivo!: string;
}
