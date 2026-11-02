import { useState } from 'react';
import { listarTodo } from '../api';
import { mensajeError } from '../formato';

// Una columna del archivo: título y cómo sacar el valor de cada fila.
export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

// Arma un CSV que Excel abre directo:
// - BOM (﻿) al inicio: Excel reconoce UTF-8 y muestra bien acentos y la ñ.
// - Comillas en cada celda y "" para las comillas internas (formato RFC 4180).
// - Separador "," y decimales con punto, como la configuración regional de Guatemala.
// - Inyección de fórmulas (CSV injection): un texto que empieza con = + - @ (o tabulador /
//   retorno) Excel lo ejecuta como fórmula. Se le antepone ' para que quede como texto.
//   Los números (incluidos los negativos del kárdex, "-300") no se tocan.
const NUMERO = /^-?\d+(\.\d+)?$/;
const PELIGROSO = /^[=+\-@\t\r]/;

function textoSeguro(v: unknown): string {
  const texto = String(v ?? '');
  return typeof v !== 'number' && !NUMERO.test(texto) && PELIGROSO.test(texto) ? `'${texto}` : texto;
}

export function descargarCsv<T>(nombre: string, columnas: ColumnaCsv<T>[], filas: T[]) {
  const celda = (v: unknown) => `"${textoSeguro(v).replace(/"/g, '""')}"`;
  const lineas = [
    columnas.map((c) => celda(c.titulo)).join(','),
    ...filas.map((f) => columnas.map((c) => celda(c.valor(f))).join(',')),
  ];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// Botón "Exportar a Excel" de los listados: descarga TODOS los registros que cumplen los
// filtros de la pantalla (no solo la página visible), recorriendo las páginas de la API.
export default function Exportar<T>({
  ruta,
  filtros = {},
  nombre,
  columnas,
}: {
  ruta: string;
  filtros?: Record<string, string>;
  nombre: string;
  columnas: ColumnaCsv<T>[];
}) {
  const [ocupado, setOcupado] = useState(false);

  async function exportar() {
    setOcupado(true);
    try {
      const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
      const filas = await listarTodo<T>(params.toString() ? `${ruta}?${params}` : ruta);
      descargarCsv(nombre, columnas, filas);
    } catch (e) {
      alert(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button type="button" onClick={exportar} disabled={ocupado} title="Descarga un archivo CSV que se abre en Excel">
      {ocupado ? 'Exportando…' : 'Exportar a Excel'}
    </button>
  );
}

// Botón para imprimir o guardar como PDF (el navegador ofrece "Guardar como PDF").
// Solo sale lo que está dentro de un elemento con la clase "documento" (ver estilos).
export function BotonPdf({ texto = 'Imprimir / PDF' }: { texto?: string }) {
  return (
    <button type="button" onClick={() => window.print()}>
      {texto}
    </button>
  );
}
