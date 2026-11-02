import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProducto } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Un precio nuevo REEMPLAZA al vigente del mismo producto y grado (el anterior se cierra).
export class CrearPrecioDto {
  @ApiProperty({ enum: EstadoProducto })
  @IsEnum(EstadoProducto)
  estadoProducto!: EstadoProducto;

  // Sin grado = precio general del producto (se usa cuando no hay uno por grado).
  @ApiPropertyOptional({ description: 'Grado de calidad (vacío = precio general del producto)' })
  @IsOptional()
  @IsUUID()
  gradoCalidadId?: string;

  @ApiProperty({ example: 15.25, description: 'Quetzales por kg' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  precioPorKg!: number;

  // Por defecto, desde ahora. Una fecha futura deja el precio programado.
  @ApiPropertyOptional({ example: '2026-11-15T00:00:00-06:00' })
  @IsOptional()
  @IsDateString()
  vigenteDesde?: string;
}

export class ListarPreciosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: EstadoProducto })
  @IsOptional()
  @IsEnum(EstadoProducto)
  estadoProducto?: EstadoProducto;

  // true = solo los vigentes hoy. En la URL llega como texto: se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  @IsBoolean()
  vigentes?: boolean;
}
