import { useEffect, useState } from 'react';
import { db } from '../db';
import { EVENTO_COLA, sincronizar } from '../sync';
import type { Ruta } from '../App';

const PUEDE_CAPTURAR = ['ADMIN', 'SUPERVISOR', 'BASCULA', 'CAMPO'];

export default function Inicio({
  rol,
  ir,
  catalogosListos,
}: {
  rol: string;
  ir: (r: Ruta) => void;
  catalogosListos: boolean;
}) {
  const [pendientes, setPendientes] = useState(0);
  const [errores, setErrores] = useState(0);
  const [mensaje, setMensaje] = useState('');

  async function contar() {
    const ops = await db.operaciones.toArray();
    setPendientes(ops.filter((o) => o.estado !== 'ERROR').length);
    setErrores(ops.filter((o) => o.estado === 'ERROR').length);
  }

  useEffect(() => {
    contar();
    window.addEventListener(EVENTO_COLA, contar);
    return () => window.removeEventListener(EVENTO_COLA, contar);
  }, []);

  async function enviarAhora() {
    if (!navigator.onLine) return setMensaje('Sin conexión: se enviará cuando haya internet.');
    setMensaje('Enviando…');
    const r = await sincronizar();
    setMensaje(r.enviadas ? `Se enviaron ${r.enviadas}.` : 'No hay nada que enviar.');
  }

  return (
    <section className="menu">
      {PUEDE_CAPTURAR.includes(rol) && (
        <button className="grande primario" onClick={() => ir({ nombre: 'nueva' })} disabled={!catalogosListos}>
          Nueva recepción
          {!catalogosListos && <small>Descargando catálogos… (necesita internet la primera vez)</small>}
        </button>
      )}
      <button className="grande" onClick={() => ir({ nombre: 'escanear' })}>
        Escanear QR
      </button>
      <button className="grande" onClick={() => ir({ nombre: 'productores' })}>
        Productores y entregas
      </button>
      <button className="grande" onClick={() => ir({ nombre: 'historial' })}>
        Mis envíos y comprobantes
        {(pendientes > 0 || errores > 0) && (
          <small>
            {pendientes > 0 && `${pendientes} por enviar`}
            {pendientes > 0 && errores > 0 && ' · '}
            {errores > 0 && `${errores} con error`}
          </small>
        )}
      </button>
      {pendientes > 0 && (
        <button onClick={enviarAhora}>Enviar pendientes ahora</button>
      )}
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
    </section>
  );
}
