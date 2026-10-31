import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProducto } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Una recepción que aporta producto al lote.
export class RecepcionOrigenDto {
  @ApiProperty({ description: 'Id de la recepción (UUID)' })
  @IsUUID()
  recepcionId!: string;

  // Si no se envía, se toma todo lo que la recepción tiene disponible.
  @ApiPropertyOptional({ example: 120.5, description: 'Kg a tomar de la recepción (por defecto, todo lo disponible)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadKg?: number;
}

export class CrearLoteDto {
  @ApiProperty({ description: 'Centro donde se arma el lote: todas las recepciones deben ser de ese centro' })
  @IsUUID()
  centroId!: string;

  // Regla de negocio: no hay lotes sin origen identificable → al menos una recepción.
  // @ValidateNested + @Type validan cada elemento con las reglas de RecepcionOrigenDto.
  @ApiProperty({ type: () => [RecepcionOrigenDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'recepciones: un lote debe tener al menos una recepción de origen' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecepcionOrigenDto)
  recepciones!: RecepcionOrigenDto[];

  // Opcional: si se envía, debe coincidir con el de las recepciones.
  @ApiPropertyOptional({ enum: EstadoProducto })
  @IsOptional()
  @IsEnum(EstadoProducto)
  estadoProducto?: EstadoProducto;

  @ApiPropertyOptional({ description: 'Grado de calidad (puede asignarse después de la inspección)' })
  @IsOptional()
  @IsUUID()
  gradoCalidadId?: string;

  @ApiPropertyOptional({ example: 2026, description: 'Año de cosecha (por defecto, el año actual)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  cosecha?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
