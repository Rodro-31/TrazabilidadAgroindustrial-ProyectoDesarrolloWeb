import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Parámetros comunes de paginación: ?pagina=1&limite=20
// Los DTO de listado de cada módulo extienden esta clase.
export class PaginacionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}

// Forma estándar de todas las listas de la API.
export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

// Convierte pagina/limite al skip/take que entiende Prisma (OFFSET/LIMIT en SQL).
export function paginar({ pagina, limite }: PaginacionDto) {
  return { skip: (pagina - 1) * limite, take: limite };
}
