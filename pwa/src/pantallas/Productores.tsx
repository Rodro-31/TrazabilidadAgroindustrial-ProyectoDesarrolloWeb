import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { Ruta } from '../App';
import type { Catalogos } from '../catalogos';
import { db } from '../db';
import { fechaHora, kg } from '../util';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Búsqueda sobre la copia local del catálogo: funciona sin conexión.
export function BuscarProductor({ catalogos, ir }: { catalogos: Catalogos; ir: (r: Ruta) => void }) {
  const [texto, setTexto] = useState('');
  const resultados = useMemo(() => {
    const t = normalizar(texto.trim());
    const lista = t
      ? catalogos.productores.filter((p) => normalizar(`${p.codigo} ${p.nombre}`).includes(t))
      : catalogos.productores;
    return lista.slice(0, 50);
  }, [texto, catalogos.productores]);

  return (
    <section>
      <label>
        Buscar por nombre o código
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </label>
      {catalogos.productores.length === 0 && <p className="nota">Aún no se descargan los productores (necesita internet la primera vez).</p>}
      {catalogos.productores.length > 0 && resultados.length === 0 && <p className="nota">Ningún productor coincide.</p>}
      <ul className="lista">
        {resultados.map((p) => (
          <li key={p.id}>
            <button className="item tocable" onClick={() => ir({ nombre: 'productor', id: p.id })}>
              <strong>{p.nombre}</strong>
              <small>{p.codigo}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DetalleProductor {
  telefono: string | null;
  municipio: string | null;
  departamento: string | null;
  organizacion: { nombre: string } | null;
  fincas: { id: string; nombre: string }[];
}
interface Entrega {
  id: string;
  capturadoEn: string;
  estadoProducto: string;
  pesoNetoKg: string;
  centro: { nombre: string };
  finca: { nombre: string };
}

// Productor y sus entregas recientes. Sin conexión muestra lo guardado en el teléfono:
// datos básicos del catálogo y las recepciones que aún esperan envío.
export function Productor({ id, catalogos, ir }: { id: string; catalogos: Catalogos; ir: (r: Ruta) => void }) {
  const basico = catalogos.productores.find((p) => p.id === id);
  const fincasLocales = catalogos.fincas.filter((f) => f.productor.id === id);
  const [detalle, setDetalle] = useState<DetalleProductor | null>(null);
  const [entregas, setEntregas] = useState<Entrega[] | null>(null);
  const [pendientes, setPendientes] = useState<{ id: string; resumen: string; creadoEn: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    db.operaciones
      .toArray()
      .then((ops) =>
        setPendientes(
          ops
            .filter((o) => o.tipo === 'recepcion' && (o.payload as { productorId?: string })?.productorId === id)
            .map((o) => ({ id: o.id, resumen: o.resumen, creadoEn: o.creadoEn })),
        ),
      );
    Promise.all([api.get<DetalleProductor>(`/productores/${id}`), api.get<Entrega[]>(`/productores/${id}/recepciones?limite=10`)])
      .then(([d, e]) => {
        setDetalle(d);
        setEntregas(e);
      })
      .catch((e: ApiError) =>
        setError(e.status === 0 ? 'Sin conexión: se muestran solo los datos guardados en el teléfono.' : e.message),
      );
  }, [id]);

  const total = entregas?.reduce((s, e) => s + Number(e.pesoNetoKg), 0) ?? 0;
  const fincas = detalle?.fincas ?? fincasLocales;
  const ubicacion = [detalle?.municipio, detalle?.departamento].filter(Boolean).join(', ');

  return (
    <section className="detalle">
      <h2>{basico ? `${basico.codigo} · ${basico.nombre}` : 'Productor'}</h2>
      <dl>
        {detalle?.organizacion && (<><dt>Organización</dt><dd>{detalle.organizacion.nombre}</dd></>)}
        {ubicacion && (<><dt>Ubicación</dt><dd>{ubicacion}</dd></>)}
        {detalle?.telefono && (<><dt>Teléfono</dt><dd><a href={`tel:${detalle.telefono}`}>{detalle.telefono}</a></dd></>)}
        <dt>Fincas</dt><dd>{fincas.length ? fincas.map((f) => f.nombre).join(', ') : 'Ninguna activa'}</dd>
      </dl>
      {error && <p className="nota" role="status">{error}</p>}

      {pendientes.length > 0 && (
        <>
          <h3>Por enviar desde este teléfono</h3>
          <ul className="lista">
            {pendientes.map((p) => (
              <li key={p.id} className="item">
                <strong>{p.resumen}</strong>
                <small>{fechaHora(p.creadoEn)} · pendiente de envío</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {entregas && (
        <>
          <h3>Entregas recientes</h3>
          {entregas.length === 0 ? (
            <p className="nota">Este productor todavía no tiene entregas registradas.</p>
          ) : (
            <>
              <p className="nota">Últimas {entregas.length}: {kg(total)} netos.</p>
              <ul className="lista">
                {entregas.map((e) => (
                  <li key={e.id}>
                    <button className="item tocable" onClick={() => ir({ nombre: 'detalle', id: e.id })}>
                      <strong>Neto {kg(e.pesoNetoKg)} · {e.estadoProducto.toLowerCase()}</strong>
                      <small>{fechaHora(e.capturadoEn)} · {e.centro.nombre} · {e.finca.nombre}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
