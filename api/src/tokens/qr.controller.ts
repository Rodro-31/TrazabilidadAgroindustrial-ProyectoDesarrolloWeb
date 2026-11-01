import { Controller, Get, GoneException, Headers, Ip, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { TokensService } from './tokens.service';

// La PWA escanea un QR (https://campo.<dominio>/q/<valor>) y llama a esta ruta con el
// valor. Responde a qué entidad corresponde; la PWA pide después el detalle
// (GET /recepciones/:id o GET /lotes/:id).
@ApiTags('qr')
@ApiBearerAuth()
@Controller('qr')
export class QrController {
  constructor(private readonly tokens: TokensService) {}

  // GET /api/v1/qr/:valor
  @Get(':valor')
  @ApiHeader({ name: 'user-agent', required: false })
  async resolver(
    @Param('valor') valor: string,
    @UsuarioActual() usuario: { sub: string },
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const { resultado, token } = await this.tokens.validar(valor, ['QR_RECEPCION', 'QR_LOTE'], {
      usuarioId: usuario.sub,
      ip,
      userAgent,
    });

    if (resultado === 'INEXISTENTE' || !token) throw new NotFoundException('Código QR no reconocido');
    if (resultado !== 'VALIDO') throw new GoneException('Este código QR ya no es válido');

    return { proposito: token.proposito, entidadTipo: token.entidadTipo, entidadId: token.entidadId };
  }
}
