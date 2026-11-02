import { useEffect, useState } from 'react';
import { api } from '../../api';
import { fecha, kg, mensajeError } from '../../formato';

interface Movimiento {
  id: string;
  tipo: string;
  cantidadKg: string;
  saldoKg: string;
  referencia: string | null;
  motivo: string | null;
  creadoEn: string;
  centro: { codigo: string };
  usuario: { nombre: string };
}

const TIPO_MOVIMIENTO: Record<string, string> = {
  ENTRADA_RECEPCION: 'Entrada por recepción',
  ENTRADA_TRASLADO: 'Entrada por traslado',
  ENTRADA_PROCESO: 'Entrada por proceso',
  SALIDA_TRASLADO: 'Salida por traslado',
  SALIDA_PROCESO: 'Salida a proceso',
  SALIDA_VENTA: 'Salida por venta',
  AJUSTE: 'Ajuste',
};

// Kárdex del lote: cada entrada (+) y salida (−) con el saldo que dejó.
// Es un libro: los movimientos solo se agregan, nunca se editan ni se borran.
export default function Movimientos({ loteId }: { loteId: string }) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Movimiento[]>(`/lotes/${loteId}/movimientos`).then(setMovimientos).catch((e) => setError(mensajeError(e)));
  }, [loteId]);

  if (error) return <p className="error">{error}</p>;
  if (!movimientos) return <p className="nota">Cargando…</p>;
  if (movimientos.length === 0) return <p className="nota">Sin movimientos.</p>;

  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr><th>Fecha</th><th>Movimiento</th><th>Kg</th><th>Saldo</th><th>Centro</th><th>Origen o destino</th><th>Usuario</th></tr>
        </thead>
        <tbody>
          {movimientos.map((m) => {
            const cantidad = Number(m.cantidadKg);
            return (
              <tr key={m.id}>
                <td>{fecha(m.creadoEn)}</td>
                <td>{TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                <td className={cantidad < 0 ? 'salida-kg' : 'entrada-kg'}>{cantidad > 0 ? '+' : '−'}{kg(Math.abs(cantidad))}</td>
                <td className="saldo-kg"><strong>{kg(m.saldoKg)}</strong></td>
                <td>{m.centro.codigo}</td>
                <td>{m.referencia ?? '—'}{m.motivo ? ` · ${m.motivo}` : ''}</td>
                <td>{m.usuario.nombre}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
