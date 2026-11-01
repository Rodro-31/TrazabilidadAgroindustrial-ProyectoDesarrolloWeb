import { SetMetadata } from '@nestjs/common';

export const AUDITAR_KEY = 'auditarEntidad';

// Indica la entidad que modifica una ruta (o todo un controlador):
//   @Auditar('recepcion')
// El nombre debe ser el del modelo de Prisma en camelCase (recepcion, lote, productor...),
// porque con él el interceptor consulta cómo estaba el registro ANTES de modificarlo.
// Si una ruta no lo tiene, se audita igual usando el nombre del controlador.
export const Auditar = (entidad: string) => SetMetadata(AUDITAR_KEY, entidad);
