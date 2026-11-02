import { FormEvent, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, descargarBlob, listarTodo } from '../api';
import { useAuth } from '../auth';
import Exportar from '../componentes/Exportar';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg, mensajeError, PRODUCTO } from '../formato';
import { usePaginado } from '../hooks/usePaginado';
import { ROLES_INSPECCIONAR } from './Calidad';

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

const ROLES_QR = ['ADMIN', 'SUPERVISOR', 'BASCULA'];
// Los mismos roles que la API acepta en POST /recepciones/:id/pesajes.
const ROLES_PESAJE = ['ADMIN', 'SUPERVISOR', 'BASCULA'];

// Una fecha "2026-11-01" del filtro se convierte al inicio o al final de ese día (hora local),
// porque la API compara contra instantes exactos.
const inicioDia = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
const finDia = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : '');

// Consulta de recepciones; báscula, supervisor y admin además registran pesajes y reimprimen el QR. La vista va en la URL: ?id=<recepción> para el detalle.
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

  const filtros = {
    centroId: f.centroId,
    productorId: f.productorId,
    estadoProducto: f.estadoProducto,
    desde: inicioDia(f.desde),
    hasta: finDia(f.hasta),
  };
  const lista = usePaginado<RecepcionFila>('/recepciones', filtros);
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
      <div className="acciones exportar-recepciones">
        <Exportar<RecepcionFila>
          ruta="/recepciones"
          filtros={filtros}
          nombre="recepciones"
          columnas={[
            { titulo: 'Capturada', valor: (r) => fecha(r.capturadoEn) },
            { titulo: 'Código productor', valor: (r) => r.productor.codigo },
            { titulo: 'Productor', valor: (r) => r.productor.nombre },
            { titulo: 'Finca', valor: (r) => r.finca.nombre },
            { titulo: 'Centro', valor: (r) => r.centro.nombre },
            { titulo: 'Producto', valor: (r) => PRODUCTO[r.estadoProducto] ?? r.estadoProducto },
            { titulo: 'Peso neto (kg)', valor: (r) => r.pesoNetoKg },
            { titulo: 'Registró', valor: (r) => r.registradoPor.nombre },
          ]}
        />
      </div>
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
  const { sesion } = useAuth();
  const [qr, setQr] = useState<{ valor: string; url: string | null } | null>(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const navegar = useNavigate();

  async function nuevoQr() {
    if (!confirm('Se emitirá un QR nuevo y el anterior dejará de servir. ¿Continuar?')) return;
    setOcupado(true);
    setAviso('');
    try {
      const { data } = await api.post<{ valor: string; url: string | null }>(`/recepciones/${id}/qr`);
      setQr(data);
      setAviso('QR nuevo emitido. El anterior ya no es válido.');
    } catch (e) {
      setAviso(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

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
      <div className="barra">
        <button onClick={alVolver}>← Volver a la lista</button>
        <div className="acciones">
          {ROLES_INSPECCIONAR.includes(sesion?.rol ?? '') && (
            <button onClick={() => navegar(`/calidad?nuevo=1&recepcionId=${id}`)}>Inspeccionar calidad</button>
          )}
          {ROLES_QR.includes(sesion?.rol ?? '') && (
            <button onClick={nuevoQr} disabled={ocupado}>Reimprimir comprobante (QR nuevo)</button>
          )}
        </div>
      </div>
      <h2>{r.productor.codigo} · {r.productor.nombre}</h2>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {qr && <ComprobanteQr qr={qr} resumen={`${r.productor.codigo} · ${r.productor.nombre}`} detalle={`${PRODUCTO[r.estadoProducto] ?? r.estadoProducto} · neto ${kg(r.pesoNetoKg)}`} />}

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

      {ROLES_PESAJE.includes(sesion?.rol ?? '') && <NuevoPesaje id={r.id} alGuardar={setR} />}
    </div>
  );
}

// Kilos con máximo 2 decimales; acepta coma o punto. null = inválido, undefined = vacío.
function leerKg(texto: string): number | null | undefined {
  const t = texto.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return null;
  return n;
}

// Báscula: un pesaje nuevo no borra el anterior, se agrega al historial y pasa a ser el
// peso vigente. La API lo rechaza (409) si la recepción ya está en un lote o liquidada.
function NuevoPesaje({ id, alGuardar }: { id: string; alGuardar: (r: RecepcionDetalle) => void }) {
  const [bruto, setBruto] = useState('');
  const [tara, setTara] = useState('');
  const [motivo, setMotivo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'aviso' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const b = leerKg(bruto);
  const t = leerKg(tara) ?? 0;
  const neto = typeof b === 'number' && typeof t === 'number' ? b - t : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    if (typeof b !== 'number' || b <= 0) return setMensaje({ tipo: 'error', texto: 'Peso bruto inválido (mayor que 0, máximo 2 decimales).' });
    if (t === null) return setMensaje({ tipo: 'error', texto: 'Tara inválida (máximo 2 decimales).' });
    if (neto === null || neto <= 0) return setMensaje({ tipo: 'error', texto: 'La tara debe ser menor que el peso bruto.' });
    setEnviando(true);
    try {
      const { data } = await api.post<RecepcionDetalle>(`/recepciones/${id}/pesajes`, {
        pesoBrutoKg: b,
        taraKg: t,
        ...(motivo.trim() && { motivo: motivo.trim() }),
      });
      alGuardar(data);
      setBruto('');
      setTara('');
      setMotivo('');
      setMensaje({ tipo: 'aviso', texto: 'Pesaje registrado. El anterior queda en el historial.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="panel" onSubmit={enviar}>
      <h3>Registrar nuevo pesaje</h3>
      <div className="rejilla">
        <label>Peso bruto (kg) <span className="obligatorio">*</span><input inputMode="decimal" value={bruto} onChange={(e) => setBruto(e.target.value)} required /></label>
        <label>Tara (kg)<input inputMode="decimal" value={tara} onChange={(e) => setTara(e.target.value)} placeholder="0" /></label>
        <label>Motivo<input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: corrección de báscula" /></label>
      </div>
      {neto !== null && neto > 0 && <p className="nota">Peso neto: {kg(neto)}</p>}
      {mensaje && <p className={mensaje.tipo} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}
      <div className="acciones">
        <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar pesaje'}</button>
      </div>
      <p className="nota">No se puede cambiar el peso si la recepción ya forma parte de un lote o fue liquidada.</p>
    </form>
  );
}

// Comprobante de la recepción: el QR lleva solo la URL con un valor aleatorio (sin datos del productor).
// El valor existe únicamente al emitirlo: en la base queda su hash.
function ComprobanteQr({ qr, resumen, detalle }: { qr: { valor: string; url: string | null }; resumen: string; detalle: string }) {
  const [imagen, setImagen] = useState('');
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(qr.url ?? qr.valor, { margin: 1, width: 280 }).then((d) => vivo && setImagen(d));
    return () => {
      vivo = false;
    };
  }, [qr]);

  return (
    <div className="panel">
      <div className="etiqueta imprimible">
        {imagen ? <img src={imagen} alt="Código QR de la recepción" width={180} height={180} /> : <p>Generando QR…</p>}
        <div>
          <strong className="etiqueta-codigo">{resumen}</strong>
          <span>{detalle}</span>
        </div>
      </div>
      <div className="acciones">
        <button className="primario" onClick={() => window.print()} disabled={!imagen}>Imprimir comprobante</button>
      </div>
      <p className="nota">Muéstralo en pantalla para escanearlo con la PWA, o imprímelo. Por seguridad no se vuelve a mostrar: si se pierde, emite uno nuevo.</p>
    </div>
  );
}
