import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProducto } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Filtros de GET /recepciones. Hereda pagina y limite.
export class ListarRecepcionesDto extends PaginacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  centroId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productorId?: string;

  @ApiPropertyOptional({ enum: EstadoProducto })
  @IsOptional()
  @IsEnum(EstadoProducto)
  estadoProducto?: EstadoProducto;

  @ApiPropertyOptional({ description: 'Capturadas desde esta fecha (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Capturadas hasta esta fecha (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
