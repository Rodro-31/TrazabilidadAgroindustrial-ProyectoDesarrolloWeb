import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProducto } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

// GET /lotes/recepciones-disponibles: recepciones de un centro con kg sin asignar a lotes.
// La pantalla de "crear lote" lo usa para elegir de dónde sale el producto.
export class RecepcionesDisponiblesDto {
  @ApiProperty()
  @IsUUID()
  centroId!: string;

  @ApiPropertyOptional({ enum: EstadoProducto })
  @IsOptional()
  @IsEnum(EstadoProducto)
  estadoProducto?: EstadoProducto;
}
