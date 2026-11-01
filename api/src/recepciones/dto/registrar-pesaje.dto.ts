import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

const MAX_KG = 9_999_999_999;

// Un nuevo pesaje no reemplaza al anterior: se agrega al histórico.
export class RegistrarPesajeDto {
  @ApiProperty({ example: 118 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_KG)
  pesoBrutoKg!: number;

  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_KG)
  taraKg?: number;

  @ApiPropertyOptional({ description: 'Por qué se vuelve a pesar (ej. corrección de báscula)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
