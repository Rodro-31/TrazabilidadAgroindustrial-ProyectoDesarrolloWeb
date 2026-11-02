// Formas de las respuestas de /api/v1/lotes que usan las pantallas.

export interface QrEmitido {
  valor: string;
  url: string | null;
}

interface Ref {
  id: string;
  codigo: string;
  nombre: string;
}

export interface LoteFila {
  id: string;
  codigo: string;
  estado: string;
  estadoProducto: string;
  pesoInicialKg: string;
  cosecha: number;
  creadoEn: string;
  centro: Ref;
  gradoCalidad: Ref | null;
  existencias: { cantidadKg: string; centro: Ref }[];
}

export interface LoteDetalle extends LoteFila {
  observaciones: string | null;
  creadoPor: { id: string; nombre: string };
  recepciones: {
    cantidadKg: string;
    recepcion: {
      id: string;
      capturadoEn: string;
      estadoProducto: string;
      pesoNetoKg: string;
      productor: Ref;
      finca: { id: string; nombre: string };
    };
  }[];
  padres: { tipo: string; cantidadKg: string; padre: { id: string; codigo: string } }[];
  hijos: { tipo: string; cantidadKg: string; hijo: { id: string; codigo: string } }[];
  historialEstados: {
    estadoAnterior: string | null;
    estadoNuevo: string;
    motivo: string | null;
    creadoEn: string;
    usuario: { id: string; nombre: string };
  }[];
  _count: { inspecciones: number; movimientos: number; traslados: number; ventas: number };
}

export interface RecepcionDisponible {
  id: string;
  capturadoEn: string;
  estadoProducto: string;
  pesoNetoKg: string;
  asignadoKg: string;
  disponibleKg: string;
  productor: Ref;
  finca: { id: string; nombre: string };
}

// Existencia actual sumando todos los centros con saldo.
export const existenciaTotal = (l: LoteFila) => l.existencias.reduce((s, e) => s + Number(e.cantidadKg), 0);
