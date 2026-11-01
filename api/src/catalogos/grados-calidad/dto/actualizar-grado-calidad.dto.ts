import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearGradoCalidadDto } from './crear-grado-calidad.dto';

// OmitType quita el codigo: aparece en etiquetas de lote y reportes de calidad,
// igual que el código de un centro. PartialType vuelve opcional el resto.
export class ActualizarGradoCalidadDto extends PartialType(
  OmitType(CrearGradoCalidadDto, ['codigo'] as const),
) {
  @ApiPropertyOptional({ description: 'Permite reactivar un grado desactivado' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
