import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginacionDto } from '../../../common/paginacion.dto';

// Filtros de GET /grados-calidad. Hereda pagina y limite.
// Son pocos registros (3 a 6 grados): no hace falta búsqueda por texto.
export class ListarGradosCalidadDto extends PaginacionDto {
  // En la URL todo llega como texto: "true"/"false" se convierte a booleano.
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activo?: boolean;
}
