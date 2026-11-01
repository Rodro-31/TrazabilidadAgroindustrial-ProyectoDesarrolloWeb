import { useEffect, useState } from 'react';
import { db, type Comprobante as ComprobanteLocal, type OperacionPendiente } from '../db';
import { descartar, EVENTO_COLA, reintentar, sincronizar } from '../sync';
import { fechaHora } from '../util';
import Comprobante from './Comprobante';
import type { Ruta } from '../App';

const ETIQUETA = { PENDIENTE: 'Por enviar', ENVIANDO: 'Enviando…', ERROR: 'Con error' } as const;

export default function Historial({ ir }: { ir: (r: Ruta) => void }) {
  const [ops, setOps] = useState<OperacionPendiente[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobanteLocal[]>([]);
  const [abierto, setAbierto] = useState('');

  async function cargar() {
    setOps(await db.operaciones.orderBy('creadoEn').reverse().toArray());
    setComprobantes(await db.comprobantes.orderBy('creadoEn').reverse().limit(50).toArray());
  }

  useEffect(() => {
    cargar();
    void sincronizar();
    window.addEventListener(EVENTO_COLA, cargar);
    return () => window.removeEventListener(EVENTO_COLA, cargar);
  }, []);

  return (
    <section>
      <h2>Por enviar</h2>
      {ops.length === 0 && <p className="nota">No tienes envíos pendientes.</p>}
      <ul className="lista">
        {ops.map((o) => (
          <li key={o.id} className={o.estado === 'ERROR' ? 'item error-item' : 'item'}>
            <strong>{ETIQUETA[o.estado]}</strong>
            <span>{o.resumen}</span>
            <small>{fechaHora(o.creadoEn)}</small>
            {o.error && <small className="error">{o.error}</small>}
            {o.estado === 'ERROR' && (
              <div className="fila">
                <button onClick={() => reintentar(o.id)}>Reintentar</button>
                <button
                  onClick={() => {
                    if (confirm('¿Descartar esta recepción? No se enviará.')) void descartar(o.id);
                  }}
                >
                  Descartar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2>Comprobantes enviados</h2>
      {comprobantes.length === 0 && <p className="nota">Aquí aparecerán los QR de tus recepciones ya enviadas.</p>}
      <ul className="lista">
        {comprobantes.map((c) => (
          <li key={c.recepcionId} className="item">
            <span>{c.resumen}</span>
            <small>{fechaHora(c.creadoEn)}</small>
            <div className="fila">
              <button onClick={() => setAbierto(abierto === c.recepcionId ? '' : c.recepcionId)}>
                {abierto === c.recepcionId ? 'Ocultar QR' : 'Ver QR'}
              </button>
              <button onClick={() => ir({ nombre: 'detalle', id: c.recepcionId })}>Detalle</button>
            </div>
            {abierto === c.recepcionId && <Comprobante url={c.url} valor={c.valor} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
