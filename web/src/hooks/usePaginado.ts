import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';

interface Respuesta<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

// Trae un listado paginado de la API y se vuelve a pedir cuando cambian la página o los filtros.
// Los filtros vacíos no se envían.
export function usePaginado<T>(ruta: string, filtros: Record<string, string> = {}, limite = 20) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const pedido = useRef(0);

  const clave = JSON.stringify(filtros);

  // Si cambian los filtros se vuelve a la página 1.
  useEffect(() => setPagina(1), [clave]);

  useEffect(() => {
    const id = ++pedido.current;
    const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);

    setCargando(true);
    setError('');
    api
      .get<Respuesta<T>>(`${ruta}?${params}`)
      .then((r) => {
        if (id !== pedido.current) return; // llegó una respuesta vieja
        setDatos(r.datos);
        setTotal(r.total);
      })
      .catch((e: ApiError) => {
        if (id !== pedido.current) return;
        setDatos([]);
        setTotal(0);
        setError(
          e.status === 0
            ? 'Sin conexión con el servidor.'
            : e.status === 403
              ? 'No tienes permiso para ver esto.'
              : e.message,
        );
      })
      .finally(() => {
        if (id === pedido.current) setCargando(false);
      });
  }, [ruta, clave, pagina, limite]);

  return { datos, total, pagina, limite, cargando, error, setPagina };
}
