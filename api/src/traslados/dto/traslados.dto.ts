import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoTraslado } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Despachar: el lote sale completo del centro donde está hacia el centro destino.
export class CrearTrasladoDto {
  @ApiProperty({ description: 'Lote a trasladar (debe estar ACTIVO)' })
  @IsUUID()
  loteId!: string;

  @ApiProperty({ description: 'Centro de acopio de destino' })
  @IsUUID()
  destinoId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

// Recibir en destino con el token de confirmación que lleva el transportista.
export class RecibirTrasladoDto {
  @ApiProperty({ description: 'Código de confirmación entregado al despachar' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  // Si no se envía, se recibió lo mismo que salió. Si es menos, la diferencia es merma en tránsito.
  @ApiPropertyOptional({ example: 410.5, description: 'Kg pesados al llegar (por defecto, los enviados)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidadRecibidaKg?: number;
}

export class CancelarTrasladoDto {
  @ApiProperty({ example: 'El camión no salió por lluvia' })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  motivo!: string;
}

export class ListarTrasladosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: EstadoTraslado })
  @IsOptional()
  @IsEnum(EstadoTraslado)
  estado?: EstadoTraslado;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loteId?: string;

  // Traslados que salen de este centro o llegan a él.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  centroId?: string;
}
