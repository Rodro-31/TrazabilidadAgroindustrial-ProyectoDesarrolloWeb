import Dexie, { type Table } from 'dexie';

// Cola offline: cada operación de campo se guarda aquí antes de enviarse.
// El id es un UUID generado en el cliente, así los reintentos no duplican datos.
export interface OperacionPendiente {
  id: string;
  tipo: 'recepcion';
  payload: unknown; // exactamente lo que se envía a la API
  resumen: string; // texto para mostrar en pantalla (no se envía)
  estado: 'PENDIENTE' | 'ENVIANDO' | 'ERROR';
  intentos: number;
  error?: string;
  creadoEn: string;
}

// Copia local de los catálogos para poder capturar sin conexión.
export interface CatalogoLocal {
  clave: 'centros' | 'productores' | 'fincas';
  datos: unknown[];
  actualizadoEn: string;
}

// El valor del QR solo lo entrega el servidor al crear la recepción: se guarda aquí
// para poder mostrar el comprobante después.
export interface Comprobante {
  recepcionId: string;
  valor: string;
  url: string | null;
  resumen: string;
  creadoEn: string;
}

class CampoDB extends Dexie {
  operaciones!: Table<OperacionPendiente, string>;
  catalogos!: Table<CatalogoLocal, string>;
  comprobantes!: Table<Comprobante, string>;

  constructor() {
    super('trazabilidad-campo');
    this.version(1).stores({
      operaciones: 'id, estado, creadoEn',
    });
    this.version(2).stores({
      operaciones: 'id, estado, creadoEn',
      catalogos: 'clave',
      comprobantes: 'recepcionId, creadoEn',
    });
  }
}

export const db = new CampoDB();
