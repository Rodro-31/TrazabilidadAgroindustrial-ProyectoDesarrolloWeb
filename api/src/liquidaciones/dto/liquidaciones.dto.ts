import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoLiquidacion } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Período y productor a liquidar. Sirve para calcular (vista previa) y para crear el borrador.
export class CalcularLiquidacionDto {
  @ApiProperty()
  @IsUUID()
  productorId!: string;

  @ApiProperty({ example: '2026-10-01', description: 'Primer día del período (inclusive)' })
  @IsDateString()
  periodoInicio!: string;

  @ApiProperty({ example: '2026-10-31', description: 'Último día del período (inclusive)' })
  @IsDateString()
  periodoFin!: string;
}

export class ListarLiquidacionesDto extends PaginacionDto {
  @ApiPropertyOptional({ enum: EstadoLiquidacion })
  @IsOptional()
  @IsEnum(EstadoLiquidacion)
  estado?: EstadoLiquidacion;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productorId?: string;
}
