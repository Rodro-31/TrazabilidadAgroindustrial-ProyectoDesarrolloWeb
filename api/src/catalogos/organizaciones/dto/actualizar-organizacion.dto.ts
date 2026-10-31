import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearOrganizacionDto } from './crear-organizacion.dto';

// Todos los campos se pueden cambiar: los productores se relacionan con la
// organización por su id (UUID), no por su nombre ni su NIT.
export class ActualizarOrganizacionDto extends PartialType(CrearOrganizacionDto) {
  @ApiPropertyOptional({ description: 'Permite reactivar una organización desactivada' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
