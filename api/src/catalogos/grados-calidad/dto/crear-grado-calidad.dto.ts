import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class CrearGradoCalidadDto {
  @ApiProperty({ example: 'PRIMERA', description: 'Código interno único' })
  @Matches(/^[A-Z0-9_-]{2,20}$/, {
    message: 'codigo: 2 a 20 caracteres, solo mayúsculas, números, guiones y guion bajo',
  })
  codigo!: string;

  @ApiProperty({ example: 'Primera' })
  @IsString()
  @Length(2, 60)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Grano grande, verde intenso, sin defectos visibles' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  // Posición en listas y selectores: 1 = mejor grado.
  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;
}
