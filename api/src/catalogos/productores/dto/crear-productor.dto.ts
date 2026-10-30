import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class CrearProductorDto {
  @ApiProperty({ example: 'P-0001', description: 'Código interno único' })
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'codigo: 3 a 20 caracteres, solo mayúsculas, números y guiones',
  })
  codigo: string;

  @ApiProperty({ example: 'Juan Caal Pop' })
  @IsString()
  @Length(3, 120)
  nombre: string;

  @ApiPropertyOptional({ example: '1234567890101', description: 'DPI (CUI) de 13 dígitos' })
  @IsOptional()
  @Matches(/^\d{13}$/, { message: 'dpi: debe tener 13 dígitos' })
  dpi?: string;

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

  @ApiPropertyOptional({ description: 'Id de la organización (cooperativa, asociación...)' })
  @IsOptional()
  @IsUUID()
  organizacionId?: string;
}
