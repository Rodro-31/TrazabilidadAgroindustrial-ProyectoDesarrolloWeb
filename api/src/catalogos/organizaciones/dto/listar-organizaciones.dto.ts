import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoOrganizacion } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../common/paginacion.dto';

// Filtros de GET /organizaciones. Hereda pagina y limite.
export class ListarOrganizacionesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o NIT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional({ enum: TipoOrganizacion })
  @IsOptional()
  @IsEnum(TipoOrganizacion)
  tipo?: TipoOrganizacion;

  // En la URL todo llega como texto: "true"/"false" se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}
