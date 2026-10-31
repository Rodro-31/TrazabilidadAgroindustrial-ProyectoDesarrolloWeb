import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoLote, EstadoProducto } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Filtros de GET /lotes ("consultar existencias por centro, lote, calidad y estado").
export class ListarLotesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por código de lote' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  buscar?: string;

  // Lotes que HOY tienen existencia en ese centro (no donde se crearon):
  // después de un traslado, el lote aparece en el centro de destino.
  @ApiPropertyOptional({ description: 'Lotes con existencia actual en este centro' })
  @IsOptional()
  @IsUUID()
  centroId?: string;

  @ApiPropertyOptional({ enum: EstadoLote })
  @IsOptional()
  @IsEnum(EstadoLote)
  estado?: EstadoLote;

  @ApiPropertyOptional({ enum: EstadoProducto })
  @IsOptional()
  @IsEnum(EstadoProducto)
  estadoProducto?: EstadoProducto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gradoCalidadId?: string;

  // En la URL llega como texto: @Type lo convierte a número antes de validar.
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  cosecha?: number;
}
