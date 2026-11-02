import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SolicitarRecuperacionDto {
  @ApiProperty({ example: 'campo@demo.gt' })
  @IsEmail({}, { message: 'email: correo inválido' })
  email!: string;
}

export class RestablecerConTokenDto {
  @ApiProperty({ description: 'Valor que viene en el enlace de recuperación' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'password: mínimo 8 caracteres' })
  @MaxLength(72, { message: 'password: máximo 72 caracteres' })
  password!: string;
}

export class EnlaceRecuperacionDto {
  @ApiProperty()
  @IsUUID('all', { message: 'usuarioId: debe ser un UUID' })
  usuarioId!: string;
}
