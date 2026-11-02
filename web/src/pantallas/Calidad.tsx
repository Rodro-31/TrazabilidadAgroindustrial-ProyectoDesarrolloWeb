import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, listarTodo } from '../api';
import { useAuth } from '../auth';
import Exportar from '../componentes/Exportar';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg, mensajeError } from '../formato';
import { usePaginado } from '../hooks/usePaginado';

// Los mismos roles que la API acepta en POST /calidad/inspecciones.
export const ROLES_INSPECCIONAR = ['ADMIN', 'SUPERVISOR', 'CALIDAD'];

interface Inspeccion {
  id: string;
  recepcionId: string | null;
  loteId: string | null;
  humedadPct: string | null;
  impurezasPct: string | null;
  defectosPct: string | null;
  aprobado: boolean;
  observaciones: string | null;
  inspeccionadoEn: string;
  gradoCalidad: { codigo: string; nombre: string } | null;
  inspector: { nombre: string };
  recepcion: { id: string; productor: { codigo: string; nombre: string } } | null;
  lote: { id: string; codigo: string } | null;
}

const objetivo = (i: Inspeccion) =>
  i.lote ? `Lote ${i.lote.codigo}` : i.recepcion ? `Recepción ${i.recepcion.productor.codigo} · ${i.recepcion.productor.nombre}` : '—';
const pct = (v: string | null) => (v == null ? '—' : `${v} %`);

// Control de calidad: lista de inspecciones (de recepciones y de lotes) y registro de una nueva.
// La vista va en la URL: ?nuevo=1 (opcional &recepcionId= o &loteId= para preseleccionar).
export default function Calidad() {
  const { sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  const [aviso, setAviso] = useState('');
  const puede = ROLES_INSPECCIONAR.includes(sesion!.rol);

  const nuevo = params.get('nuevo') && puede;
  return (
    <section>
      <h1>Control de calidad</h1>
      {aviso && !nuevo && <p className="aviso" role="status">{aviso}</p>}
      {nuevo ? (
        <NuevaInspeccion
          recepcionInicial={params.get('recepcionId') ?? ''}
          loteInicial={params.get('loteId') ?? ''}
          alCancelar={() => setParams({})}
          alGuardar={(texto) => {
            setAviso(texto);
            setParams({});
          }}
        />
      ) : (
        <Lista puede={puede} alNueva={() => { setAviso(''); setParams({ nuevo: '1' }); }} />
      )}
    </section>
  );
}

function Lista({ puede, alNueva }: { puede: boolean; alNueva: () => void }) {
  const [f, setF] = useState({ aprobado: '' });
  const lista = usePaginado<Inspeccion>('/calidad/inspecciones', f);

  const columnas: Columna<Inspeccion>[] = [
    { titulo: 'Fecha', celda: (i) => fecha(i.inspeccionadoEn) },
    { titulo: 'Inspeccionado', celda: objetivo },
    {
      titulo: 'Resultado',
      celda: (i) => <span className={i.aprobado ? 'insignia ok' : 'insignia apagada'}>{i.aprobado ? 'Aprobada' : 'Rechazada'}</span>,
    },
    { titulo: 'Grado', celda: (i) => (i.gradoCalidad ? `${i.gradoCalidad.codigo} · ${i.gradoCalidad.nombre}` : '—') },
    { titulo: 'Humedad', celda: (i) => pct(i.humedadPct) },
    { titulo: 'Impurezas', celda: (i) => pct(i.impurezasPct) },
    { titulo: 'Defectos', celda: (i) => pct(i.defectosPct) },
    { titulo: 'Inspector', celda: (i) => i.inspector.nombre },
    { titulo: 'Observaciones', celda: (i) => i.observaciones ?? '—' },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>
            Resultado
            <select value={f.aprobado} onChange={(e) => setF({ aprobado: e.target.value })}>
              <option value="">Todos</option>
              <option value="true">Aprobadas</option>
              <option value="false">Rechazadas</option>
            </select>
          </label>
        </form>
        <div className="acciones">
          <Exportar<Inspeccion>
            ruta="/calidad/inspecciones"
            filtros={f}
            nombre="inspecciones-calidad"
            columnas={[
              { titulo: 'Fecha', valor: (i) => fecha(i.inspeccionadoEn) },
              { titulo: 'Inspeccionado', valor: objetivo },
              { titulo: 'Resultado', valor: (i) => (i.aprobado ? 'Aprobada' : 'Rechazada') },
              { titulo: 'Grado', valor: (i) => i.gradoCalidad?.codigo ?? '' },
              { titulo: 'Humedad %', valor: (i) => i.humedadPct },
              { titulo: 'Impurezas %', valor: (i) => i.impurezasPct },
              { titulo: 'Defectos %', valor: (i) => i.defectosPct },
              { titulo: 'Inspector', valor: (i) => i.inspector.nombre },
              { titulo: 'Observaciones', valor: (i) => i.observaciones },
            ]}
          />
          {puede && <button className="primario" onClick={alNueva}>Registrar inspección</button>}
        </div>
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(i) => i.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay inspecciones con ese filtro."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}

interface Opcion {
  id: string;
  texto: string;
}
interface RecepcionOpcion {
  id: string;
  capturadoEn: string;
  pesoNetoKg: string;
  productor: { codigo: string; nombre: string };
  centro: { nombre: string };
}
interface LoteOpcion {
  id: string;
  codigo: string;
  estado: string;
}

// Porcentaje 0–100 con máximo 2 decimales. undefined = vacío, null = inválido.
function leerPct(texto: string): number | null | undefined {
  const t = texto.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100 || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return null;
  return n;
}

function NuevaInspeccion({
  recepcionInicial,
  loteInicial,
  alCancelar,
  alGuardar,
}: {
  recepcionInicial: string;
  loteInicial: string;
  alCancelar: () => void;
  alGuardar: (texto: string) => void;
}) {
  const [tipo, setTipo] = useState<'recepcion' | 'lote'>(loteInicial ? 'lote' : 'recepcion');
  const [objetivoId, setObjetivoId] = useState(loteInicial || recepcionInicial);
  const [recepciones, setRecepciones] = useState<Opcion[] | null>(null);
  const [lotes, setLotes] = useState<Opcion[] | null>(null);
  const [grados, setGrados] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [aprobado, setAprobado] = useState('');
  const [grado, setGrado] = useState('');
  const [humedad, setHumedad] = useState('');
  const [impurezas, setImpurezas] = useState('');
  const [defectos, setDefectos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // El id se genera aquí: si la petición se reintenta (doble clic, red lenta) no se duplica.
  const [id] = useState(() => crypto.randomUUID());

  useEffect(() => {
    // Las 100 recepciones y lotes más recientes alcanzan para elegir; para otra, se entra desde su detalle.
    api
      .get<{ datos: RecepcionOpcion[] }>('/recepciones?limite=100')
      .then((r) =>
        setRecepciones(
          r.datos.map((x) => ({
            id: x.id,
            texto: `${fecha(x.capturadoEn)} · ${x.productor.codigo} ${x.productor.nombre} · ${kg(x.pesoNetoKg)} · ${x.centro.nombre}`,
          })),
        ),
      )
      .catch(() => setRecepciones([]));
    api
      .get<{ datos: LoteOpcion[] }>('/lotes?limite=100')
      .then((r) => setLotes(r.datos.filter((l) => l.estado !== 'ANULADO').map((l) => ({ id: l.id, texto: `${l.codigo} · ${l.estado}` }))))
      .catch(() => setLotes([]));
    listarTodo<{ id: string; codigo: string; nombre: string }>('/grados-calidad?activo=true').then(setGrados).catch(() => setGrados([]));
  }, []);

  const opciones = tipo === 'recepcion' ? recepciones : lotes;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!objetivoId) return setError(tipo === 'recepcion' ? 'Elige la recepción.' : 'Elige el lote.');
    if (aprobado === '') return setError('Indica si se aprueba o se rechaza.');
    const valores = { humedadPct: leerPct(humedad), impurezasPct: leerPct(impurezas), defectosPct: leerPct(defectos) };
    if (Object.values(valores).some((v) => v === null)) return setError('Los porcentajes van de 0 a 100, con máximo 2 decimales.');

    setEnviando(true);
    try {
      await api.post('/calidad/inspecciones', {
        id,
        ...(tipo === 'recepcion' ? { recepcionId: objetivoId } : { loteId: objetivoId }),
        aprobado: aprobado === 'true',
        ...(grado && { gradoCalidadId: grado }),
        ...Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== undefined)),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        inspeccionadoEn: new Date().toISOString(),
      });
      alGuardar(
        tipo === 'lote' && grado
          ? 'Inspección registrada. El grado del lote quedó actualizado.'
          : 'Inspección registrada. Si la recepción tenía tarea de inspección pendiente, quedó completada.',
      );
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  // Si se llegó con una recepción o lote preseleccionado que no está entre los 100 recientes, se agrega.
  const lista = opciones ?? [];
  const conPreseleccion = objetivoId && !lista.some((o) => o.id === objetivoId) ? [{ id: objetivoId, texto: 'Seleccionado desde su detalle' }, ...lista] : lista;

  return (
    <form className="panel" onSubmit={enviar}>
      <h2>Registrar inspección</h2>
      <div className="rejilla">
        <label>
          Qué se inspecciona <span className="obligatorio">*</span>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as 'recepcion' | 'lote');
              setObjetivoId('');
            }}
          >
            <option value="recepcion">Una recepción</option>
            <option value="lote">Un lote</option>
          </select>
        </label>
        <label>
          {tipo === 'recepcion' ? 'Recepción' : 'Lote'} <span className="obligatorio">*</span>
          <select value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)} disabled={opciones === null}>
            <option value="">{opciones === null ? 'Cargando…' : 'Elige…'}</option>
            {conPreseleccion.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
          </select>
        </label>
        <label>
          Resultado <span className="obligatorio">*</span>
          <select value={aprobado} onChange={(e) => setAprobado(e.target.value)}>
            <option value="">Elige…</option>
            <option value="true">Aprobada</option>
            <option value="false">Rechazada</option>
          </select>
        </label>
        <label>
          Grado de calidad
          <select value={grado} onChange={(e) => setGrado(e.target.value)}>
            <option value="">Sin asignar</option>
            {grados.map((g) => <option key={g.id} value={g.id}>{g.codigo} · {g.nombre}</option>)}
          </select>
          {tipo === 'lote' && <small className="nota">Si eliges un grado, pasa a ser el grado del lote.</small>}
        </label>
        <label>Humedad (%)<input inputMode="decimal" value={humedad} onChange={(e) => setHumedad(e.target.value)} /></label>
        <label>Impurezas (%)<input inputMode="decimal" value={impurezas} onChange={(e) => setImpurezas(e.target.value)} /></label>
        <label>Defectos (%)<input inputMode="decimal" value={defectos} onChange={(e) => setDefectos(e.target.value)} /></label>
      </div>
      <label>Observaciones<textarea rows={3} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar inspección'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
      <p className="nota">Las inspecciones no se editan: una corrección es una inspección nueva y ambas quedan en el historial.</p>
    </form>
  );
}
