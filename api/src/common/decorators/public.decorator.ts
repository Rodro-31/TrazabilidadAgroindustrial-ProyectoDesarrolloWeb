import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

// Marca una ruta como abierta: no exige token JWT.
export const Public = () => SetMetadata(ES_PUBLICO, true);
