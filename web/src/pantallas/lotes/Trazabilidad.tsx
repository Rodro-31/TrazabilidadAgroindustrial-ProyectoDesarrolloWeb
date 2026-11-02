import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ESTADO_LOTE, fecha, kg, mensajeError, PRODUCTO } from '../../formato';
import type { AristaLote, Trazabilidad as Datos } from './tipos';

const RELACION: Record<string, string> = { MEZCLA: 'Mezcla', DIVISION: 'División', TRANSFORMACION: 'Transformación' };

// Trazabilidad de un lote: hacia atrás hasta productores y fincas,
// hacia adelante hasta lotes derivados y ventas.
export default function Trazabilidad({
  id,
  alVolver,
  alAbrirLote,
}: {
  id: string;
  alVolver: () => void;
  alAbrirLote: (id: string) => void; // para saltar a otro lote del camino
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');

  // Se vuelve a pedir cada vez que cambia el id (al saltar a otro lote).
  useEffect(() => {
    setDatos(null);
    setError('');
    api.get<Datos>(`/lotes/${id}/trazabilidad`).then(setDatos).catch((e) => setError(mensajeError(e)));
  }, [id]);

  if (error) return (<><p className="error">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!datos) return <p>Cargando…</p>;

  const { lote, haciaAtras, haciaAdelante } = datos;

  return (
    <div>
      <div className="barra">
        <button onClick={alVolver}>← Volver al lote</button>
      </div>

      <h2>
        Trazabilidad del lote {lote.codigo}
        <span className={`insignia estado-${lote.estado}`}>{ESTADO_LOTE[lote.estado] ?? lote.estado}</span>
      </h2>
      <p className="nota">
        {PRODUCTO[lote.estadoProducto]} · {kg(lote.pesoInicialKg)} · creado en {lote.centro.codigo} {lote.centro.nombre}
      </p>

      {/* 1. HACIA ATRÁS: de dónde viene */}
      <h3>◀ Origen: productores y fincas</h3>
      {haciaAtras.recepciones.length === 0 ? (
        <p className="nota">Sin recepciones de origen.</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Productor</th><th>Finca</th><th>Kg aportados</th><th>Al lote</th><th>Recibido</th></tr>
            </thead>
            <tbody>
              {haciaAtras.recepciones.map((r) => (
                <tr key={`${r.recepcion.id}-${r.lote.codigo}`}>
                  <td>{r.recepcion.productor.codigo} · {r.recepcion.productor.nombre}</td>
                  <td>{r.recepcion.finca.nombre}</td>
                  <td>{kg(r.cantidadKg)}</td>
                  <td>{r.lote.codigo}</td>
                  <td>{fecha(r.recepcion.capturadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>◀ Lotes de los que proviene</h3>
      <Camino aristas={haciaAtras.lotes} vacio="Nació directo de recepciones (no viene de otros lotes)." alAbrirLote={alAbrirLote} />

      {/* 2. HACIA ADELANTE: a dónde fue */}
      <h3>Lotes que salieron de este ▶</h3>
      <Camino aristas={haciaAdelante.lotes} vacio="Todavía no se ha procesado." alAbrirLote={alAbrirLote} />

      <h3>Ventas ▶</h3>
      {haciaAdelante.ventas.length === 0 ? (
        <p className="nota">Sin ventas registradas.</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Comprador</th><th>País</th><th>Destino</th><th>Kg</th><th>Del lote</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {haciaAdelante.ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.comprador.nombre}</td>
                  <td>{v.comprador.pais}</td>
                  <td>{v.destino ?? '—'}</td>
                  <td>{kg(v.cantidadKg)}</td>
                  <td>{v.lote.codigo}</td>
                  <td>{fecha(v.vendidoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Aristas agrupadas por nivel (1 = vecino directo, 2 = el de después, ...).
function Camino({ aristas, vacio, alAbrirLote }: { aristas: AristaLote[]; vacio: string; alAbrirLote: (id: string) => void }) {
  if (aristas.length === 0) return <p className="nota">{vacio}</p>;

  const niveles = [...new Set(aristas.map((a) => a.nivel))].sort((a, b) => a - b);
  const enlace = (l: { id: string; codigo: string }) => (
    <button className="enlace" onClick={() => alAbrirLote(l.id)}>{l.codigo}</button>
  );

  return (
    <ol className="camino">
      {niveles.map((n) => (
        <li key={n}>
          <strong>Nivel {n}</strong>
          {aristas.filter((a) => a.nivel === n).map((a) => (
            <div key={`${a.padre.id}-${a.hijo.id}`}>
              {enlace(a.padre)} → {enlace(a.hijo)} <small>({RELACION[a.tipo] ?? a.tipo}, {kg(a.cantidadKg)})</small>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}