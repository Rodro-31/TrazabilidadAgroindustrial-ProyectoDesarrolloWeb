import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../common/paginacion.dto';

// Filtros de GET /compradores. Hereda pagina y limite.
export class ListarCompradoresDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o NIT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional({ example: 'Arabia Saudita' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  pais?: string;

  // En la URL todo llega como texto: "true"/"false" se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}
