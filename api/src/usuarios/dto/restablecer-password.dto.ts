import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RestablecerPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'password: mínimo 8 caracteres' })
  @MaxLength(72, { message: 'password: máximo 72 caracteres' })
  password!: string;
}
