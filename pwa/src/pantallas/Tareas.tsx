import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Ruta } from '../App';
import { db } from '../db';
import { EVENTO_COLA } from '../sync';
import { fechaHora } from '../util';

export interface Tarea {
  id: string;
  tipo: string;
  titulo: string;
  entidadTipo: string;
  entidadId: string;
  venceEn: string | null;
  creadoEn: string;
}

const TIPO: Record<string, string> = {
  INSPECCION_CALIDAD: 'Inspección de calidad',
  CONFIRMAR_TRASLADO: 'Confirmar traslado',
  APROBAR_PROCESO: 'Aprobar proceso',
  APROBAR_LIQUIDACION: 'Aprobar liquidación',
};

// Tareas pendientes del usuario (las suyas y las de su rol en sus centros).
// Se consultan con internet; una inspección guardada sin conexión ya cuenta como hecha
// en el teléfono y la tarea desaparece del servidor cuando la inspección llega.
export default function Tareas({ ir }: { ir: (r: Ruta) => void }) {
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [enCola, setEnCola] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = () => {
      db.operaciones.toArray().then((ops) =>
        setEnCola(
          new Set(
            ops.filter((o) => o.tipo === 'inspeccion').map((o) => {
              const p = o.payload as { recepcionId?: string; loteId?: string };
              return (p.recepcionId ?? p.loteId)!;
            }),
          ),
        ),
      );
      api
        .get<Tarea[]>('/tareas/mias')
        .then((t) => {
          setTareas(t);
          setError('');
        })
        .catch((e: ApiError) => setError(e.status === 0 ? 'Sin conexión: las tareas se consultan con internet.' : e.message));
    };
    cargar();
    window.addEventListener(EVENTO_COLA, cargar);
    return () => window.removeEventListener(EVENTO_COLA, cargar);
  }, []);

  function abrir(t: Tarea) {
    if (t.entidadTipo === 'recepcion') ir({ nombre: 'detalle', id: t.entidadId });
    else if (t.entidadTipo === 'lote') ir({ nombre: 'lote', id: t.entidadId });
  }

  const visibles = tareas?.filter((t) => !enCola.has(t.entidadId)) ?? [];

  return (
    <section>
      {error && <p className="nota" role="status">{error}</p>}
      {tareas && visibles.length === 0 && <p className="aviso">No tienes tareas pendientes.</p>}
      {!tareas && !error && <p>Cargando…</p>}
      <ul className="lista">
        {visibles.map((t) => (
          <li key={t.id}>
            <button className="item tocable" onClick={() => abrir(t)}>
              <strong>{TIPO[t.tipo] ?? t.tipo}</strong>
              <span>{t.titulo}</span>
              <small>
                Desde {fechaHora(t.creadoEn)}
                {t.venceEn && ` · vence ${fechaHora(t.venceEn)}`}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
