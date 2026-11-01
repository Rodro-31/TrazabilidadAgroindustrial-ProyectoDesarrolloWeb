import type { ReactNode } from 'react';

export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  cargando?: boolean;
  error?: string;
  vacio?: string;
  pagina: number;
  limite: number;
  total: number;
  alCambiarPagina: (pagina: number) => void;
}

// Tabla con paginación del servidor ({ datos, total, pagina, limite }).
export default function Tabla<T>({
  columnas,
  filas,
  clave,
  cargando,
  error,
  vacio = 'No hay registros.',
  pagina,
  limite,
  total,
  alCambiarPagina,
}: Props<T>) {
  const paginas = Math.max(1, Math.ceil(total / limite));

  return (
    <div className="tabla-caja">
      {error && <p className="error" role="alert">{error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>{columnas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={clave(f)}>
                {columnas.map((c) => <td key={c.titulo}>{c.celda(f)}</td>)}
              </tr>
            ))}
            {!cargando && !error && filas.length === 0 && (
              <tr><td colSpan={columnas.length} className="vacio">{vacio}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <span>{cargando ? 'Cargando…' : `${total} registro(s)`}</span>
        <div>
          <button disabled={pagina <= 1 || cargando} onClick={() => alCambiarPagina(pagina - 1)}>Anterior</button>
          <span> Página {pagina} de {paginas} </span>
          <button disabled={pagina >= paginas || cargando} onClick={() => alCambiarPagina(pagina + 1)}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}
