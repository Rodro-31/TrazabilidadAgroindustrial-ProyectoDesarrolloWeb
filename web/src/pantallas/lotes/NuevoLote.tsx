import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, listarTodo } from '../../api';
import { fecha, kg, mensajeError, PRODUCTO } from '../../formato';
import type { LoteDetalle, QrEmitido, RecepcionDisponible } from './tipos';

interface Ref {
  id: string;
  codigo: string;
  nombre: string;
}

// Crear un lote eligiendo recepciones del centro con kg disponibles.
// Las reglas (mismo centro, mismo producto, no exceder lo disponible) las valida la API;
// aquí se ayudan con avisos para que el usuario no llegue al error.
export default function NuevoLote({
  alCrear,
  alCancelar,
}: {
  alCrear: (lote: LoteDetalle & { qr: QrEmitido }) => void;
  alCancelar: () => void;
}) {
  const [centros, setCentros] = useState<Ref[]>([]);
  const [grados, setGrados] = useState<Ref[]>([]);
  const [centroId, setCentroId] = useState('');
  const [producto, setProducto] = useState('');
  const [disponibles, setDisponibles] = useState<RecepcionDisponible[]>([]);
  const [elegidas, setElegidas] = useState<Record<string, string>>({}); // recepcionId → kg a tomar
  const [gradoId, setGradoId] = useState('');
  const [cosecha, setCosecha] = useState(String(new Date().getFullYear()));
  const [observaciones, setObservaciones] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarTodo<Ref>('/centros?activo=true').then(setCentros).catch((e) => setError(mensajeError(e)));
    listarTodo<Ref>('/grados-calidad?activo=true').then(setGrados).catch(() => setGrados([]));
  }, []);

  useEffect(() => {
    setElegidas({});
    if (!centroId) return setDisponibles([]);
    const params = new URLSearchParams({ centroId });
    if (producto) params.set('estadoProducto', producto);
    setCargando(true);
    api
      .get<RecepcionDisponible[]>(`/lotes/recepciones-disponibles?${params}`)
      .then(setDisponibles)
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false));
  }, [centroId, producto]);

  const seleccion = disponibles.filter((r) => r.id in elegidas);
  const total = seleccion.reduce((s, r) => s + (Number(elegidas[r.id]) || 0), 0);
  const productos = useMemo(() => new Set(seleccion.map((r) => r.estadoProducto)), [seleccion]);
  const excedidas = seleccion.filter((r) => Number(elegidas[r.id]) > Number(r.disponibleKg));

  function alternar(r: RecepcionDisponible) {
    const copia = { ...elegidas };
    if (r.id in copia) delete copia[r.id];
    else copia[r.id] = String(Number(r.disponibleKg)); // por defecto, todo lo disponible
    setElegidas(copia);
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const { data } = await api.post<LoteDetalle & { qr: QrEmitido }>('/lotes', {
        centroId,
        recepciones: seleccion.map((r) => {
          const cantidad = Number(elegidas[r.id]);
          // Si toma todo lo disponible no se envía cantidad: la API usa el saldo exacto.
          return cantidad === Number(r.disponibleKg) ? { recepcionId: r.id } : { recepcionId: r.id, cantidadKg: cantidad };
        }),
        ...(gradoId && { gradoCalidadId: gradoId }),
        ...(cosecha && { cosecha: Number(cosecha) }),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
      });
      alCrear(data);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const bloqueado = guardando || seleccion.length === 0 || productos.size > 1 || excedidas.length > 0 || total <= 0;

  return (
    <form className="panel" onSubmit={crear}>
      <h2>Nuevo lote</h2>
      <div className="rejilla">
        <label>
          Centro de acopio <span className="obligatorio">*</span>
          <select value={centroId} onChange={(e) => setCentroId(e.target.value)} required>
            <option value="">— Elegir —</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </label>
        <label>
          Producto
          <select value={producto} onChange={(e) => setProducto(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(PRODUCTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          Grado de calidad
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)}>
            <option value="">Sin asignar (después de la inspección)</option>
            {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label>
          Cosecha
          <input type="number" min={2000} max={2100} value={cosecha} onChange={(e) => setCosecha(e.target.value)} />
        </label>
      </div>

      <h3>Recepciones de origen</h3>
      <p className="nota">Un lote siempre nace de recepciones: elige una o más del mismo producto.</p>
      {!centroId ? (
        <p className="nota">Elige un centro para ver sus recepciones con kg disponibles.</p>
      ) : cargando ? (
        <p>Cargando…</p>
      ) : disponibles.length === 0 ? (
        <p className="aviso">Este centro no tiene recepciones con kg disponibles.</p>
      ) : (
        <div className="tabla-caja">
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th></th><th>Fecha</th><th>Productor</th><th>Finca</th><th>Producto</th><th>Neto</th><th>Disponible</th><th>Kg a tomar</th></tr>
              </thead>
              <tbody>
                {disponibles.map((r) => {
                  const marcada = r.id in elegidas;
                  const excede = marcada && Number(elegidas[r.id]) > Number(r.disponibleKg);
                  return (
                    <tr key={r.id} className={marcada ? 'elegida' : ''}>
                      <td><input type="checkbox" checked={marcada} onChange={() => alternar(r)} aria-label={`Usar recepción de ${r.productor.nombre}`} /></td>
                      <td>{fecha(r.capturadoEn)}</td>
                      <td>{r.productor.codigo} – {r.productor.nombre}</td>
                      <td>{r.finca.nombre}</td>
                      <td>{PRODUCTO[r.estadoProducto]}</td>
                      <td>{kg(r.pesoNetoKg)}</td>
                      <td>{kg(r.disponibleKg)}</td>
                      <td>
                        {marcada && (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className={`corto${excede ? ' invalido' : ''}`}
                            value={elegidas[r.id]}
                            onChange={(e) => setElegidas({ ...elegidas, [r.id]: e.target.value })}
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

      <label>
        Observaciones
        <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} />
      </label>

      <p className="total">
        {seleccion.length} recepción(es) · Peso del lote: <strong>{kg(total)}</strong>
      </p>
      {productos.size > 1 && <p className="error">No se puede mezclar uva, pergamino y oro en un mismo lote.</p>}
      {excedidas.length > 0 && <p className="error">Hay recepciones con más kg de los disponibles.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="acciones">
        <button type="submit" className="primario" disabled={bloqueado}>{guardando ? 'Creando…' : 'Crear lote'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
