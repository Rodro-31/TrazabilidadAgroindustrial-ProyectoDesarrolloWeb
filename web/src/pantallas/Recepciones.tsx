import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, descargarBlob, listarTodo } from '../api';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg, mensajeError, PRODUCTO } from '../formato';
import { usePaginado } from '../hooks/usePaginado';

interface RecepcionFila {
  id: string;
  estadoProducto: string;
  pesoNetoKg: string;
  capturadoEn: string;
  centro: { id: string; nombre: string };
  productor: { id: string; codigo: string; nombre: string };
  finca: { nombre: string };
  registradoPor: { nombre: string };
}

interface Pesaje {
  id: string;
  pesoBrutoKg: string;
  taraKg: string;
  pesoNetoKg: string;
  motivo: string | null;
  creadoEn: string;
  registradoPor: { nombre: string };
}

interface RecepcionDetalle extends RecepcionFila {
  pesoBrutoKg: string;
  taraKg: string;
  humedadPct: string | null;
  observaciones: string | null;
  pesajes: Pesaje[];
}

// Una fecha "2026-11-01" del filtro se convierte al inicio o al final de ese día (hora local),
// porque la API compara contra instantes exactos.
const inicioDia = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
const finDia = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : '');

// Consulta de recepciones (solo lectura). La vista va en la URL: ?id=<recepción> para el detalle.
export default function Recepciones() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  return (
    <section>
      <h1>Recepciones</h1>
      {id ? <Detalle key={id} id={id} alVolver={() => setParams({})} /> : <Lista alAbrir={(r) => setParams({ id: r })} />}
    </section>
  );
}

function Lista({ alAbrir }: { alAbrir: (id: string) => void }) {
  const [centros, setCentros] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [productores, setProductores] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [f, setF] = useState({ centroId: '', productorId: '', estadoProducto: '', desde: '', hasta: '' });

  useEffect(() => {
    listarTodo<{ id: string; codigo: string; nombre: string }>('/centros').then(setCentros).catch(() => setCentros([]));
    listarTodo<{ id: string; codigo: string; nombre: string }>('/productores').then(setProductores).catch(() => setProductores([]));
  }, []);

  const lista = usePaginado<RecepcionFila>('/recepciones', {
    centroId: f.centroId,
    productorId: f.productorId,
    estadoProducto: f.estadoProducto,
    desde: inicioDia(f.desde),
    hasta: finDia(f.hasta),
  });
  const cambiar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });

  const columnas: Columna<RecepcionFila>[] = [
    { titulo: 'Capturada', celda: (r) => <button className="enlace" onClick={() => alAbrir(r.id)}>{fecha(r.capturadoEn)}</button> },
    { titulo: 'Productor', celda: (r) => `${r.productor.codigo} · ${r.productor.nombre}` },
    { titulo: 'Finca', celda: (r) => r.finca.nombre },
    { titulo: 'Centro', celda: (r) => r.centro.nombre },
    { titulo: 'Producto', celda: (r) => PRODUCTO[r.estadoProducto] ?? r.estadoProducto },
    { titulo: 'Peso neto', celda: (r) => kg(r.pesoNetoKg) },
    { titulo: 'Registró', celda: (r) => r.registradoPor.nombre },
  ];

  return (
    <>
      <form className="filtros" onSubmit={(e) => e.preventDefault()}>
        <label>
          Centro
          <select value={f.centroId} onChange={cambiar('centroId')}>
            <option value="">Todos los centros</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </label>
        <label>
          Productor
          <select value={f.productorId} onChange={cambiar('productorId')}>
            <option value="">Todos</option>
            {productores.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
          </select>
        </label>
        <label>
          Producto
          <select value={f.estadoProducto} onChange={cambiar('estadoProducto')}>
            <option value="">Todos</option>
            {Object.entries(PRODUCTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>Desde<input type="date" value={f.desde} onChange={cambiar('desde')} /></label>
        <label>Hasta<input type="date" value={f.hasta} onChange={cambiar('hasta')} /></label>
      </form>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(r) => r.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay recepciones con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}

function Detalle({ id, alVolver }: { id: string; alVolver: () => void }) {
  const [r, setR] = useState<RecepcionDetalle | null>(null);
  const [error, setError] = useState('');
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  const [errorFotos, setErrorFotos] = useState('');

  useEffect(() => {
    let vivo = true;
    const urls: string[] = [];
    api.get<RecepcionDetalle>(`/recepciones/${id}`).then((d) => vivo && setR(d)).catch((e) => vivo && setError(mensajeError(e)));
    api
      .get<{ id: string }[]>(`/recepciones/${id}/fotos`)
      .then((lista) =>
        Promise.all(
          lista.map(async (f) => {
            const url = URL.createObjectURL(await descargarBlob(`/archivos/${f.id}`));
            urls.push(url);
            return { id: f.id, url };
          }),
        ),
      )
      .then((con) => vivo && setFotos(con))
      .catch(() => vivo && setErrorFotos('No se pudieron cargar las fotos.'));
    return () => {
      vivo = false;
      urls.forEach((u) => URL.revokeObjectURL(u)); // las fotos viven solo mientras se mira el detalle
    };
  }, [id]);

  if (error) return (<><p className="error" role="alert">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!r) return <p>Cargando…</p>;

  return (
    <div>
      <div className="barra"><button onClick={alVolver}>← Volver a la lista</button></div>
      <h2>{r.productor.codigo} · {r.productor.nombre}</h2>

      <dl className="datos">
        <div><dt>Capturada</dt><dd>{fecha(r.capturadoEn)}</dd></div>
        <div><dt>Centro</dt><dd>{r.centro.nombre}</dd></div>
        <div><dt>Finca</dt><dd>{r.finca.nombre}</dd></div>
        <div><dt>Producto</dt><dd>{PRODUCTO[r.estadoProducto] ?? r.estadoProducto}</dd></div>
        <div><dt>Peso bruto</dt><dd>{kg(r.pesoBrutoKg)}</dd></div>
        <div><dt>Tara</dt><dd>{kg(r.taraKg)}</dd></div>
        <div><dt>Peso neto</dt><dd>{kg(r.pesoNetoKg)}</dd></div>
        {r.humedadPct && <div><dt>Humedad</dt><dd>{r.humedadPct} %</dd></div>}
        <div><dt>Registró</dt><dd>{r.registradoPor.nombre}</dd></div>
        {r.observaciones && <div><dt>Observaciones</dt><dd>{r.observaciones}</dd></div>}
      </dl>

      <h3>Fotos</h3>
      {errorFotos && <p className="error">{errorFotos}</p>}
      {!errorFotos && fotos.length === 0 && <p className="nota">Esta recepción no tiene fotos.</p>}
      <div className="galeria">
        {fotos.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
            <img src={f.url} alt="Foto de la recepción" />
          </a>
        ))}
      </div>

      <h3>Historial de pesajes</h3>
      <div className="tabla-caja">
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Bruto</th><th>Tara</th><th>Neto</th><th>Motivo</th><th>Registró</th></tr></thead>
            <tbody>
              {r.pesajes.map((p) => (
                <tr key={p.id}>
                  <td>{fecha(p.creadoEn)}</td>
                  <td>{kg(p.pesoBrutoKg)}</td>
                  <td>{kg(p.taraKg)}</td>
                  <td>{kg(p.pesoNetoKg)}</td>
                  <td>{p.motivo ?? '—'}</td>
                  <td>{p.registradoPor.nombre}</td>
                </tr>
              ))}
              {r.pesajes.length === 0 && <tr><td colSpan={6} className="vacio">Sin pesajes registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
