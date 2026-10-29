import Dexie, { type Table } from 'dexie';

// Cola offline: cada operación de campo se guarda aquí antes de enviarse.
// El id es un UUID generado en el cliente, así los reintentos no duplican datos.
export interface OperacionPendiente {
  id: string;
  tipo: string;
  payload: unknown;
  estado: 'PENDIENTE' | 'ENVIANDO' | 'ERROR';
  intentos: number;
  creadoEn: string;
}

class CampoDB extends Dexie {
  operaciones!: Table<OperacionPendiente, string>;

  constructor() {
    super('trazabilidad-campo');
    this.version(1).stores({
      operaciones: 'id, estado, creadoEn',
    });
  }
}

export const db = new CampoDB();
