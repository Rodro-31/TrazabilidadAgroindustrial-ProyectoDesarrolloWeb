import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, descargarBlob } from '../api';
import { db } from '../db';
import { sincronizar } from '../sync';
import { comprimirImagen, fechaHora, kg, numero, tieneMaxDosDecimales, uuid } from '../util';
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
const PUEDE_FOTO = ['ADMIN', 'SUPERVISOR', 'BASCULA', 'CAMPO'];
const MAX_FOTOS = 5;

interface FotoInfo { id: string }

export default function Detalle({ id, rol }: { id: string; rol: string }) {
  const [r, setR] = useState<Recepcion | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ valor: string; url: string | null } | null>(null);
  const [bruto, setBruto] = useState('');
  const [tara, setTara] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState('');
  const [fotos, setFotos] = useState<{ id: string; url: string }[]>([]);
  const [msgFoto, setMsgFoto] = useState('');

  const cargar = () =>
    api
      .get<Recepcion>(`/recepciones/${id}`)
      .then(setR)
      .catch((e: ApiError) =>
        setError(e.status === 0 ? 'Sin conexión: el detalle se consulta con internet.' : e.message),
      );

  async function cargarFotos() {
    try {
      const lista = await api.get<FotoInfo[]>(`/recepciones/${id}/fotos`);
      const con = await Promise.all(
        lista.map(async (f) => ({ id: f.id, url: URL.createObjectURL(await descargarBlob(`/archivos/${f.id}`)) })),
      );
      setFotos((antes) => {
        antes.forEach((f) => URL.revokeObjectURL(f.url));
        return con;
      });
    } catch {
      /* sin conexión o sin fotos: el resto del detalle sigue funcionando */
    }
  }

  useEffect(() => {
    cargar();
    void cargarFotos();
    return () => setFotos((antes) => {
      antes.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
  }, [id]);

  async function agregarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setMsgFoto('');
    try {
      const blob = await comprimirImagen(archivo);
      await db.fotos.put({ id: uuid(), recepcionId: id, blob, estado: 'PENDIENTE', intentos: 0, creadoEn: new Date().toISOString() });
      setMsgFoto('Foto guardada: se envía sola cuando haya internet.');
      await sincronizar();
      await cargarFotos();
    } catch {
      setMsgFoto('No se pudo procesar la imagen. Prueba con otra.');
    }
  }

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

      <h3>Fotos</h3>
      {fotos.length === 0 && <p className="nota">Esta recepción no tiene fotos.</p>}
      <div className="galeria">
        {fotos.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
            <img src={f.url} alt="Foto de la recepción" />
          </a>
        ))}
      </div>
      {PUEDE_FOTO.includes(rol) && fotos.length < MAX_FOTOS && (
        <label>
          Agregar foto
          <input type="file" accept="image/*" capture="environment" onChange={(e) => { void agregarFoto(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      {msgFoto && <p role="status" className="aviso">{msgFoto}</p>}

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
