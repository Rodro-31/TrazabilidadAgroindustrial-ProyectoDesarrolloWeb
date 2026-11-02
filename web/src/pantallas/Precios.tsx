import { FormEvent, useEffect, useState } from 'react';
import { api, listarTodo } from '../api';
import { useAuth } from '../auth';
import Exportar from '../componentes/Exportar';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, mensajeError, PRODUCTO, quetzales } from '../formato';
import { usePaginado } from '../hooks/usePaginado';

const ROLES_CREAR = ['ADMIN', 'SUPERVISOR'];

interface Precio {
  id: string;
  estadoProducto: string;
  precioPorKg: string;
  moneda: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  estado: 'VIGENTE' | 'PROGRAMADO' | 'CERRADO';
  gradoCalidad: { id: string; nombre: string } | null;
  creadoPor: { nombre: string };
}

const ESTADO: Record<string, { texto: string; clase: string }> = {
  VIGENTE: { texto: 'Vigente', clase: 'ok' },
  PROGRAMADO: { texto: 'Programado', clase: 'estado-EN_PROCESO' },
  CERRADO: { texto: 'Cerrado', clase: 'apagada' },
};
const grado = (p: Precio) => p.gradoCalidad?.nombre ?? 'General (sin grado)';
const hoy = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

// Precios por kg que usan las liquidaciones. No se editan: un precio nuevo reemplaza al
// vigente del mismo producto y grado, y el anterior queda en el historial.
export default function Precios() {
  const { sesion } = useAuth();
  const rol = sesion!.rol;
  const [version, setVersion] = useState(0); // al crear o cerrar, se recargan las dos tablas
  const [aviso, setAviso] = useState('');

  async function cerrar(p: Precio) {
    if (!confirm(`¿Cerrar el precio de ${PRODUCTO[p.estadoProducto]} · ${grado(p)}? Las recepciones nuevas quedarán sin precio hasta crear otro.`)) return;
    try {
      await api.post(`/precios/${p.id}/cerrar`);
      setAviso('Precio cerrado.');
      setVersion((v) => v + 1);
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  return (
    <section>
      <h1>Precios</h1>
      <p className="nota">Quetzales por kg según producto y grado de calidad. Las liquidaciones usan el precio vigente en la fecha de cada recepción.</p>
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      <h2>Vigentes hoy</h2>
      <Vigentes key={`v${version}`} puedeCerrar={rol === 'ADMIN'} alCerrar={cerrar} />

      {ROLES_CREAR.includes(rol) && (
        <NuevoPrecio
          alCrear={(p) => {
            setAviso(`Precio registrado: ${PRODUCTO[p.estadoProducto]} · ${grado(p)} a ${quetzales(p.precioPorKg)}/kg. El anterior quedó en el historial.`);
            setVersion((v) => v + 1);
          }}
        />
      )}

      <h2>Historial</h2>
      <Historial key={`h${version}`} />
    </section>
  );
}

function Vigentes({ puedeCerrar, alCerrar }: { puedeCerrar: boolean; alCerrar: (p: Precio) => void }) {
  const [precios, setPrecios] = useState<Precio[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    listarTodo<Precio>('/precios?vigentes=true').then(setPrecios).catch((e) => setError(mensajeError(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!precios) return <p className="nota">Cargando…</p>;
  if (precios.length === 0) return <p className="aviso">No hay precios vigentes: las liquidaciones no podrán calcularse.</p>;

  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr><th>Producto</th><th>Grado</th><th>Precio por kg</th><th>Desde</th><th>Registrado por</th>{puedeCerrar && <th></th>}</tr>
        </thead>
        <tbody>
          {precios.map((p) => (
            <tr key={p.id}>
              <td>{PRODUCTO[p.estadoProducto]}</td>
              <td>{grado(p)}</td>
              <td><strong>{quetzales(p.precioPorKg)}</strong></td>
              <td>{fecha(p.vigenteDesde)}</td>
              <td>{p.creadoPor.nombre}</td>
              {puedeCerrar && <td><button onClick={() => alCerrar(p)}>Cerrar</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NuevoPrecio({ alCrear }: { alCrear: (p: Precio) => void }) {
  const [grados, setGrados] = useState<{ id: string; nombre: string }[]>([]);
  const [producto, setProducto] = useState('UVA');
  const [gradoId, setGradoId] = useState('');
  const [precio, setPrecio] = useState('');
  const [desde, setDesde] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarTodo<{ id: string; nombre: string }>('/grados-calidad?activo=true').then(setGrados).catch(() => setGrados([]));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const { data } = await api.post<Precio>('/precios', {
        estadoProducto: producto,
        ...(gradoId && { gradoCalidadId: gradoId }),
        precioPorKg: Number(precio),
        // Hoy = desde este momento; otra fecha = desde las 00:00 de ese día (hora de Guatemala).
        ...(desde !== hoy() && { vigenteDesde: `${desde}T00:00:00-06:00` }),
      });
      setPrecio('');
      alCrear(data);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h3>Nuevo precio</h3>
      <p className="nota">Reemplaza al precio vigente del mismo producto y grado; el anterior se cierra y queda en el historial.</p>
      <div className="rejilla">
        <label>
          Producto <span className="obligatorio">*</span>
          <select value={producto} onChange={(e) => setProducto(e.target.value)}>
            {Object.entries(PRODUCTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          Grado de calidad
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)}>
            <option value="">General (sin grado)</option>
            {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label>
          Precio por kg (Q) <span className="obligatorio">*</span>
          <input type="number" step="0.01" min="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
        </label>
        <label>
          Vigente desde
          <input type="date" value={desde} min={hoy()} onChange={(e) => setDesde(e.target.value)} required />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button type="submit" className="primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar precio'}</button>
      </div>
    </form>
  );
}

function Historial() {
  const [f, setF] = useState({ estadoProducto: '' });
  const lista = usePaginado<Precio>('/precios', f);
  const columnas: Columna<Precio>[] = [
    { titulo: 'Estado', celda: (p) => <span className={`insignia ${ESTADO[p.estado].clase}`}>{ESTADO[p.estado].texto}</span> },
    { titulo: 'Producto', celda: (p) => PRODUCTO[p.estadoProducto] },
    { titulo: 'Grado', celda: grado },
    { titulo: 'Precio por kg', celda: (p) => quetzales(p.precioPorKg) },
    { titulo: 'Desde', celda: (p) => fecha(p.vigenteDesde) },
    { titulo: 'Hasta', celda: (p) => (p.vigenteHasta ? fecha(p.vigenteHasta) : '—') },
    { titulo: 'Registrado por', celda: (p) => p.creadoPor.nombre },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>
            Producto
            <select value={f.estadoProducto} onChange={(e) => setF({ estadoProducto: e.target.value })}>
              <option value="">Todos</option>
              {Object.entries(PRODUCTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        </form>
        <Exportar<Precio>
          ruta="/precios"
          filtros={f}
          nombre="precios"
          columnas={[
            { titulo: 'Estado', valor: (p) => ESTADO[p.estado].texto },
            { titulo: 'Producto', valor: (p) => PRODUCTO[p.estadoProducto] },
            { titulo: 'Grado', valor: grado },
            { titulo: 'Precio por kg (GTQ)', valor: (p) => p.precioPorKg },
            { titulo: 'Desde', valor: (p) => fecha(p.vigenteDesde) },
            { titulo: 'Hasta', valor: (p) => (p.vigenteHasta ? fecha(p.vigenteHasta) : '') },
            { titulo: 'Registrado por', valor: (p) => p.creadoPor.nombre },
          ]}
        />
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(p) => p.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay precios registrados."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}
