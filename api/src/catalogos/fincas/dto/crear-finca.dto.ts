import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

export class CrearFincaDto {
  @ApiProperty({ description: 'Id del productor dueño de la finca' })
  @IsUUID()
  productorId!: string;

  @ApiProperty({ example: 'Finca El Roble' })
  @IsString()
  @Length(2, 120)
  nombre!: string;

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

  @ApiPropertyOptional({ example: 1300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  altitudMsnm?: number;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  areaHa?: number;

  @ApiPropertyOptional({ example: 15.4708 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ example: -90.3708 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;
}
