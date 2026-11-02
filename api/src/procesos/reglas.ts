import { EstadoProducto, TipoProceso, TipoRelacionLote } from '@prisma/client';

// Reglas de cada tipo de proceso: cuántos lotes entran, cuántos salen y en qué
// estado queda el producto. Como en transiciones.ts, una tabla en lugar de muchos if.
interface Regla {
  entradas: 'una' | 'varias'; // varias = 2 o más
  salidas: 'una' | 'varias' | 'una o varias';
  // Estado de producto que debe tener la entrada → estado de la salida.
  // Si no hay transformación, el producto sale igual que entró.
  transforma?: { desde: EstadoProducto; hacia: EstadoProducto };
}

export const REGLAS: Record<TipoProceso, Regla> = {
  MEZCLA: { entradas: 'varias', salidas: 'una' }, // varios lotes → uno
  DIVISION: { entradas: 'una', salidas: 'varias' }, // un lote → varios
  SECADO: { entradas: 'una', salidas: 'una', transforma: { desde: 'UVA', hacia: 'PERGAMINO' } },
  LIMPIEZA: { entradas: 'una', salidas: 'una', transforma: { desde: 'PERGAMINO', hacia: 'ORO' } },
  CLASIFICACION: { entradas: 'una', salidas: 'una o varias' }, // un lote → uno por grado
};

// Devuelve el error a mostrar, o null si la cantidad de entradas y salidas es válida.
export function validarForma(tipo: TipoProceso, entradas: number, salidas: number): string | null {
  const regla = REGLAS[tipo];
  if (regla.entradas === 'una' && entradas !== 1) return `${tipo} recibe exactamente un lote`;
  if (regla.entradas === 'varias' && entradas < 2) return `${tipo} necesita al menos dos lotes`;
  if (regla.salidas === 'una' && salidas !== 1) return `${tipo} produce exactamente un lote`;
  if (regla.salidas === 'varias' && salidas < 2) return `${tipo} produce al menos dos lotes`;
  return null;
}

// Tipo de arista que se guarda en lote_relacion (lo que lee la trazabilidad).
export function tipoRelacion(tipo: TipoProceso, salidas: number): TipoRelacionLote {
  if (tipo === 'MEZCLA') return 'MEZCLA';
  if (tipo === 'DIVISION' || salidas > 1) return 'DIVISION';
  return 'TRANSFORMACION';
}
