import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Ruta } from '../App';

// Pregunta a la API qué entidad es el QR y abre su detalle.
export default function ResolverQr({ valor, ir }: { valor: string; ir: (r: Ruta, reemplazar?: boolean) => void }) {
  const [mensaje, setMensaje] = useState('Buscando…');
  const [lote, setLote] = useState('');

  useEffect(() => {
    api
      .get<{ entidadTipo: string; entidadId: string }>(`/qr/${encodeURIComponent(valor)}`)
      .then((r) => {
        if (r.entidadTipo === 'recepcion') ir({ nombre: 'detalle', id: r.entidadId }, true);
        else {
          setLote(r.entidadId);
          setMensaje(`Este QR es de un ${r.entidadTipo}. Esa pantalla aún no está en la app de campo.`);
        }
      })
      .catch((e: ApiError) =>
        setMensaje(
          e.status === 0
            ? 'Sin conexión: para consultar un QR se necesita internet.'
            : e.status === 404
              ? 'Código QR no reconocido.'
              : e.status === 410
                ? 'Este código QR ya no es válido (fue reemplazado o revocado).'
                : e.message,
        ),
      );
  }, [valor]);

  return (
    <section>
      <p role="status">{mensaje}</p>
      {lote && <small>Id: {lote}</small>}
      <button onClick={() => ir({ nombre: 'escanear' }, true)}>Escanear otro</button>
    </section>
  );
}
