import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { CrearProcesoDto } from './dto/crear-proceso.dto';
import { ListarProcesosDto } from './dto/listar-procesos.dto';
import { ProcesosService } from './procesos.service';

type Usuario = { sub: string; rol: string };

// Un proceso no se edita ni se borra: ya consumió lotes y creó otros. Si hubo un
// error, se corrige con un proceso nuevo, y todo queda en el historial.
@ApiTags('procesos')
@ApiBearerAuth()
@Auditar('proceso')
@Controller('procesos')
export class ProcesosController {
  constructor(private readonly procesos: ProcesosService) {}

  // GET /api/v1/procesos?tipo=MEZCLA&centroId=...&loteId=...
  @Get()
  listar(@Query() filtros: ListarProcesosDto) {
    return this.procesos.listar(filtros);
  }

  // GET /api/v1/procesos/:id (con los lotes que entraron y salieron)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.procesos.obtener(id);
  }

  // Responde el proceso y el QR de cada lote nuevo, para imprimir sus etiquetas.
  @Roles('ADMIN', 'SUPERVISOR')
  @Post()
  crear(@Body() dto: CrearProcesoDto, @UsuarioActual() usuario: Usuario) {
    return this.procesos.crear(dto, usuario.sub);
  }
}
