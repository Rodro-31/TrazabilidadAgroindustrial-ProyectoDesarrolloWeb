import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

// Los compradores suelen ser extranjeros (exportación): el NIT y el teléfono
// no siguen el formato de Guatemala, por eso las validaciones son más flexibles.
export class CrearCompradorDto {
  @ApiProperty({ example: 'Gulf Spice Trading Co.' })
  @IsString()
  @Length(2, 150)
  nombre!: string;

  @ApiPropertyOptional({ example: 'SA-300123456', description: 'Identificación fiscal (único)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @ApiProperty({ example: 'Arabia Saudita' })
  @IsString()
  @Length(2, 60)
  pais!: string;

  @ApiPropertyOptional({ example: 'Ahmed Al-Sayed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;

  @ApiPropertyOptional({ example: 'compras@gulfspice.example' })
  @IsOptional()
  @IsEmail({}, { message: 'email: formato inválido' })
  email?: string;

  // Formato internacional: + opcional, dígitos, espacios o guiones.
  @ApiPropertyOptional({ example: '+966 11 555 0100' })
  @IsOptional()
  @Matches(/^\+?[\d\s-]{7,20}$/, { message: 'telefono: formato inválido' })
  telefono?: string;
}
