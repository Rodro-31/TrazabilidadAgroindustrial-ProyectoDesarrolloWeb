import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto';

// Solo lectura. La auditoría la consultan ADMIN y AUDITOR; nadie puede modificarla por la API.
@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  // GET /api/v1/auditoria?entidad=recepcion&usuarioId=&accion=&desde=&hasta=&pagina=1&limite=20
  @Roles('ADMIN', 'AUDITOR')
  @Get()
  @ApiOperation({ summary: 'ADMIN y AUDITOR: bitácora de auditoría con filtros por entidad, acción, usuario y fechas. Los campos sensibles salen como [OCULTO].' })
  listar(@Query() filtros: ListarAuditoriaDto) {
    return this.auditoria.listar(filtros);
  }
}
