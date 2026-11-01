import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../common/paginacion.dto';


// Filtros de GET /centros. Hereda pagina y limite.
export class ListarCentrosDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o código' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  // En la URL todo llega como texto: "true"/"false" se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}
