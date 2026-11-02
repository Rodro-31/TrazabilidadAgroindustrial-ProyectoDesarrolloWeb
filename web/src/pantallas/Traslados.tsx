import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, listarTodo } from '../api';
import { useAuth } from '../auth';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg, mensajeError, PRODUCTO } from '../formato';
import { usePaginado } from '../hooks/usePaginado';
import type { LoteFila } from './lotes/tipos';

const ROLES_DESPACHAR = ['ADMIN', 'SUPERVISOR', 'BASCULA'];
const ROLES_CANCELAR = ['ADMIN', 'SUPERVISOR'];

interface Centro {
  id: string;
  codigo: string;
  nombre: string;
}

interface Traslado {
  id: string;
  codigo: string;
  estado: string;
  cantidadKg: string;
  cantidadRecibidaKg: string | null;
  observaciones: string | null;
  despachadoEn: string | null;
  recibidoEn: string | null;
  lote: { id: string; codigo: string; estado: string; estadoProducto: string };
  origen: Centro;
  destino: Centro;
  solicitadoPor: { nombre: string };
  recibidoPor: { nombre: string } | null;
}

interface Confirmacion {
  valor: string;
  expiraEn: string;
}

const ESTADO_TRASLADO: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Pendiente', clase: '' },
  EN_TRANSITO: { texto: 'En tránsito', clase: 'estado-EN_TRANSITO' },
  RECIBIDO: { texto: 'Recibido', clase: 'ok' },
  CANCELADO: { texto: 'Cancelado', clase: 'apagada' },
};

const Insignia = ({ estado }: { estado: string }) => (
  <span className={`insignia ${ESTADO_TRASLADO[estado]?.clase ?? ''}`}>{ESTADO_TRASLADO[estado]?.texto ?? estado}</span>
);

// Traslados entre centros: despachar (el lote queda en tránsito) y recibir en destino con
// el código de confirmación. La vista va en la URL: ?id=<traslado>, ?nuevo=1.
export default function Traslados() {
  const { sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  // El código de confirmación solo llega al despachar: se guarda para mostrarlo en el detalle.
  const [recien, setRecien] = useState<{ id: string; confirmacion: Confirmacion } | null>(null);
  const id = params.get('id');
  const rol = sesion!.rol;
  const volver = () => setParams({});

  let vista;
  if (id) {
    vista = <DetalleTraslado key={id} id={id} confirmacion={recien?.id === id ? recien.confirmacion : undefined} alVolver={volver} />;
  } else if (params.get('nuevo') && ROLES_DESPACHAR.includes(rol)) {
    vista = (
      <NuevoTraslado
        alCancelar={volver}
        alCrear={(t) => {
          setRecien({ id: t.id, confirmacion: t.confirmacion });
          setParams({ id: t.id });
        }}
      />
    );
  } else {
    vista = <ListaTraslados puedeCrear={ROLES_DESPACHAR.includes(rol)} alAbrir={(t) => setParams({ id: t })} alNuevo={() => setParams({ nuevo: '1' })} />;
  }

  return (
    <section>
      <h1>Traslados</h1>
      {vista}
    </section>
  );
}

function ListaTraslados({ puedeCrear, alAbrir, alNuevo }: { puedeCrear: boolean; alAbrir: (id: string) => void; alNuevo: () => void }) {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [f, setF] = useState({ estado: '', centroId: '' });
  useEffect(() => {
    listarTodo<Centro>('/centros').then(setCentros).catch(() => setCentros([]));
  }, []);
  const lista = usePaginado<Traslado>('/traslados', f);
  const cambiar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });

  const columnas: Columna<Traslado>[] = [
    { titulo: 'Código', celda: (t) => <button className="enlace" onClick={() => alAbrir(t.id)}>{t.codigo}</button> },
    { titulo: 'Estado', celda: (t) => <Insignia estado={t.estado} /> },
    { titulo: 'Lote', celda: (t) => t.lote.codigo },
    { titulo: 'Ruta', celda: (t) => `${t.origen.codigo} → ${t.destino.codigo}` },
    { titulo: 'Enviado', celda: (t) => kg(t.cantidadKg) },
    { titulo: 'Recibido', celda: (t) => (t.cantidadRecibidaKg ? kg(t.cantidadRecibidaKg) : '—') },
    { titulo: 'Despachado', celda: (t) => fecha(t.despachadoEn) },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>
            Estado
            <select value={f.estado} onChange={cambiar('estado')}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_TRASLADO).map(([v, e]) => <option key={v} value={v}>{e.texto}</option>)}
            </select>
          </label>
          <label>
            Sale o llega a
            <select value={f.centroId} onChange={cambiar('centroId')}>
              <option value="">Todos los centros</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </label>
        </form>
        {puedeCrear && <button className="primario" onClick={alNuevo}>Despachar lote</button>}
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(t) => t.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay traslados con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}

function NuevoTraslado({ alCrear, alCancelar }: { alCrear: (t: Traslado & { confirmacion: Confirmacion }) => void; alCancelar: () => void }) {
  const [lotes, setLotes] = useState<LoteFila[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loteId, setLoteId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ datos: LoteFila[] }>('/lotes?estado=ACTIVO&limite=100').then((r) => setLotes(r.datos)).catch((e) => setError(mensajeError(e)));
    listarTodo<Centro>('/centros?activo=true').then(setCentros).catch((e) => setError(mensajeError(e)));
  }, []);

  const lote = lotes.find((l) => l.id === loteId);
  const dondeEsta = lote?.existencias.find((e) => Number(e.cantidadKg) > 0);

  async function despachar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const { data } = await api.post<Traslado & { confirmacion: Confirmacion }>('/traslados', {
        loteId,
        destinoId,
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
      });
      alCrear(data);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="panel" onSubmit={despachar}>
      <h2>Despachar lote a otro centro</h2>
      <p className="nota">El lote sale completo del centro donde está y queda “en tránsito” hasta que el destino lo reciba con el código de confirmación.</p>
      <div className="rejilla">
        <label>
          Lote <span className="obligatorio">*</span>
          <select value={loteId} onChange={(e) => { setLoteId(e.target.value); setDestinoId(''); }} required>
            <option value="">— Elegir —</option>
            {lotes.map((l) => {
              const e = l.existencias.find((x) => Number(x.cantidadKg) > 0);
              return <option key={l.id} value={l.id}>{l.codigo} · {PRODUCTO[l.estadoProducto]} · {e ? `${kg(e.cantidadKg)} en ${e.centro.codigo}` : 'sin existencia'}</option>;
            })}
          </select>
        </label>
        <label>
          Centro de destino <span className="obligatorio">*</span>
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} required disabled={!lote}>
            <option value="">— Elegir —</option>
            {centros.filter((c) => c.id !== dondeEsta?.centro.id).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </label>
      </div>
      {lote && dondeEsta && (
        <p className="total">
          Sale de <strong>{dondeEsta.centro.codigo}</strong>: <strong>{kg(dondeEsta.cantidadKg)}</strong> de {PRODUCTO[lote.estadoProducto].toLowerCase()}
        </p>
      )}
      <label>
        Observaciones (transporte, placa, piloto…)
        <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button type="submit" className="primario" disabled={guardando || !loteId || !destinoId}>{guardando ? 'Despachando…' : 'Despachar'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function DetalleTraslado({ id, confirmacion, alVolver }: { id: string; confirmacion?: Confirmacion; alVolver: () => void }) {
  const { sesion } = useAuth();
  const rol = sesion!.rol;
  const [t, setT] = useState<Traslado | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [recibidoKg, setRecibidoKg] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.get<Traslado>(`/traslados/${id}`).then((d) => { setT(d); setRecibidoKg(String(Number(d.cantidadKg))); }).catch((e) => setError(mensajeError(e)));
  }, [id]);

  async function enviar(ruta: string, cuerpo: unknown, mensaje: string) {
    setOcupado(true);
    setAviso('');
    try {
      const { data } = await api.post<Traslado>(`/traslados/${id}/${ruta}`, cuerpo);
      setT(data);
      setCancelando(false);
      setAviso(mensaje);
    } catch (err) {
      setAviso(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  if (error) return (<><p className="error">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!t) return <p>Cargando…</p>;

  const enTransito = t.estado === 'EN_TRANSITO';
  const merma = t.cantidadRecibidaKg ? Number(t.cantidadKg) - Number(t.cantidadRecibidaKg) : 0;

  return (
    <div>
      <div className="barra">
        <button onClick={alVolver}>← Volver a la lista</button>
        {enTransito && ROLES_CANCELAR.includes(rol) && !cancelando && (
          <button className="peligro" onClick={() => setCancelando(true)}>Cancelar traslado</button>
        )}
      </div>
      <h2>Traslado {t.codigo} <Insignia estado={t.estado} /></h2>
      <p className="nota">
        Lote <Link to={`/lotes?id=${t.lote.id}`}>{t.lote.codigo}</Link> · {PRODUCTO[t.lote.estadoProducto]} · {t.origen.codigo} {t.origen.nombre} → {t.destino.codigo} {t.destino.nombre}
      </p>
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      {confirmacion && enTransito && <CodigoConfirmacion codigo={t.codigo} confirmacion={confirmacion} />}

      <ul className="lista">
        <li>Enviado: <strong>{kg(t.cantidadKg)}</strong> · despachado {fecha(t.despachadoEn)} por {t.solicitadoPor.nombre}</li>
        {t.cantidadRecibidaKg && (
          <li>
            Recibido: <strong>{kg(t.cantidadRecibidaKg)}</strong> · {fecha(t.recibidoEn)} por {t.recibidoPor?.nombre}
            {merma > 0 && <> · merma en tránsito <strong>{kg(merma)}</strong></>}
          </li>
        )}
        {t.observaciones && <li>{t.observaciones}</li>}
      </ul>

      {cancelando && (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); enviar('cancelar', { motivo: motivo.trim() }, 'Traslado cancelado: el lote volvió al centro de origen y el código quedó anulado.'); }}>
          <h3>Cancelar traslado {t.codigo}</h3>
          <label>
            Motivo <span className="obligatorio">*</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={300} required />
          </label>
          <div className="acciones">
            <button type="submit" className="peligro" disabled={ocupado}>Confirmar cancelación</button>
            <button type="button" onClick={() => setCancelando(false)}>Volver</button>
          </div>
        </form>
      )}

      {enTransito && ROLES_DESPACHAR.includes(rol) && !cancelando && (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); enviar('recibir', { token: codigo.trim(), cantidadRecibidaKg: Number(recibidoKg) }, 'Traslado recibido: el lote ya está en el inventario del centro de destino.'); }}>
          <h3>Recibir en {t.destino.codigo}</h3>
          <p className="nota">Pide al transportista el código de confirmación (o escanea su QR) y pesa el producto al llegar.</p>
          <div className="rejilla">
            <label>
              Código de confirmación <span className="obligatorio">*</span>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required minLength={10} autoComplete="off" />
            </label>
            <label>
              Kg recibidos (báscula)
              <input type="number" step="0.01" min="0.01" max={Number(t.cantidadKg)} value={recibidoKg} onChange={(e) => setRecibidoKg(e.target.value)} required />
            </label>
          </div>
          <div className="acciones">
            <button type="submit" className="primario" disabled={ocupado}>Confirmar recepción</button>
          </div>
        </form>
      )}
    </div>
  );
}

// El código de confirmación solo se ve al despachar (en la base queda su hash). El QR
// lleva el mismo código para que en destino se lea con la cámara en vez de escribirlo.
function CodigoConfirmacion({ codigo, confirmacion }: { codigo: string; confirmacion: Confirmacion }) {
  const [imagen, setImagen] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(confirmacion.valor, { margin: 1, width: 240 }).then(setImagen);
  }, [confirmacion.valor]);

  return (
    <div className="panel">
      <div className="etiqueta imprimible">
        {imagen && <img src={imagen} alt={`Código de confirmación del traslado ${codigo}`} width={160} height={160} />}
        <div>
          <strong className="etiqueta-codigo">{codigo}</strong>
          <span>Código de confirmación para el centro de destino</span>
          <code className="codigo-confirmacion">{confirmacion.valor}</code>
          <span>Vence: {fecha(confirmacion.expiraEn)} · sirve una sola vez</span>
        </div>
      </div>
      <div className="acciones">
        <button className="primario" onClick={() => window.print()}>Imprimir comprobante</button>
        <button onClick={() => navigator.clipboard.writeText(confirmacion.valor).then(() => setCopiado(true))}>{copiado ? 'Copiado ✓' : 'Copiar código'}</button>
      </div>
      <p className="nota">Entrégalo al transportista: por seguridad este código no se vuelve a mostrar.</p>
    </div>
  );
}
