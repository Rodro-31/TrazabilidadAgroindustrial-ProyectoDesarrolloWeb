import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { ESTADO_LOTE, fecha, kg, mensajeError, PRODUCTO } from '../../formato';
import Etiqueta from './Etiqueta';
import Movimientos from './Movimientos';
import { existenciaTotal, type LoteDetalle, type QrEmitido } from './tipos';

const ROLES_ETIQUETA = ['ADMIN', 'SUPERVISOR', 'BASCULA'];
const ROLES_ANULAR = ['ADMIN', 'SUPERVISOR'];

// Detalle del lote: datos, origen (recepciones y lotes padre), existencias e historial.
export default function DetalleLote({
  id,
  qrInicial,
  alVolver,
  alVerTrazabilidad,
}: {
  id: string;
  qrInicial?: QrEmitido; // presente justo después de crear el lote
  alVolver: () => void;
  alVerTrazabilidad: () => void;
}) {
  const { sesion } = useAuth();
  const rol = sesion!.rol;
  const [lote, setLote] = useState<LoteDetalle | null>(null);
  const [qr, setQr] = useState<QrEmitido | undefined>(qrInicial);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    api
      .get<LoteDetalle>(`/lotes/${id}`)
      .then(setLote)
      .catch((e) => setError(mensajeError(e)));
  }, [id]);

  useEffect(cargar, [cargar]);

  async function reimprimir() {
    if (!confirm('Se generará un QR nuevo y el anterior dejará de funcionar. ¿Continuar?')) return;
    setOcupado(true);
    try {
      const { data } = await api.post<QrEmitido>(`/lotes/${id}/qr`);
      setQr(data);
      setAviso('Etiqueta nueva generada. El QR anterior ya no es válido.');
    } catch (e) {
      setAviso(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function anular(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      const { data } = await api.post<LoteDetalle>(`/lotes/${id}/anular`, { motivo: motivo.trim() });
      setLote(data);
      setQr(undefined);
      setAnulando(false);
      setAviso('Lote anulado. Sus recepciones quedaron disponibles otra vez y su QR fue revocado.');
    } catch (err) {
      setAviso(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  if (error) return (<><p className="error">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!lote) return <p>Cargando…</p>;

  const activo = lote.estado === 'ACTIVO';

  return (
    <div>
      <div className="barra">
        <button onClick={alVolver}>← Volver a la lista</button>
        <div className="acciones">
          <button className="primario" onClick={alVerTrazabilidad}>Ver trazabilidad</button>
          {ROLES_ETIQUETA.includes(rol) && lote.estado !== 'ANULADO' && (
            <button onClick={reimprimir} disabled={ocupado}>Reimprimir etiqueta</button>
          )}
          {ROLES_ANULAR.includes(rol) && activo && !anulando && (
            <button className="peligro" onClick={() => setAnulando(true)}>Anular lote</button>
          )}
        </div>
      </div>

      <h2>
        Lote {lote.codigo} <span className={`insignia estado-${lote.estado}`}>{ESTADO_LOTE[lote.estado] ?? lote.estado}</span>
      </h2>

      {aviso && <p className="aviso" role="status">{aviso}</p>}

      {anulando && (
        <form className="panel" onSubmit={anular}>
          <h3>Anular lote {lote.codigo}</h3>
          <p className="nota">Solo para lotes creados por error. Queda registrado en el historial y la auditoría.</p>
          <label>
            Motivo <span className="obligatorio">*</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={300} required />
          </label>
          <div className="acciones">
            <button type="submit" className="peligro" disabled={ocupado}>Confirmar anulación</button>
            <button type="button" onClick={() => setAnulando(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {qr && <Etiqueta lote={lote} qr={qr} />}

      <dl className="datos">
        <div><dt>Producto</dt><dd>{PRODUCTO[lote.estadoProducto]}</dd></div>
        <div><dt>Grado</dt><dd>{lote.gradoCalidad?.nombre ?? 'Sin asignar'}</dd></div>
        <div><dt>Peso inicial</dt><dd>{kg(lote.pesoInicialKg)}</dd></div>
        <div><dt>Existencia actual</dt><dd>{kg(existenciaTotal(lote))}</dd></div>
        <div><dt>Creado en</dt><dd>{lote.centro.codigo} · {lote.centro.nombre}</dd></div>
        <div><dt>Cosecha</dt><dd>{lote.cosecha}</dd></div>
        <div><dt>Creado por</dt><dd>{lote.creadoPor.nombre} · {fecha(lote.creadoEn)}</dd></div>
        {lote.observaciones && <div><dt>Observaciones</dt><dd>{lote.observaciones}</dd></div>}
      </dl>

      <h3>Origen: recepciones</h3>
      <div className="tabla-caja">
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Fecha de recepción</th><th>Productor</th><th>Finca</th><th>Neto recibido</th><th>Aportado al lote</th></tr></thead>
            <tbody>
              {lote.recepciones.map((o) => (
                <tr key={o.recepcion.id}>
                  <td>{fecha(o.recepcion.capturadoEn)}</td>
                  <td>{o.recepcion.productor.codigo} – {o.recepcion.productor.nombre}</td>
                  <td>{o.recepcion.finca.nombre}</td>
                  <td>{kg(o.recepcion.pesoNetoKg)}</td>
                  <td>{kg(o.cantidadKg)}</td>
                </tr>
              ))}
              {lote.recepciones.length === 0 && <tr><td colSpan={5} className="vacio">Este lote nació de otros lotes (ver abajo).</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(lote.padres.length > 0 || lote.hijos.length > 0) && (
        <>
          <h3>Relación con otros lotes</h3>
          <ul className="lista">
            {lote.padres.map((p) => <li key={`p-${p.padre.id}`}>Viene de <strong>{p.padre.codigo}</strong> ({p.tipo.toLowerCase()}, {kg(p.cantidadKg)})</li>)}
            {lote.hijos.map((h) => <li key={`h-${h.hijo.id}`}>Pasó a <strong>{h.hijo.codigo}</strong> ({h.tipo.toLowerCase()}, {kg(h.cantidadKg)})</li>)}
          </ul>
        </>
      )}

      <h3>Existencias por centro</h3>
      {lote.existencias.length === 0 ? (
        <p className="nota">Sin existencia.</p>
      ) : (
        <ul className="lista">
          {lote.existencias.map((e) => <li key={e.centro.id}>{e.centro.codigo} · {e.centro.nombre}: <strong>{kg(e.cantidadKg)}</strong></li>)}
        </ul>
      )}

      <h3>Movimientos de inventario</h3>
      {/* key: se vuelve a pedir si el lote cambia (por ejemplo, después de anularlo). */}
      <Movimientos key={lote.estado} loteId={lote.id} codigo={lote.codigo} />

      <h3>Historial de estados</h3>
      <ol className="historial">
        {lote.historialEstados.map((h, i) => (
          <li key={i}>
            <span>
              {h.estadoAnterior ? `${ESTADO_LOTE[h.estadoAnterior]} → ` : ''}
              <strong>{ESTADO_LOTE[h.estadoNuevo] ?? h.estadoNuevo}</strong>
            </span>
            <small>{fecha(h.creadoEn)} · {h.usuario.nombre}{h.motivo ? ` · ${h.motivo}` : ''}</small>
          </li>
        ))}
      </ol>

      <p className="nota">
        Inspecciones: {lote._count.inspecciones} · Movimientos de inventario: {lote._count.movimientos} · Traslados: {lote._count.traslados} · Ventas: {lote._count.ventas}
      </p>
    </div>
  );
}
