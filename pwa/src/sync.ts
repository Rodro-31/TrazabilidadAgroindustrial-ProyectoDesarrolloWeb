import { api, ApiError, leerSesion, subir } from './api';
import { db } from './db';

export const EVENTO_COLA = 'cola-cambio';
const avisar = () => window.dispatchEvent(new Event(EVENTO_COLA));

let enCurso = false;

// Envía las operaciones guardadas, de la más antigua a la más nueva.
// - Éxito (201 o 200 "ya existía"): se borra de la cola y se guarda su QR.
// - Sin red / error del servidor: se queda pendiente y se detiene (se reintenta luego).
// - Rechazo por datos (400, 403, 404, 409...): queda en ERROR con el motivo, para revisar.
export async function sincronizar(): Promise<{ enviadas: number; conError: number }> {
  const resultado = { enviadas: 0, conError: 0 };
  if (enCurso || !navigator.onLine || !leerSesion()) return resultado;
  enCurso = true;
  try {
    const ops = await db.operaciones.where('estado').anyOf('PENDIENTE', 'ENVIANDO').sortBy('creadoEn');
    for (const op of ops) {
      await db.operaciones.update(op.id, { estado: 'ENVIANDO', intentos: op.intentos + 1 });
      avisar();
      try {
        const { data } = await api.post<{ id: string; qr?: { valor: string; url: string | null } | null }>(
          '/recepciones',
          op.payload,
        );
        await db.transaction('rw', db.operaciones, db.comprobantes, async () => {
          if (data.qr) {
            await db.comprobantes.put({
              recepcionId: op.id,
              valor: data.qr.valor,
              url: data.qr.url,
              resumen: op.resumen,
              creadoEn: new Date().toISOString(),
            });
          }
          await db.operaciones.delete(op.id);
        });
        resultado.enviadas++;
      } catch (e) {
        const err = e as ApiError;
        if (err instanceof ApiError && !err.esDeRed && err.status !== 401) {
          const detalle = err.errores?.length ? `${err.message}: ${err.errores.join('; ')}` : err.message;
          await db.operaciones.update(op.id, { estado: 'ERROR', error: detalle });
          resultado.conError++;
          continue;
        }
        // Red caída, error del servidor o sesión vencida: vuelve a pendiente y se corta.
        await db.operaciones.update(op.id, { estado: 'PENDIENTE' });
        break;
      }
    }
    await enviarFotos();
  } finally {
    enCurso = false;
    avisar();
  }
  return resultado;
}

// Las fotos salen después de su recepción: solo se suben las que ya no tienen la recepción
// esperando en la cola (es decir, ya existe en el servidor).
async function enviarFotos() {
  const fotos = await db.fotos.where('estado').equals('PENDIENTE').sortBy('creadoEn');
  for (const f of fotos) {
    if (await db.operaciones.get(f.recepcionId)) continue; // su recepción aún no se ha enviado
    try {
      const form = new FormData();
      form.append('archivo', f.blob, 'foto.jpg');
      await subir(`/recepciones/${f.recepcionId}/fotos`, form);
      await db.fotos.delete(f.id);
    } catch (e) {
      const err = e as ApiError;
      if (err instanceof ApiError && !err.esDeRed && err.status !== 401) {
        await db.fotos.update(f.id, { estado: 'ERROR', error: err.message, intentos: f.intentos + 1 });
        continue;
      }
      break; // sin red / servidor caído / sesión vencida: se reintenta luego
    }
  }
}

export async function reintentarFoto(id: string) {
  await db.fotos.update(id, { estado: 'PENDIENTE', error: undefined });
  avisar();
  return sincronizar();
}

export async function descartarFoto(id: string) {
  await db.fotos.delete(id);
  avisar();
}

export async function reintentar(id: string) {
  await db.operaciones.update(id, { estado: 'PENDIENTE', error: undefined });
  avisar();
  return sincronizar();
}

export async function descartar(id: string) {
  await db.operaciones.delete(id);
  avisar();
}
