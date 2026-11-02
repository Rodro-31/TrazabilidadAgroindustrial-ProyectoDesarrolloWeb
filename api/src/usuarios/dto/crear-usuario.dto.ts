import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'maria@empresa.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email: correo inválido' })
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'María López' })
  @IsString()
  @Length(3, 120)
  nombre!: string;

  @ApiProperty({ enum: Rol })
  @IsEnum(Rol, { message: 'rol: valor no válido' })
  rol!: Rol;

  // bcrypt solo usa los primeros 72 bytes: se limita para que la clave completa cuente.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'password: mínimo 8 caracteres' })
  @MaxLength(72, { message: 'password: máximo 72 caracteres' })
  password!: string;
}
