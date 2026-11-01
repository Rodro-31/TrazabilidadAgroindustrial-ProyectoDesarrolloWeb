import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../common/paginacion.dto';

// Filtros de GET /auditoria. Hereda pagina y limite.
export class ListarAuditoriaDto extends PaginacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ description: 'Entidad, ej. recepcion, lote, usuario, token' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidadId?: string;

  @ApiPropertyOptional({ description: 'Busca dentro de la acción, ej. LOGIN_FALLIDO o POST' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accion?: string;

  @ApiPropertyOptional({ description: 'Desde esta fecha (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Hasta esta fecha (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
