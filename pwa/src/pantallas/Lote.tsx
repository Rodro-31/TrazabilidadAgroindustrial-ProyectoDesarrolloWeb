import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Ruta } from '../App';
import { fechaHora, kg } from '../util';

interface Lote {
  id: string;
  codigo: string;
  estado: string;
  estadoProducto: string;
  pesoInicialKg: string;
  cosecha: number;
  observaciones: string | null;
  creadoEn: string;
  centro: { nombre: string };
  gradoCalidad: { codigo: string; nombre: string } | null;
  creadoPor: { nombre: string };
  recepciones: {
    cantidadKg: string;
    recepcion: {
      id: string;
      capturadoEn: string;
      estadoProducto: string;
      productor: { codigo: string; nombre: string };
      finca: { nombre: string };
    };
  }[];
  padres: { tipo: string; cantidadKg: string; padre: { codigo: string } }[];
  hijos: { tipo: string; cantidadKg: string; hijo: { codigo: string } }[];
  existencias: { cantidadKg: string; centro: { nombre: string } }[];
  historialEstados: { estadoAnterior: string | null; estadoNuevo: string; motivo: string | null; creadoEn: string; usuario: { nombre: string } }[];
}

const ESTADO: Record<string, string> = {
  ACTIVO: 'Activo (en bodega)',
  EN_TRANSITO: 'En tránsito',
  EN_PROCESO: 'En proceso',
  AGOTADO: 'Agotado',
  VENDIDO: 'Vendido',
  ANULADO: 'Anulado',
};

// Detalle de un lote al escanear su QR: estado, dónde está, cuánto queda y de qué
// recepciones viene. Solo lectura; las operaciones sobre el lote se hacen en el panel web.
export default function LoteDetalle({ id, ir }: { id: string; ir: (r: Ruta) => void }) {
  const [l, setL] = useState<Lote | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Lote>(`/lotes/${id}`)
      .then(setL)
      .catch((e: ApiError) => setError(e.status === 0 ? 'Sin conexión: el lote se consulta con internet.' : e.message));
  }, [id]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!l) return <p>Cargando…</p>;

  const existencia = l.existencias.reduce((s, e) => s + Number(e.cantidadKg), 0);

  return (
    <section className="detalle">
      <h2>Lote {l.codigo}</h2>
      <p className={l.estado === 'ANULADO' ? 'error' : 'aviso'}>{ESTADO[l.estado] ?? l.estado}</p>
      <dl>
        <dt>Producto</dt><dd>Cardamomo {l.estadoProducto.toLowerCase()}</dd>
        <dt>Grado</dt><dd>{l.gradoCalidad ? `${l.gradoCalidad.codigo} · ${l.gradoCalidad.nombre}` : 'Sin clasificar'}</dd>
        <dt>Cosecha</dt><dd>{l.cosecha}</dd>
        <dt>Peso inicial</dt><dd>{kg(l.pesoInicialKg)}</dd>
        <dt>Existencia</dt><dd><strong>{kg(existencia)}</strong></dd>
        <dt>Centro de origen</dt><dd>{l.centro.nombre}</dd>
        <dt>Creado</dt><dd>{fechaHora(l.creadoEn)} · {l.creadoPor.nombre}</dd>
        {l.observaciones && (<><dt>Observaciones</dt><dd>{l.observaciones}</dd></>)}
      </dl>

      {l.existencias.length > 0 && (
        <>
          <h3>Dónde está</h3>
          <ul className="lista">
            {l.existencias.map((e) => (
              <li key={e.centro.nombre} className="item">
                <strong>{e.centro.nombre}</strong>
                <small>{kg(e.cantidadKg)}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {l.recepciones.length > 0 && (
        <>
          <h3>Recepciones de origen ({l.recepciones.length})</h3>
          <ul className="lista">
            {l.recepciones.map(({ cantidadKg, recepcion: r }) => (
              <li key={r.id}>
                <button className="item tocable" onClick={() => ir({ nombre: 'detalle', id: r.id })}>
                  <strong>{r.productor.codigo} · {r.productor.nombre}</strong>
                  <small>{kg(cantidadKg)} · {r.finca.nombre} · {fechaHora(r.capturadoEn)}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {l.padres.length > 0 && (
        <>
          <h3>Viene de los lotes</h3>
          <ul className="lista">
            {l.padres.map((p) => (
              <li key={p.padre.codigo} className="item">
                <strong>{p.padre.codigo}</strong>
                <small>{p.tipo.toLowerCase()} · {kg(p.cantidadKg)}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {l.hijos.length > 0 && (
        <>
          <h3>Pasó a los lotes</h3>
          <ul className="lista">
            {l.hijos.map((h) => (
              <li key={h.hijo.codigo} className="item">
                <strong>{h.hijo.codigo}</strong>
                <small>{h.tipo.toLowerCase()} · {kg(h.cantidadKg)}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {l.historialEstados.length > 0 && (
        <>
          <h3>Historial de estados</h3>
          <ul className="lista">
            {l.historialEstados.map((h, i) => (
              <li key={i} className="item">
                <strong>{h.estadoAnterior ? `${ESTADO[h.estadoAnterior] ?? h.estadoAnterior} → ` : ''}{ESTADO[h.estadoNuevo] ?? h.estadoNuevo}</strong>
                <small>{fechaHora(h.creadoEn)} · {h.usuario.nombre}</small>
                {h.motivo && <small>Motivo: {h.motivo}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
