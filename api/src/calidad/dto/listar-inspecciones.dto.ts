import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Filtros de GET /calidad/inspecciones
export class ListarInspeccionesDto extends PaginacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recepcionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  aprobado?: boolean;
}
