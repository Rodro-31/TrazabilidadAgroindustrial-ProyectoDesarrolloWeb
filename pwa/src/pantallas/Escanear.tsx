import { FormEvent, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { valorDeQr } from '../util';

export default function Escanear({ alLeer }: { alLeer: (valor: string) => void }) {
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const leido = useRef(false);

  useEffect(() => {
    const lector = new Html5Qrcode('visor-qr');
    let iniciado = false;
    lector
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => {
          if (leido.current) return; // el lector repite la lectura varias veces por segundo
          leido.current = true;
          alLeer(valorDeQr(texto));
        },
        () => {},
      )
      .then(() => {
        iniciado = true;
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código abajo.'));

    return () => {
      const limpiar = () => lector.clear();
      if (iniciado) lector.stop().then(limpiar, limpiar);
      else {
        try {
          limpiar();
        } catch {
          /* nunca llegó a iniciar */
        }
      }
    };
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (manual.trim()) alLeer(valorDeQr(manual));
  }

  return (
    <section>
      <div id="visor-qr" className="visor" />
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={enviar} className="formulario">
        <label>
          ¿No lee? Escribe o pega el código
          <input value={manual} onChange={(e) => setManual(e.target.value)} autoCapitalize="off" autoCorrect="off" />
        </label>
        <button>Buscar</button>
      </form>
    </section>
  );
}
