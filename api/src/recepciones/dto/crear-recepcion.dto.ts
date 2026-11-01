import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProducto } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Pesos en kilogramos con máximo 2 decimales (columna numeric(12,2)).
const MAX_KG = 9_999_999_999;

export class CrearRecepcionDto {
  @ApiProperty({ description: 'UUID generado por el cliente. Evita duplicados al reintentar.' })
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  centroId!: string;

  @ApiProperty()
  @IsUUID()
  productorId!: string;

  @ApiProperty()
  @IsUUID()
  fincaId!: string;

  @ApiProperty({ enum: EstadoProducto, description: 'UVA = fresco, PERGAMINO = seco, ORO = limpio' })
  @IsEnum(EstadoProducto)
  estadoProducto!: EstadoProducto;

  @ApiProperty({ example: 120.5 })
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

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  humedadPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @ApiProperty({ description: 'Fecha y hora de captura en el dispositivo (ISO 8601)' })
  @IsDateString()
  capturadoEn!: string;
}
