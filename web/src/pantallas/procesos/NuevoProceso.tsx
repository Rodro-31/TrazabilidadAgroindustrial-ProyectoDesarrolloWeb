import { FormEvent, useEffect, useState } from 'react';
import { api, listarTodo } from '../../api';
import { kg, mensajeError, PRODUCTO } from '../../formato';
import type { LoteFila } from '../lotes/tipos';
import { REGLAS, TIPO_PROCESO, type ProcesoCreado } from './tipos';

interface Ref {
  id: string;
  codigo: string;
  nombre: string;
}

interface Salida {
  cantidadKg: string;
  gradoCalidadId: string;
}

const salidasIniciales = (tipo: string): Salida[] =>
  Array.from({ length: REGLAS[tipo].salidas === 'varias' ? 2 : 1 }, () => ({ cantidadKg: '', gradoCalidadId: '' }));

// Registrar un proceso terminado: se eligen los lotes que entraron (con su existencia en el
// centro) y se escriben los kg que salieron, leídos en la báscula. La merma la calcula el
// sistema. Las reglas las valida la API; aquí se avisan antes para no llegar al error.
export default function NuevoProceso({ alCrear, alCancelar }: { alCrear: (p: ProcesoCreado) => void; alCancelar: () => void }) {
  const [centros, setCentros] = useState<Ref[]>([]);
  const [grados, setGrados] = useState<Ref[]>([]);
  const [tipo, setTipo] = useState('MEZCLA');
  const [centroId, setCentroId] = useState('');
  const [lotes, setLotes] = useState<LoteFila[]>([]);
  const [elegidos, setElegidos] = useState<Record<string, string>>({}); // loteId → kg a tomar
  const [salidas, setSalidas] = useState<Salida[]>(salidasIniciales('MEZCLA'));
  const [observaciones, setObservaciones] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const regla = REGLAS[tipo];

  useEffect(() => {
    listarTodo<Ref>('/centros?activo=true').then(setCentros).catch((e) => setError(mensajeError(e)));
    listarTodo<Ref>('/grados-calidad?activo=true').then(setGrados).catch(() => setGrados([]));
  }, []);

  // Lotes ACTIVOS con existencia en el centro (y del producto correcto si el proceso lo exige).
  useEffect(() => {
    setElegidos({});
    if (!centroId) return setLotes([]);
    const params = new URLSearchParams({ centroId, estado: 'ACTIVO', limite: '100' });
    if (regla.desde) params.set('estadoProducto', regla.desde);
    setCargando(true);
    api
      .get<{ datos: LoteFila[] }>(`/lotes?${params}`)
      .then((r) => setLotes(r.datos))
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false));
  }, [centroId, tipo]);

  function cambiarTipo(nuevo: string) {
    setTipo(nuevo);
    setSalidas(salidasIniciales(nuevo));
    setError('');
  }

  const existencia = (l: LoteFila) => Number(l.existencias.find((e) => e.centro.id === centroId)?.cantidadKg ?? 0);

  function alternar(l: LoteFila) {
    // Si el proceso recibe un solo lote, elegir otro reemplaza al anterior.
    const copia: Record<string, string> = regla.entradas === 'una' ? {} : { ...elegidos };
    if (l.id in elegidos) delete copia[l.id];
    else copia[l.id] = String(existencia(l)); // por defecto, toda su existencia
    setElegidos(copia);
  }

  const seleccion = lotes.filter((l) => l.id in elegidos);
  const entra = seleccion.reduce((s, l) => s + (Number(elegidos[l.id]) || 0), 0);
  const sale = salidas.reduce((s, x) => s + (Number(x.cantidadKg) || 0), 0);
  const merma = entra - sale;
  const productos = new Set(seleccion.map((l) => l.estadoProducto));

  // Avisos en lenguaje de bodega (los mismos casos que rechaza la API).
  const avisos: string[] = [];
  if (regla.entradas === 'varias' && seleccion.length === 1) avisos.push(`${TIPO_PROCESO[tipo]} necesita al menos dos lotes.`);
  if (productos.size > 1) avisos.push('Los lotes elegidos tienen distinto producto (uva, pergamino u oro).');
  if (seleccion.some((l) => Number(elegidos[l.id]) > existencia(l))) avisos.push('Hay lotes con más kg de los que tienen en el centro.');
  if (sale > 0 && merma < 0) avisos.push(`Salen ${kg(sale)} pero solo entran ${kg(entra)}.`);

  const bloqueado =
    guardando ||
    seleccion.length === 0 ||
    salidas.some((x) => !(Number(x.cantidadKg) > 0)) ||
    avisos.length > 0;

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const { data } = await api.post<ProcesoCreado>('/procesos', {
        tipo,
        centroId,
        entradas: seleccion.map((l) => {
          const cantidad = Number(elegidos[l.id]);
          // Si toma toda la existencia no se envía cantidad: la API usa el saldo exacto.
          return cantidad === existencia(l) ? { loteId: l.id } : { loteId: l.id, cantidadKg: cantidad };
        }),
        salidas: salidas.map((x) => ({
          cantidadKg: Number(x.cantidadKg),
          ...(x.gradoCalidadId && { gradoCalidadId: x.gradoCalidadId }),
        })),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
      });
      alCrear(data);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const cambiarSalida = (i: number, campo: keyof Salida, valor: string) =>
    setSalidas(salidas.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  return (
    <form className="panel" onSubmit={registrar}>
      <h2>Registrar proceso</h2>
      <div className="rejilla">
        <label>
          Tipo de proceso <span className="obligatorio">*</span>
          <select value={tipo} onChange={(e) => cambiarTipo(e.target.value)}>
            {Object.entries(TIPO_PROCESO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          Centro de acopio <span className="obligatorio">*</span>
          <select value={centroId} onChange={(e) => setCentroId(e.target.value)} required>
            <option value="">— Elegir —</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </label>
      </div>
      <p className="nota">{regla.ayuda}</p>

      <h3>1. Lotes que entran {regla.entradas === 'una' ? '(uno)' : '(dos o más)'}</h3>
      {!centroId ? (
        <p className="nota">Elige un centro para ver sus lotes activos.</p>
      ) : cargando ? (
        <p>Cargando…</p>
      ) : lotes.length === 0 ? (
        <p className="aviso">
          No hay lotes activos{regla.desde ? ` de ${PRODUCTO[regla.desde].toLowerCase()}` : ''} con existencia en este centro.
        </p>
      ) : (
        <div className="tabla-caja">
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th></th><th>Lote</th><th>Producto</th><th>Grado</th><th>Existencia aquí</th><th>Kg a tomar</th></tr>
              </thead>
              <tbody>
                {lotes.map((l) => {
                  const marcado = l.id in elegidos;
                  const excede = marcado && Number(elegidos[l.id]) > existencia(l);
                  return (
                    <tr key={l.id} className={marcado ? 'elegida' : ''}>
                      <td>
                        <input
                          type={regla.entradas === 'una' ? 'radio' : 'checkbox'}
                          name="entrada"
                          checked={marcado}
                          onChange={() => alternar(l)}
                          aria-label={`Usar lote ${l.codigo}`}
                        />
                      </td>
                      <td>{l.codigo}</td>
                      <td>{PRODUCTO[l.estadoProducto]}</td>
                      <td>{l.gradoCalidad?.nombre ?? '—'}</td>
                      <td>{kg(existencia(l))}</td>
                      <td>
                        {marcado && (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className={`corto${excede ? ' invalido' : ''}`}
                            value={elegidos[l.id]}
                            onChange={(e) => setElegidos({ ...elegidos, [l.id]: e.target.value })}
                            aria-label="Kg a tomar"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3>2. Lotes que salen (kg pesados en báscula)</h3>
      {regla.hacia && <p className="nota">Saldrán como {PRODUCTO[regla.hacia].toLowerCase()}.</p>}
      {salidas.map((x, i) => (
        <div key={i} className="rejilla salida">
          <label>
            Lote nuevo {salidas.length > 1 ? i + 1 : ''} · kg <span className="obligatorio">*</span>
            <input type="number" step="0.01" min="0.01" value={x.cantidadKg} onChange={(e) => cambiarSalida(i, 'cantidadKg', e.target.value)} required />
          </label>
          <label>
            Grado de calidad
            <select value={x.gradoCalidadId} onChange={(e) => cambiarSalida(i, 'gradoCalidadId', e.target.value)}>
              <option value="">El de los lotes de entrada</option>
              {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </label>
          {regla.salidas !== 'una' && salidas.length > (regla.salidas === 'varias' ? 2 : 1) && (
            <button type="button" onClick={() => setSalidas(salidas.filter((_, j) => j !== i))}>Quitar</button>
          )}
        </div>
      ))}
      {regla.salidas !== 'una' && (
        <button type="button" onClick={() => setSalidas([...salidas, { cantidadKg: '', gradoCalidadId: '' }])}>
          + Agregar lote de salida
        </button>
      )}

      <label className="separado">
        Observaciones
        <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} />
      </label>

      <p className="total">
        Entran <strong>{kg(entra)}</strong> · salen <strong>{kg(sale)}</strong> · merma{' '}
        <strong>{kg(Math.max(merma, 0))}</strong>
        {entra > 0 && merma >= 0 && ` (${((merma / entra) * 100).toFixed(1)} %)`}
      </p>
      {avisos.map((a) => <p key={a} className="error">{a}</p>)}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="acciones">
        <button type="submit" className="primario" disabled={bloqueado}>{guardando ? 'Registrando…' : 'Registrar proceso'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
