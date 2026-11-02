import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';

// El correo y la contraseña no se cambian aquí (la contraseña tiene su propia ruta).
export class ActualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  nombre?: string;

  @ApiPropertyOptional({ enum: Rol })
  @IsOptional()
  @IsEnum(Rol, { message: 'rol: valor no válido' })
  rol?: Rol;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
