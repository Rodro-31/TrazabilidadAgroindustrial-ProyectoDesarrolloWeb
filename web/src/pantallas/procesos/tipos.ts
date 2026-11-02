// Formas de las respuestas de /api/v1/procesos y reglas que se muestran en el formulario.
import type { QrEmitido } from '../lotes/tipos';

interface LoteRef {
  id: string;
  codigo: string;
}

export interface ProcesoFila {
  id: string;
  codigo: string;
  tipo: string;
  mermaKg: string;
  realizadoEn: string;
  centro: { id: string; codigo: string; nombre: string };
  realizadoPor: { id: string; nombre: string };
  relaciones: { tipo: string; cantidadKg: string; padre: LoteRef; hijo: LoteRef }[];
}

// Una línea de entrada o salida: sale del libro de inventario (kg exactos de cada lote).
export interface LineaProceso {
  cantidadKg: string;
  lote: LoteRef & { estado: string; estadoProducto: string };
}

export interface ProcesoDetalle extends ProcesoFila {
  observaciones: string | null;
  creadoEn: string;
  entradas: LineaProceso[];
  salidas: LineaProceso[];
}

export interface ProcesoCreado extends ProcesoDetalle {
  qrs: { loteId: string; codigo: string; qr: QrEmitido }[];
}

export const TIPO_PROCESO: Record<string, string> = {
  MEZCLA: 'Mezcla',
  DIVISION: 'División',
  SECADO: 'Secado',
  LIMPIEZA: 'Limpieza',
  CLASIFICACION: 'Clasificación',
};

// Copia de api/src/procesos/reglas.ts para guiar al usuario antes de enviar.
// La API valida lo mismo: esto solo evita llegar al error.
export const REGLAS: Record<string, { entradas: 'una' | 'varias'; salidas: 'una' | 'varias' | 'una o varias'; desde?: string; hacia?: string; ayuda: string }> = {
  MEZCLA: { entradas: 'varias', salidas: 'una', ayuda: 'Junta 2 o más lotes del mismo producto en uno nuevo.' },
  DIVISION: { entradas: 'una', salidas: 'varias', ayuda: 'Reparte un lote en 2 o más lotes nuevos.' },
  SECADO: { entradas: 'una', salidas: 'una', desde: 'UVA', hacia: 'PERGAMINO', ayuda: 'Uva → pergamino. La merma es el agua que se evapora.' },
  LIMPIEZA: { entradas: 'una', salidas: 'una', desde: 'PERGAMINO', hacia: 'ORO', ayuda: 'Pergamino → oro. La merma es basura, tallos y cápsulas malas.' },
  CLASIFICACION: { entradas: 'una', salidas: 'una o varias', ayuda: 'Separa un lote por grado de calidad (un lote nuevo por grado).' },
};
