import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import type { Catalogos } from '../catalogos';
import { db } from '../db';
import { EVENTO_COLA, sincronizar } from '../sync';
import { fechaHora, numero, tieneMaxDosDecimales, uuid } from '../util';

export const PUEDE_INSPECCIONAR = ['ADMIN', 'SUPERVISOR', 'CALIDAD'];

export interface Objetivo {
  tipo: 'recepcion' | 'lote';
  id: string;
  resumen: string; // "recepción P-001 · Juan Pérez" o "lote L-2026-00001"
}

// Formulario de inspección. Se guarda primero en el teléfono (cola offline, con UUID
// propio) y se envía cuando hay internet: reintentar nunca la duplica.
export function NuevaInspeccion({ objetivo, catalogos, alGuardar }: { objetivo: Objetivo; catalogos: Catalogos; alGuardar: () => void }) {
  const [aprobado, setAprobado] = useState<boolean | null>(null);
  const [grado, setGrado] = useState('');
  const [humedad, setHumedad] = useState('');
  const [impurezas, setImpurezas] = useState('');
  const [defectos, setDefectos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function porcentaje(texto: string, nombre: string): number | undefined | string {
    if (texto.trim() === '') return undefined;
    const n = numero(texto);
    if (n === null || n < 0 || n > 100 || !tieneMaxDosDecimales(n)) return `${nombre}: entre 0 y 100, máximo 2 decimales.`;
    return n;
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (aprobado === null) return setError('Indica si la inspección se aprueba o se rechaza.');
    const valores = [porcentaje(humedad, 'Humedad'), porcentaje(impurezas, 'Impurezas'), porcentaje(defectos, 'Defectos')];
    const invalido = valores.find((v) => typeof v === 'string');
    if (invalido) return setError(invalido as string);
    const [humedadPct, impurezasPct, defectosPct] = valores as (number | undefined)[];

    setGuardando(true);
    const id = uuid();
    const nombreGrado = catalogos.grados.find((g) => g.id === grado)?.codigo;
    await db.operaciones.put({
      id,
      tipo: 'inspeccion',
      payload: {
        id,
        ...(objetivo.tipo === 'recepcion' ? { recepcionId: objetivo.id } : { loteId: objetivo.id }),
        aprobado,
        ...(grado && { gradoCalidadId: grado }),
        ...(humedadPct !== undefined && { humedadPct }),
        ...(impurezasPct !== undefined && { impurezasPct }),
        ...(defectosPct !== undefined && { defectosPct }),
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        inspeccionadoEn: new Date().toISOString(),
      },
      resumen: `Inspección de ${objetivo.resumen} · ${aprobado ? 'aprobada' : 'rechazada'}${nombreGrado ? ` · grado ${nombreGrado}` : ''}`,
      estado: 'PENDIENTE',
      intentos: 0,
      creadoEn: new Date().toISOString(),
    });
    window.dispatchEvent(new Event(EVENTO_COLA));
    void sincronizar();
    alGuardar();
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <p className="nota">Inspección de {objetivo.resumen}</p>
      <fieldset className="opciones-resultado">
        <legend>Resultado</legend>
        <label className={aprobado === true ? 'opcion elegida' : 'opcion'}>
          <input type="radio" name="resultado" checked={aprobado === true} onChange={() => setAprobado(true)} />
          Aprobada
        </label>
        <label className={aprobado === false ? 'opcion elegida' : 'opcion'}>
          <input type="radio" name="resultado" checked={aprobado === false} onChange={() => setAprobado(false)} />
          Rechazada
        </label>
      </fieldset>
      <label>
        Grado de calidad
        <select value={grado} onChange={(e) => setGrado(e.target.value)}>
          <option value="">Sin asignar</option>
          {catalogos.grados.map((g) => (
            <option key={g.id} value={g.id}>{g.codigo} · {g.nombre}</option>
          ))}
        </select>
        {objetivo.tipo === 'lote' && <small className="nota">Si eliges un grado, pasa a ser el grado del lote.</small>}
      </label>
      <div className="fila">
        <label>Humedad (%)<input inputMode="decimal" value={humedad} onChange={(e) => setHumedad(e.target.value)} /></label>
        <label>Impurezas (%)<input inputMode="decimal" value={impurezas} onChange={(e) => setImpurezas(e.target.value)} /></label>
      </div>
      <label>Defectos (%)<input inputMode="decimal" value={defectos} onChange={(e) => setDefectos(e.target.value)} /></label>
      <label>Observaciones<textarea rows={3} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar inspección'}</button>
      <p className="nota">Funciona sin internet: se envía sola cuando vuelva la conexión.</p>
    </form>
  );
}

interface InspeccionApi {
  id: string;
  aprobado: boolean;
  humedadPct: string | null;
  impurezasPct: string | null;
  defectosPct: string | null;
  observaciones: string | null;
  inspeccionadoEn: string;
  gradoCalidad: { codigo: string; nombre: string } | null;
  inspector: { nombre: string };
}

// Historial de inspecciones de una recepción o un lote (servidor + las que esperan envío).
export function ListaInspecciones({ objetivo }: { objetivo: Pick<Objetivo, 'tipo' | 'id'> }) {
  const [lista, setLista] = useState<InspeccionApi[] | null>(null);
  const [pendientes, setPendientes] = useState<{ id: string; resumen: string }[]>([]);

  useEffect(() => {
    const campo = objetivo.tipo === 'recepcion' ? 'recepcionId' : 'loteId';
    const cargarLocales = () =>
      db.operaciones.toArray().then((ops) =>
        setPendientes(
          ops
            .filter((o) => o.tipo === 'inspeccion' && (o.payload as Record<string, string>)[campo] === objetivo.id)
            .map((o) => ({ id: o.id, resumen: o.resumen })),
        ),
      );
    const cargar = () => {
      void cargarLocales();
      api
        .get<{ datos: InspeccionApi[] }>(`/calidad/inspecciones?${campo}=${objetivo.id}&limite=20`)
        .then((r) => setLista(r.datos))
        .catch(() => setLista((l) => l ?? []));
    };
    cargar();
    window.addEventListener(EVENTO_COLA, cargar);
    return () => window.removeEventListener(EVENTO_COLA, cargar);
  }, [objetivo.tipo, objetivo.id]);

  return (
    <>
      <h3>Inspecciones de calidad</h3>
      {lista?.length === 0 && pendientes.length === 0 && <p className="nota">Aún no tiene inspecciones.</p>}
      <ul className="lista">
        {pendientes.map((p) => (
          <li key={p.id} className="item">
            <strong>Por enviar</strong>
            <small>{p.resumen}</small>
          </li>
        ))}
        {lista?.map((i) => (
          <li key={i.id} className="item">
            <strong className={i.aprobado ? '' : 'error'}>
              {i.aprobado ? 'Aprobada' : 'Rechazada'}
              {i.gradoCalidad && ` · grado ${i.gradoCalidad.codigo}`}
            </strong>
            <small>
              {[
                i.humedadPct && `humedad ${i.humedadPct} %`,
                i.impurezasPct && `impurezas ${i.impurezasPct} %`,
                i.defectosPct && `defectos ${i.defectosPct} %`,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sin mediciones'}
            </small>
            <small>{fechaHora(i.inspeccionadoEn)} · {i.inspector.nombre}</small>
            {i.observaciones && <small>{i.observaciones}</small>}
          </li>
        ))}
      </ul>
    </>
  );
}
