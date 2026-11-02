// Cliente de la API: guarda la sesión, renueva el access token solo y traduce errores.

// En producción la web vive en app.<dominio> y la API en api.<dominio>.
// Se puede forzar con VITE_API_URL (por ejemplo en desarrollo).
function urlBase(): string {
  const forzada = import.meta.env.VITE_API_URL as string | undefined;
  if (forzada) return forzada.replace(/\/$/, '');
  const host = location.hostname;
  if (host.startsWith('app.')) return `${location.protocol}//api.${host.slice('app.'.length)}/api/v1`;
  return 'http://localhost:3000/api/v1';
}
const BASE = urlBase();

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = no hubo respuesta (sin conexión)
    mensaje: string,
    public errores?: string[],
  ) {
    super(mensaje);
  }
  get esDeRed() {
    return this.status === 0 || this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  rol: string;
}

const CLAVE = 'trz.sesion';

export function leerSesion(): Sesion | null {
  try {
    const s = localStorage.getItem(CLAVE);
    return s ? (JSON.parse(s) as Sesion) : null;
  } catch {
    return null;
  }
}

function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesión vive solo mientras la pestaña esté abierta */
  }
}

async function crudo(ruta: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE + ruta, init);
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }
}

let refrescando: Promise<boolean> | null = null;

// Pide un access token nuevo. Solo cierra la sesión si el servidor la rechaza;
// si no hay red, la sesión se conserva para reintentar después.
function refrescar(): Promise<boolean> {
  const s = leerSesion();
  if (!s) return Promise.resolve(false);
  if (!refrescando) {
    refrescando = (async () => {
      try {
        const r = await crudo('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: s.refreshToken }),
        });
        if (r.ok) {
          const d = (await r.json()) as { accessToken: string; refreshToken: string };
          guardarSesion({ ...s, ...d });
          return true;
        }
        if (r.status === 400 || r.status === 401 || r.status === 403) {
          guardarSesion(null);
          window.dispatchEvent(new Event('sesion-expirada'));
        }
        return false;
      } catch {
        return false;
      } finally {
        refrescando = null;
      }
    })();
  }
  return refrescando;
}

async function pedir<T>(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  reintentar = true,
): Promise<{ status: number; data: T }> {
  const s = leerSesion();
  const r = await crudo(ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(s ? { Authorization: `Bearer ${s.accessToken}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  if (r.status === 401 && reintentar && s && !ruta.startsWith('/auth/')) {
    if (await refrescar()) return pedir<T>(metodo, ruta, cuerpo, false);
  }

  const texto = await r.text();
  let data: any = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!r.ok) throw new ApiError(r.status, data?.mensaje ?? `Error ${r.status}`, data?.errores);
  return { status: r.status, data: data as T };
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta).then((r) => r.data),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>('POST', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo).then((r) => r.data),
  delete: <T>(ruta: string) => pedir<T>('DELETE', ruta).then((r) => r.data),
};

export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  const { data } = await pedir<{ accessToken: string; refreshToken: string }>('POST', '/auth/login', {
    email,
    password,
  });
  guardarSesion({ ...data, rol: '' });
  const yo = await api.get<{ rol: string }>('/auth/me');
  const sesion = { ...data, rol: yo.rol };
  guardarSesion(sesion);
  return sesion;
}

export async function cerrarSesion() {
  const s = leerSesion();
  guardarSesion(null);
  if (s) {
    try {
      await crudo('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
    } catch {
      /* si no hay red, el refresh token caduca solo */
    }
  }
}

// Recorre todas las páginas de un listado paginado { datos, total }.
export async function listarTodo<T>(ruta: string): Promise<T[]> {
  const todos: T[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const sep = ruta.includes('?') ? '&' : '?';
    const r = await api.get<{ datos: T[]; total: number }>(`${ruta}${sep}pagina=${pagina}&limite=100`);
    todos.push(...r.datos);
    if (todos.length >= r.total || r.datos.length === 0) break;
  }
  return todos;
}
