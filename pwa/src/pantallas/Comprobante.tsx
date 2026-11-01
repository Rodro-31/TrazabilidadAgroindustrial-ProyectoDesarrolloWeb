import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Dibuja el QR de una recepción. El valor solo lo entrega el servidor al crearla
// (o al emitir uno nuevo), por eso se muestra con lo que se tenga guardado.
export default function Comprobante({ url, valor, resumen }: { url: string | null; valor: string; resumen?: string }) {
  const [imagen, setImagen] = useState('');
  const contenido = url ?? valor;

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(contenido, { margin: 1, width: 280 }).then((d) => vivo && setImagen(d));
    return () => {
      vivo = false;
    };
  }, [contenido]);

  return (
    <div className="comprobante">
      {resumen && <p>{resumen}</p>}
      {imagen ? <img src={imagen} alt="Código QR de la recepción" width={240} height={240} /> : <p>Generando QR…</p>}
      <button onClick={() => window.print()}>Imprimir comprobante</button>
    </div>
  );
}
