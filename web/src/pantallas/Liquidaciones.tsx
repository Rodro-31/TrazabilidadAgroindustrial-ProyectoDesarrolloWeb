import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, listarTodo } from '../api';
import { useAuth } from '../auth';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg, mensajeError, PRODUCTO, quetzales, soloFecha } from '../formato';
import { usePaginado } from '../hooks/usePaginado';

const ROLES_CREAR = ['ADMIN', 'SUPERVISOR'];

interface Ref {
  id: string;
  codigo: string;
  nombre: string;
}

interface Liquidacion {
  id: string;
  codigo: string;
  estado: string;
  periodoInicio: string;
  periodoFin: string;
  totalKg: string;
  totalMonto: string;
  creadoEn: string;
  aprobadoEn: string | null;
  pagadoEn: string | null;
  productor: Ref;
  creadoPor: { id: string; nombre: string };
  aprobadoPor: { nombre: string } | null;
  _count: { detalles: number };
}

interface LiquidacionDetalle extends Liquidacion {
  detalles: {
    pesoKg: string;
    precioPorKg: string;
    subtotal: string;
    recepcion: { id: string; capturadoEn: string; estadoProducto: string; finca: { nombre: string }; centro: { codigo: string } };
  }[];
}

interface Calculo {
  productor: Ref;
  lineas: {
    recepcionId: string;
    capturadoEn: string;
    estadoProducto: string;
    finca: string;
    centro: string;
    grado: { nombre: string } | null;
    pesoKg: string;
    precioPorKg: string | null;
    subtotal: string | null;
    problema: string | null;
  }[];
  totalKg: string;
  totalMonto: string;
  sinPrecio: number;
}

const ESTADO: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: '' },
  APROBADA: { texto: 'Aprobada', clase: 'estado-EN_PROCESO' },
  PAGADA: { texto: 'Pagada', clase: 'ok' },
  ANULADA: { texto: 'Anulada', clase: 'apagada' },
};
const Insignia = ({ estado }: { estado: string }) => <span className={`insignia ${ESTADO[estado]?.clase ?? ''}`}>{ESTADO[estado]?.texto ?? estado}</span>;
// Las fechas del período vienen como día completo (sin hora): se muestran tal cual.
const dia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const hoy = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

// Liquidaciones a productores: kg × precio vigente. BORRADOR → APROBADA (otra persona) → PAGADA.
export default function Liquidaciones() {
  const { sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const puedeCrear = ROLES_CREAR.includes(sesion!.rol);
  const volver = () => setParams({});

  let vista;
  if (id) vista = <DetalleLiquidacion key={id} id={id} alVolver={volver} />;
  else if (params.get('nuevo') && puedeCrear) vista = <NuevaLiquidacion alCancelar={volver} alCrear={(l) => setParams({ id: l })} />;
  else vista = <ListaLiquidaciones puedeCrear={puedeCrear} alAbrir={(l) => setParams({ id: l })} alNuevo={() => setParams({ nuevo: '1' })} />;

  return (
    <section>
      <h1>Liquidaciones</h1>
      {vista}
    </section>
  );
}

function ListaLiquidaciones({ puedeCrear, alAbrir, alNuevo }: { puedeCrear: boolean; alAbrir: (id: string) => void; alNuevo: () => void }) {
  const [productores, setProductores] = useState<Ref[]>([]);
  const [f, setF] = useState({ estado: '', productorId: '' });
  useEffect(() => {
    listarTodo<Ref>('/productores').then(setProductores).catch(() => setProductores([]));
  }, []);
  const lista = usePaginado<Liquidacion>('/liquidaciones', f);
  const cambiar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });

  const columnas: Columna<Liquidacion>[] = [
    { titulo: 'Código', celda: (l) => <button className="enlace" onClick={() => alAbrir(l.id)}>{l.codigo}</button> },
    { titulo: 'Estado', celda: (l) => <Insignia estado={l.estado} /> },
    { titulo: 'Productor', celda: (l) => `${l.productor.codigo} · ${l.productor.nombre}` },
    { titulo: 'Período', celda: (l) => `${dia(l.periodoInicio)} – ${dia(l.periodoFin)}` },
    { titulo: 'Kg', celda: (l) => kg(l.totalKg) },
    { titulo: 'Monto', celda: (l) => <strong>{quetzales(l.totalMonto)}</strong> },
    { titulo: 'Creada', celda: (l) => `${soloFecha(l.creadoEn)} · ${l.creadoPor.nombre}` },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>
            Estado
            <select value={f.estado} onChange={cambiar('estado')}>
              <option value="">Todos</option>
              {Object.entries(ESTADO).map(([v, e]) => <option key={v} value={v}>{e.texto}</option>)}
            </select>
          </label>
          <label>
            Productor
            <select value={f.productorId} onChange={cambiar('productorId')}>
              <option value="">Todos</option>
              {productores.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
            </select>
          </label>
        </form>
        {puedeCrear && <button className="primario" onClick={alNuevo}>Nueva liquidación</button>}
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(l) => l.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay liquidaciones con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}

function NuevaLiquidacion({ alCrear, alCancelar }: { alCrear: (id: string) => void; alCancelar: () => void }) {
  const [productores, setProductores] = useState<Ref[]>([]);
  const [productorId, setProductorId] = useState('');
  const [desde, setDesde] = useState(() => new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(hoy);
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarTodo<Ref>('/productores?activo=true').then(setProductores).catch((e) => setError(mensajeError(e)));
  }, []);
  // Cualquier cambio en los datos invalida la vista previa.
  useEffect(() => setCalculo(null), [productorId, desde, hasta]);

  const periodo = { productorId, periodoInicio: desde, periodoFin: hasta };

  async function calcular() {
    setError('');
    setOcupado(true);
    try {
      setCalculo(await api.get<Calculo>(`/liquidaciones/calcular?${new URLSearchParams(periodo)}`));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    setError('');
    setOcupado(true);
    try {
      const { data } = await api.post<{ id: string }>('/liquidaciones', periodo);
      alCrear(data.id);
    } catch (e) {
      setError(mensajeError(e));
      setOcupado(false);
    }
  }

  const pagables = calculo ? calculo.lineas.length - calculo.sinPrecio : 0;

  return (
    <div className="panel">
      <h2>Nueva liquidación</h2>
      <p className="nota">Se pagan las recepciones del período que todavía no están liquidadas: kg netos × precio vigente en la fecha de la recepción, según el producto y el grado de su inspección de calidad.</p>
      <div className="rejilla">
        <label>
          Productor <span className="obligatorio">*</span>
          <select value={productorId} onChange={(e) => setProductorId(e.target.value)}>
            <option value="">— Elegir —</option>
            {productores.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>
      <div className="acciones">
        <button className="primario" onClick={calcular} disabled={ocupado || !productorId}>Calcular</button>
        <button onClick={alCancelar}>Cancelar</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {calculo && (
        <>
          <h3>Vista previa</h3>
          {calculo.lineas.length === 0 ? (
            <p className="aviso">{calculo.productor.nombre} no tiene recepciones pendientes de liquidar en ese período.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr><th>Recepción</th><th>Producto</th><th>Grado</th><th>Finca</th><th>Kg netos</th><th>Precio/kg</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {calculo.lineas.map((l) => (
                    <tr key={l.recepcionId}>
                      <td>{fecha(l.capturadoEn)} · {l.centro}</td>
                      <td>{PRODUCTO[l.estadoProducto]}</td>
                      <td>{l.grado?.nombre ?? '—'}</td>
                      <td>{l.finca}</td>
                      <td>{kg(l.pesoKg)}</td>
                      {l.problema ? (
                        <td colSpan={2} className="error">{l.problema}</td>
                      ) : (
                        <>
                          <td>{quetzales(l.precioPorKg!)}</td>
                          <td><strong>{quetzales(l.subtotal!)}</strong></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="total">
            {pagables} recepción(es) · <strong>{kg(calculo.totalKg)}</strong> · total a pagar <strong>{quetzales(calculo.totalMonto)}</strong>
          </p>
          {calculo.sinPrecio > 0 && (
            <p className="nota">{calculo.sinPrecio} recepción(es) sin precio quedan pendientes para otra liquidación.</p>
          )}
          <div className="acciones">
            <button className="primario" onClick={crear} disabled={ocupado || pagables === 0}>Crear borrador</button>
          </div>
        </>
      )}
    </div>
  );
}

function DetalleLiquidacion({ id, alVolver }: { id: string; alVolver: () => void }) {
  const { sesion } = useAuth();
  const rol = sesion!.rol;
  const [l, setL] = useState<LiquidacionDetalle | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.get<LiquidacionDetalle>(`/liquidaciones/${id}`).then(setL).catch((e) => setError(mensajeError(e)));
  }, [id]);

  async function accion(ruta: string, mensaje: string, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return;
    setOcupado(true);
    setAviso('');
    try {
      const { data } = await api.post<LiquidacionDetalle>(`/liquidaciones/${id}/${ruta}`);
      setL(data);
      setAviso(mensaje);
    } catch (e) {
      setAviso(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  if (error) return (<><p className="error">{error}</p><button onClick={alVolver}>Volver</button></>);
  if (!l) return <p>Cargando…</p>;

  const gestiona = ROLES_CREAR.includes(rol);

  return (
    <div>
      <div className="barra">
        <button onClick={alVolver}>← Volver a la lista</button>
        <div className="acciones">
          {l.estado === 'BORRADOR' && gestiona && (
            <button className="primario" disabled={ocupado} onClick={() => accion('aprobar', 'Liquidación aprobada. Falta registrar el pago.')}>Aprobar</button>
          )}
          {l.estado === 'APROBADA' && rol === 'ADMIN' && (
            <button className="primario" disabled={ocupado} onClick={() => accion('pagar', 'Pago registrado.', `¿Registrar el pago de ${quetzales(l.totalMonto)} a ${l.productor.nombre}?`)}>Registrar pago</button>
          )}
          {['BORRADOR', 'APROBADA'].includes(l.estado) && gestiona && (
            <button className="peligro" disabled={ocupado} onClick={() => accion('anular', 'Liquidación anulada: sus recepciones quedaron libres para liquidarse de nuevo.', '¿Anular esta liquidación?')}>Anular</button>
          )}
        </div>
      </div>

      <h2>Liquidación {l.codigo} <Insignia estado={l.estado} /></h2>
      <p className="nota">{l.productor.codigo} · {l.productor.nombre} · período {dia(l.periodoInicio)} – {dia(l.periodoFin)}</p>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {l.estado === 'BORRADOR' && <p className="nota">La aprueba una persona distinta de quien la creó ({l.creadoPor.nombre}).</p>}

      <ul className="lista">
        <li>Creada {fecha(l.creadoEn)} por {l.creadoPor.nombre}</li>
        {l.aprobadoEn && <li>Aprobada {fecha(l.aprobadoEn)} por {l.aprobadoPor?.nombre}</li>}
        {l.pagadoEn && <li>Pagada {fecha(l.pagadoEn)}</li>}
      </ul>

      {l.detalles.length > 0 ? (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Recepción</th><th>Producto</th><th>Finca</th><th>Kg</th><th>Precio/kg</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              {l.detalles.map((d) => (
                <tr key={d.recepcion.id}>
                  <td>{fecha(d.recepcion.capturadoEn)} · {d.recepcion.centro.codigo}</td>
                  <td>{PRODUCTO[d.recepcion.estadoProducto]}</td>
                  <td>{d.recepcion.finca.nombre}</td>
                  <td>{kg(d.pesoKg)}</td>
                  <td>{quetzales(d.precioPorKg)}</td>
                  <td><strong>{quetzales(d.subtotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="nota">Anulada: sus recepciones quedaron libres. Se conservan los totales que se habían calculado.</p>
      )}
      <p className="total">Total: <strong>{kg(l.totalKg)}</strong> · <strong>{quetzales(l.totalMonto)}</strong></p>
    </div>
  );
}
