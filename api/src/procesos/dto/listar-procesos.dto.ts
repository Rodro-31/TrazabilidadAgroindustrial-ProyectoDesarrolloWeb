import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoProceso } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Filtros de GET /procesos
export class ListarProcesosDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: TipoProceso })
  @IsOptional()
  @IsEnum(TipoProceso)
  tipo?: TipoProceso;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  centroId?: string;

  // Procesos donde participó este lote, como entrada o como salida.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loteId?: string;
}
