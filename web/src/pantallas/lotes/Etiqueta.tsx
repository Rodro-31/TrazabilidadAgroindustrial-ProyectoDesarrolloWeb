import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { kg, PRODUCTO, soloFecha } from '../../formato';
import type { LoteDetalle, QrEmitido } from './tipos';

// Etiqueta imprimible del lote. El QR lleva solo la URL con un valor aleatorio:
// ningún dato del lote ni del productor (lo exige el enunciado).
// El valor solo existe al crear el lote o al reimprimir (en la base queda su hash).
export default function Etiqueta({ lote, qr }: { lote: LoteDetalle; qr: QrEmitido }) {
  const [imagen, setImagen] = useState('');

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(qr.url ?? qr.valor, { margin: 1, width: 280 }).then((d) => vivo && setImagen(d));
    return () => {
      vivo = false;
    };
  }, [qr]);

  return (
    <div className="panel">
      <div className="etiqueta imprimible">
        {imagen ? <img src={imagen} alt={`Código QR del lote ${lote.codigo}`} width={180} height={180} /> : <p>Generando QR…</p>}
        <div>
          <strong className="etiqueta-codigo">{lote.codigo}</strong>
          <span>Cardamomo {PRODUCTO[lote.estadoProducto]?.toLowerCase()}{lote.gradoCalidad ? ` · ${lote.gradoCalidad.nombre}` : ''}</span>
          <span>Peso inicial: {kg(lote.pesoInicialKg)}</span>
          <span>{lote.centro.codigo} · {lote.centro.nombre}</span>
          <span>Cosecha {lote.cosecha} · {soloFecha(lote.creadoEn)}</span>
        </div>
      </div>
      <div className="acciones">
        <button className="primario" onClick={() => window.print()} disabled={!imagen}>Imprimir etiqueta</button>
      </div>
      <p className="nota">Imprímela ahora: por seguridad, este QR no se vuelve a mostrar. Si se pierde, usa “Reimprimir etiqueta” (anula el anterior).</p>
    </div>
  );
}
