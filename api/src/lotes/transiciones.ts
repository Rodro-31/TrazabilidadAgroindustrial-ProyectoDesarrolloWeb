import { EstadoLote } from '@prisma/client';

// Máquina de estados del lote: desde cada estado, a cuáles se puede pasar.
// Cada transición la provoca un módulo distinto:
//   ACTIVO → EN_TRANSITO   traslados (al despachar)
//   EN_TRANSITO → ACTIVO   traslados (al confirmar la recepción en destino)
//   ACTIVO → EN_PROCESO    procesos (secado, limpieza, clasificación)
//   EN_PROCESO → ACTIVO    procesos (al terminar, si el lote sigue existiendo)
//   → AGOTADO              inventario (cuando su existencia llega a 0)
//   ACTIVO → VENDIDO       ventas
//   ACTIVO → ANULADO       lotes (anulación manual con motivo)
// AGOTADO, VENDIDO y ANULADO son finales: un lote no "revive".
export const TRANSICIONES: Record<EstadoLote, readonly EstadoLote[]> = {
  ACTIVO: ['EN_TRANSITO', 'EN_PROCESO', 'AGOTADO', 'VENDIDO', 'ANULADO'],
  EN_TRANSITO: ['ACTIVO'],
  EN_PROCESO: ['ACTIVO', 'AGOTADO'],
  AGOTADO: [],
  VENDIDO: [],
  ANULADO: [],
};

export function puedeTransicionar(desde: EstadoLote, hacia: EstadoLote): boolean {
  return TRANSICIONES[desde].includes(hacia);
}
