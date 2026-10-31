import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class  CrearCentroDto {
  @ApiProperty({ example: 'CA-0001', description: 'Código interno único' })
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'codigo: 3 a 20 caracteres, solo mayúsculas, números y guiones',
  })
  codigo!: string;

  @ApiProperty({ example: 'Centro de Acopio Cobán' })
  @IsString()
  @Length(3, 120)
  nombre!: string;

  @ApiPropertyOptional({ example: '55551234' })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'telefono: debe tener 8 dígitos' })
  telefono?: string;

  @ApiPropertyOptional({ example: 'Cobán' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  municipio?: string;

  @ApiPropertyOptional({ example: 'Alta Verapaz' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  departamento?: string;

  @ApiPropertyOptional({ example: '3a. Calle 2-15, Zona 1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

}
