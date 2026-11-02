// Formatos de presentación compartidos por las pantallas.

// La API devuelve los Decimal (kg, precios) como texto: "418" o "245.5".
export const kg = (valor: string | number | null | undefined) =>
  valor == null || valor === ''
    ? '—'
    : `${Number(valor).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;

// Montos en quetzales (también llegan como texto).
export const quetzales = (valor: string | number | null | undefined) =>
  valor == null || valor === ''
    ? '—'
    : `Q ${Number(valor).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fecha =(iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const soloFecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-GT') : '—';

export const PRODUCTO: Record<string, string> = { UVA: 'Uva', PERGAMINO: 'Pergamino', ORO: 'Oro' };

export const ESTADO_LOTE: Record<string, string> = {
  ACTIVO: 'Activo',
  EN_TRANSITO: 'En tránsito',
  EN_PROCESO: 'En proceso',
  AGOTADO: 'Agotado',
  VENDIDO: 'Vendido',
  ANULADO: 'Anulado',
};

// Mensaje legible de un error de la API (con la lista de validaciones si viene).
export function mensajeError(e: unknown): string {
  const err = e as { status?: number; message?: string; errores?: string[] };
  if (err?.status === 0) return 'Sin conexión con el servidor.';
  // 403: la API explica el motivo cuando es una regla de negocio (p. ej. quien crea no aprueba).
  if (err?.status === 403) return err.message ?? 'No tienes permiso para esta operación.';
  const base = err?.message ?? 'Ocurrió un error.';
  return err?.errores?.length ? `${base}: ${err.errores.join('; ')}` : base;
}
