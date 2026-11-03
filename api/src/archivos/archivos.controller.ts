import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Auditar } from '../auditoria/auditar.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ArchivosService, MAX_BYTES } from './archivos.service';

type UsuarioJwt = { sub: string; rol: string };

// Todas las rutas exigen sesión (JwtAuthGuard global). Subir exige rol de captura.
@ApiTags('archivos')
@ApiBearerAuth()
@Auditar('archivo')
@Controller()
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  // POST /api/v1/recepciones/:id/fotos  (multipart, campo "archivo", JPEG/PNG/WebP, máx. 5 MB)
  @Roles('ADMIN', 'SUPERVISOR', 'BASCULA', 'CAMPO')
  @Post('recepciones/:id/fotos')
  @ApiOperation({ summary: 'Adjunta una foto a la recepción' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  subir(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() usuario: UsuarioJwt,
  ) {
    return this.archivos.guardarFotoRecepcion(id, archivo, usuario.sub);
  }

  // GET /api/v1/recepciones/:id/fotos  → metadatos de las fotos de la recepción
  @Get('recepciones/:id/fotos')
  @ApiOperation({ summary: 'Lista las fotos de una recepción.' })
  listar(@Param('id', ParseUUIDPipe) id: string) {
    return this.archivos.listarFotosRecepcion(id);
  }

  // GET /api/v1/archivos/:id  → la imagen (requiere sesión, por eso el cliente la pide con su token)
  @Get('archivos/:id')
  @ApiOperation({ summary: 'Descarga un archivo (requiere sesión).' })
  async descargar(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { ruta, mime } = await this.archivos.ubicar(id);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(ruta);
  }
}
