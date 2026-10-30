import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearFincaDto } from './crear-finca.dto';

// OmitType quita productorId: una finca no puede cambiar de dueño,
// porque reasignaría su historial de recepciones
export class ActualizarFincaDto extends PartialType(OmitType(CrearFincaDto, ['productorId'] as const)) {
  @ApiPropertyOptional({ description: 'Permite reactivar una finca desactivada' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
