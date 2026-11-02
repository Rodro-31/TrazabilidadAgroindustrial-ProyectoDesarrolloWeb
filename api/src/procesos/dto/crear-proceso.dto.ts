import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoProceso } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Un lote que entra al proceso (lote "padre").
export class EntradaProcesoDto {
  @ApiProperty({ description: 'Id del lote (UUID)' })
  @IsUUID()
  loteId!: string;

  // Si no se envía, se toma toda la existencia del lote en el centro del proceso.
  @ApiPropertyOptional({ example: 250, description: 'Kg a tomar del lote (por defecto, toda su existencia en el centro)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadKg?: number;
}

// Un lote nuevo que sale del proceso (lote "hijo").
export class SalidaProcesoDto {
  @ApiProperty({ example: 240, description: 'Kg del lote resultante' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadKg!: number;

  // Típico en CLASIFICACION: cada lote resultante con su grado.
  @ApiPropertyOptional({ description: 'Grado de calidad del lote resultante' })
  @IsOptional()
  @IsUUID()
  gradoCalidadId?: string;
}

// Las reglas que dependen del tipo (cuántas entradas y salidas) se validan en el
// service: MEZCLA = 2+ entradas y 1 salida; DIVISION = 1 entrada y 2+ salidas;
// SECADO, LIMPIEZA y CLASIFICACION = 1 entrada y 1 salida.
export class CrearProcesoDto {
  @ApiProperty({ enum: TipoProceso })
  @IsEnum(TipoProceso)
  tipo!: TipoProceso;

  @ApiProperty({ description: 'Centro donde se realiza: los lotes deben tener existencia ahí' })
  @IsUUID()
  centroId!: string;

  @ApiProperty({ type: () => [EntradaProcesoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EntradaProcesoDto)
  entradas!: EntradaProcesoDto[];

  @ApiProperty({ type: () => [SalidaProcesoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalidaProcesoDto)
  salidas!: SalidaProcesoDto[];

  @ApiPropertyOptional({ description: 'Cuándo se hizo (por defecto, ahora)' })
  @IsOptional()
  @IsDateString()
  realizadoEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
