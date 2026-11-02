import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Porcentajes con 2 decimales entre 0 y 100 (mismo rango que el CHECK de la base).
const Porcentaje = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2 }, { message: 'porcentaje: número con máximo 2 decimales' }),
    Min(0),
    Max(100),
  );

// Se inspecciona exactamente una recepción o un lote (CHECK inspeccion_objetivo_ck);
// la regla "exactamente uno" se valida en el service para dar un mensaje claro.
export class CrearInspeccionDto {
  @ApiProperty({ description: 'UUID generado por el cliente. Reintentar con el mismo id no duplica.' })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ description: 'Recepción inspeccionada (o loteId, nunca ambos)' })
  @IsOptional()
  @IsUUID()
  recepcionId?: string;

  @ApiPropertyOptional({ description: 'Lote inspeccionado (o recepcionId, nunca ambos)' })
  @IsOptional()
  @IsUUID()
  loteId?: string;

  @ApiPropertyOptional({ description: 'Grado asignado. En un lote, actualiza el grado del lote.' })
  @IsOptional()
  @IsUUID()
  gradoCalidadId?: string;

  @ApiPropertyOptional({ example: 11.5 })
  @Porcentaje()
  humedadPct?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @Porcentaje()
  impurezasPct?: number;

  @ApiPropertyOptional({ example: 3 })
  @Porcentaje()
  defectosPct?: number;

  @ApiProperty({ description: 'Resultado de la inspección' })
  @IsBoolean()
  aprobado!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @ApiProperty({ description: 'Fecha y hora de la inspección en el dispositivo (ISO 8601)' })
  @IsDateString()
  inspeccionadoEn!: string;
}
