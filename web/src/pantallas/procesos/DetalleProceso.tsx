import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ESTADO_LOTE, fecha, kg, mensajeError, PRODUCTO } from '../../formato';
import Etiqueta from '../lotes/Etiqueta';
import type { LoteDetalle, QrEmitido } from '../lotes/tipos';
import { TIPO_PROCESO, type LineaProceso, type ProcesoDetalle } from './tipos';

// Detalle del proceso: qué lotes entraron, cuáles salieron y la merma.
// Justo después de crearlo trae los QR de los lotes nuevos para imprimir sus etiquetas.
export default function DetalleProceso({
  id,
  qrs,
  alVolver,
}: {
  id: string;
  qrs?: { loteId: string; qr: QrEmitido }[];
  alVolver: () => void;
}) {
  const [proceso, setProceso] = useState<ProcesoDetalle | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ProcesoDetalle>(`/procesos/${id}`).then(setProceso).catch((e) => setError(mensajeError(e)));
  }, [id]);

  if (error) return (<><p className="error">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!proceso) return <p>Cargando…</p>;

  const entra = proceso.entradas.reduce((s, l) => s + Number(l.cantidadKg), 0);
  const merma = Number(proceso.mermaKg);

  return (
    <div>
      <div className="barra">
        <button onClick={alVolver}>← Volver a la lista</button>
      </div>

      <h2>
        Proceso {proceso.codigo} <span className="insignia">{TIPO_PROCESO[proceso.tipo] ?? proceso.tipo}</span>
      </h2>
      <p className="nota">
        {proceso.centro.codigo} · {proceso.centro.nombre} · {fecha(proceso.realizadoEn)} · por {proceso.realizadoPor.nombre}
      </p>
      {proceso.observaciones && <p>{proceso.observaciones}</p>}

      {qrs && qrs.length > 0 && (
        <>
          <p className="aviso" role="status">Proceso registrado. Imprime ahora las etiquetas de los lotes nuevos: su QR no se vuelve a mostrar.</p>
          {qrs.map((q) => <EtiquetaLote key={q.loteId} loteId={q.loteId} qr={q.qr} />)}
        </>
      )}

      <div className="paneles">
        <section className="panel">
          <h3>Entraron</h3>
          <Lineas lineas={proceso.entradas} />
        </section>
        <section className="panel">
          <h3>Salieron</h3>
          <Lineas lineas={proceso.salidas} />
        </section>
      </div>

      <p className="total">
        Entraron <strong>{kg(entra)}</strong> · salieron <strong>{kg(entra - merma)}</strong> · merma{' '}
        <strong>{kg(merma)}</strong>
        {entra > 0 && ` (${((merma / entra) * 100).toFixed(1)} %)`}
      </p>
    </div>
  );
}

function Lineas({ lineas }: { lineas: LineaProceso[] }) {
  return (
    <ul className="recientes">
      {lineas.map((l) => (
        <li key={l.lote.id}>
          <Link to={`/lotes?id=${l.lote.id}`}>{l.lote.codigo}</Link>
          <span>
            <span className={`insignia estado-${l.lote.estado}`}>{ESTADO_LOTE[l.lote.estado] ?? l.lote.estado}</span>{' '}
            {kg(l.cantidadKg)} · {PRODUCTO[l.lote.estadoProducto]}
          </span>
        </li>
      ))}
    </ul>
  );
}

// La etiqueta necesita los datos completos del lote: se piden aquí.
function EtiquetaLote({ loteId, qr }: { loteId: string; qr: QrEmitido }) {
  const [lote, setLote] = useState<LoteDetalle | null>(null);
  useEffect(() => {
    api.get<LoteDetalle>(`/lotes/${loteId}`).then(setLote).catch(() => setLote(null));
  }, [loteId]);
  return lote ? <Etiqueta lote={lote} qr={qr} /> : null;
}
