import { useState } from 'react';
import Tabla, { type Columna } from '../componentes/Tabla';
import { usePaginado } from '../hooks/usePaginado';

interface Registro {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes: unknown;
  despues: unknown;
  ip: string | null;
  creadoEn: string;
  usuario: { nombre: string; email: string; rol: string } | null;
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'medium' });

// Las fechas del filtro son días completos en hora local.
const inicioDia = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
const finDia = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : '');

export default function Auditoria() {
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const lista = usePaginado<Registro>('/auditoria', {
    entidad: entidad.trim(),
    accion: accion.trim(),
    desde: inicioDia(desde),
    hasta: finDia(hasta),
  });

  const columnas: Columna<Registro>[] = [
    { titulo: 'Fecha', celda: (r) => fecha(r.creadoEn) },
    {
      titulo: 'Usuario',
      celda: (r) => (r.usuario ? <>{r.usuario.nombre} <small>({r.usuario.rol})</small></> : <em>sin usuario</em>),
    },
    { titulo: 'Acción', celda: (r) => r.accion },
    {
      titulo: 'Entidad',
      celda: (r) => (
        <>
          {r.entidad}
          {r.entidadId && <small title={r.entidadId}> {r.entidadId.slice(0, 8)}…</small>}
        </>
      ),
    },
    { titulo: 'IP', celda: (r) => r.ip ?? '—' },
    {
      titulo: 'Detalle',
      celda: (r) =>
        r.antes || r.despues ? (
          <details>
            <summary>Ver</summary>
            {r.antes != null && (<><strong>Antes</strong><pre>{JSON.stringify(r.antes, null, 2)}</pre></>)}
            {r.despues != null && (<><strong>Después</strong><pre>{JSON.stringify(r.despues, null, 2)}</pre></>)}
          </details>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <section>
      <h1>Auditoría</h1>
      <form className="filtros" onSubmit={(e) => e.preventDefault()}>
        <label>Entidad<input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="recepcion, lote…" /></label>
        <label>Acción<input value={accion} onChange={(e) => setAccion(e.target.value)} placeholder="POST, LOGIN_FALLIDO…" /></label>
        <label>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </form>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(r) => r.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay registros con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </section>
  );
}
