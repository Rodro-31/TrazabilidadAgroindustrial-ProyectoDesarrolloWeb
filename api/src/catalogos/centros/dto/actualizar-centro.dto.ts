import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearCentroDto } from './crear-centro.dto';

// OmitType quita el codigo: aparece impreso en comprobantes y etiquetas de lote,
// y si cambiara, los papeles ya impresos no coincidirían con el sistema.
// PartialType vuelve opcional el resto: en un PATCH solo se envía lo que cambia.
export class ActualizarCentroDto extends PartialType(OmitType(CrearCentroDto, ['codigo'] as const)) {
  @ApiPropertyOptional({ description: 'Permite reactivar un centro desactivado' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
