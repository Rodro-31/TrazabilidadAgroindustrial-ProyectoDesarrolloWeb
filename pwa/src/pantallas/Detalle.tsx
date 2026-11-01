import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { fechaHora, kg, numero, tieneMaxDosDecimales } from '../util';
import Comprobante from './Comprobante';

interface Pesaje {
  id: string;
  pesoBrutoKg: string;
  taraKg: string;
  pesoNetoKg: string;
  motivo: string | null;
  creadoEn: string;
  registradoPor: { nombre: string };
}
interface Recepcion {
  id: string;
  estadoProducto: string;
  pesoBrutoKg: string;
  taraKg: string;
  pesoNetoKg: string;
  humedadPct: string | null;
  observaciones: string | null;
  capturadoEn: string;
  centro: { nombre: string };
  productor: { codigo: string; nombre: string };
  finca: { nombre: string };
  registradoPor: { nombre: string };
  pesajes: Pesaje[];
}

const PUEDE_PESAR = ['ADMIN', 'SUPERVISOR', 'BASCULA'];

export default function Detalle({ id, rol }: { id: string; rol: string }) {
  const [r, setR] = useState<Recepcion | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ valor: string; url: string | null } | null>(null);
  const [bruto, setBruto] = useState('');
  const [tara, setTara] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState('');

  const cargar = () =>
    api
      .get<Recepcion>(`/recepciones/${id}`)
      .then(setR)
      .catch((e: ApiError) =>
        setError(e.status === 0 ? 'Sin conexión: el detalle se consulta con internet.' : e.message),
      );

  useEffect(() => {
    cargar();
  }, [id]);

  async function repesar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    const b = numero(bruto);
    const t = tara.trim() === '' ? 0 : numero(tara);
    if (b === null || b <= 0 || !tieneMaxDosDecimales(b)) return setMsg('Peso bruto inválido (máx. 2 decimales).');
    if (t === null || t < 0 || !tieneMaxDosDecimales(t)) return setMsg('Tara inválida (máx. 2 decimales).');
    if (b - t <= 0) return setMsg('La tara no puede ser igual o mayor que el peso bruto.');
    try {
      const nueva = await api.post<Recepcion>(`/recepciones/${id}/pesajes`, {
        pesoBrutoKg: b,
        taraKg: t,
        ...(motivo.trim() && { motivo: motivo.trim() }),
      });
      setR(nueva.data);
      setBruto('');
      setTara('');
      setMotivo('');
      setMsg('Nuevo pesaje registrado.');
    } catch (err) {
      setMsg((err as ApiError).message);
    }
  }

  async function nuevoQr() {
    if (!confirm('Se emitirá un QR nuevo y el anterior dejará de servir. ¿Continuar?')) return;
    try {
      const { data } = await api.post<{ valor: string; url: string | null }>(`/recepciones/${id}/qr`);
      setQr(data);
    } catch (err) {
      setMsg((err as ApiError).message);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!r) return <p>Cargando…</p>;

  return (
    <section className="detalle">
      <h2>{r.productor.codigo} · {r.productor.nombre}</h2>
      <dl>
        <dt>Centro</dt><dd>{r.centro.nombre}</dd>
        <dt>Finca</dt><dd>{r.finca.nombre}</dd>
        <dt>Estado</dt><dd>{r.estadoProducto}</dd>
        <dt>Peso bruto</dt><dd>{kg(r.pesoBrutoKg)}</dd>
        <dt>Tara</dt><dd>{kg(r.taraKg)}</dd>
        <dt>Peso neto</dt><dd><strong>{kg(r.pesoNetoKg)}</strong></dd>
        {r.humedadPct && (<><dt>Humedad</dt><dd>{r.humedadPct} %</dd></>)}
        <dt>Capturada</dt><dd>{fechaHora(r.capturadoEn)}</dd>
        <dt>Registró</dt><dd>{r.registradoPor.nombre}</dd>
        {r.observaciones && (<><dt>Observaciones</dt><dd>{r.observaciones}</dd></>)}
      </dl>

      {r.pesajes.length > 0 && (
        <>
          <h3>Historial de pesajes</h3>
          <ul className="lista">
            {r.pesajes.map((p) => (
              <li key={p.id} className="item">
                <strong>Neto {kg(p.pesoNetoKg)}</strong>
                <small>
                  Bruto {kg(p.pesoBrutoKg)} · tara {kg(p.taraKg)} · {fechaHora(p.creadoEn)} · {p.registradoPor.nombre}
                </small>
                {p.motivo && <small>Motivo: {p.motivo}</small>}
              </li>
            ))}
          </ul>
        </>
      )}

      {PUEDE_PESAR.includes(rol) && (
        <form className="formulario" onSubmit={repesar}>
          <h3>Volver a pesar</h3>
          <div className="fila">
            <label>Bruto (kg)<input inputMode="decimal" value={bruto} onChange={(e) => setBruto(e.target.value)} /></label>
            <label>Tara (kg)<input inputMode="decimal" value={tara} onChange={(e) => setTara(e.target.value)} /></label>
          </div>
          <label>Motivo<input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></label>
          <button>Registrar nuevo pesaje</button>
          <p className="nota">El pesaje anterior no se borra: queda en el historial.</p>
          {msg && <p role="status" className="aviso">{msg}</p>}
        </form>
      )}

      {PUEDE_PESAR.includes(rol) && (
        <>
          <button onClick={nuevoQr}>Reimprimir comprobante (QR nuevo)</button>
          {qr && <Comprobante url={qr.url} valor={qr.valor} resumen={`${r.productor.codigo} · neto ${kg(r.pesoNetoKg)}`} />}
        </>
      )}
    </section>
  );
}
