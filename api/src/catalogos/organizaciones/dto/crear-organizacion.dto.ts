import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoOrganizacion } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CrearOrganizacionDto {
  @ApiProperty({ example: 'Cooperativa Cardamomera Chisec' })
  @IsString()
  @Length(3, 120)
  nombre!: string;

  // @IsEnum acepta solo los valores definidos en el enum de schema.prisma.
  @ApiProperty({ enum: TipoOrganizacion, example: TipoOrganizacion.COOPERATIVA })
  @IsEnum(TipoOrganizacion, {
    message: `tipo: debe ser uno de ${Object.values(TipoOrganizacion).join(', ')}`,
  })
  tipo!: TipoOrganizacion;

  // NIT de Guatemala: dígitos y un dígito verificador (número o K), con guion opcional.
  @ApiPropertyOptional({ example: '1234567-8' })
  @IsOptional()
  @Matches(/^\d{1,12}-?[\dK]$/i, { message: 'nit: formato inválido (ej. 1234567-8)' })
  nit?: string;

  @ApiPropertyOptional({ example: '79520000' })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'telefono: debe tener 8 dígitos' })
  telefono?: string;
}
