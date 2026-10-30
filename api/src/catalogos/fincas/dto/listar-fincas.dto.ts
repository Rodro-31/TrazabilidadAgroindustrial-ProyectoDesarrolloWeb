import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../../common/paginacion.dto';


// Filtros de GET /fincas. Hereda pagina y limite.
export class ListarFincasDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productorId?: string;

  // En la URL todo llega como texto: "true"/"false" se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}
