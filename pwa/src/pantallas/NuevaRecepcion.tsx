import { FormEvent, useMemo, useState } from 'react';
import { db } from '../db';
import type { Catalogos } from '../catalogos';
import { sincronizar } from '../sync';
import { kg, numero, tieneMaxDosDecimales, uuid } from '../util';

const ESTADOS = [
  { valor: 'UVA', texto: 'Uva (fresco)' },
  { valor: 'PERGAMINO', texto: 'Pergamino (seco)' },
  { valor: 'ORO', texto: 'Oro (limpio)' },
] as const;

const ULTIMO_CENTRO = 'trz.centro';
const leerCentro = () => {
  try {
    return localStorage.getItem(ULTIMO_CENTRO) ?? '';
  } catch {
    return '';
  }
};

export default function NuevaRecepcion({ catalogos, alGuardar }: { catalogos: Catalogos; alGuardar: () => void }) {
  // El id se genera UNA vez al abrir la pantalla: si se toca "Guardar" dos veces no se duplica.
  const [id] = useState(uuid);
  const [centroId, setCentroId] = useState(() => {
    const guardado = leerCentro();
    return catalogos.centros.some((c) => c.id === guardado) ? guardado : catalogos.centros[0]?.id ?? '';
  });
  const [filtro, setFiltro] = useState('');
  const [productorId, setProductorId] = useState('');
  const [fincaId, setFincaId] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]['valor']>('PERGAMINO');
  const [bruto, setBruto] = useState('');
  const [tara, setTara] = useState('');
  const [humedad, setHumedad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const productores = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return f
      ? catalogos.productores.filter((p) => `${p.codigo} ${p.nombre}`.toLowerCase().includes(f))
      : catalogos.productores;
  }, [catalogos.productores, filtro]);

  const fincas = catalogos.fincas.filter((f) => f.productor.id === productorId);

  const brutoN = numero(bruto);
  const taraN = tara.trim() === '' ? 0 : numero(tara);
  const neto = brutoN !== null && taraN !== null ? Math.round((brutoN - taraN) * 100) / 100 : null;

  function validar(): string {
    if (!centroId) return 'Elige el centro de acopio.';
    if (!productorId) return 'Elige el productor.';
    if (!fincaId) return 'Elige la finca.';
    if (brutoN === null || brutoN <= 0) return 'Escribe el peso bruto (mayor que 0).';
    if (!tieneMaxDosDecimales(brutoN)) return 'El peso bruto admite máximo 2 decimales.';
    if (taraN === null || taraN < 0) return 'La tara debe ser 0 o mayor.';
    if (!tieneMaxDosDecimales(taraN)) return 'La tara admite máximo 2 decimales.';
    if (neto === null || neto <= 0) return 'La tara no puede ser igual o mayor que el peso bruto.';
    if (humedad.trim() !== '') {
      const h = numero(humedad);
      if (h === null || h < 0 || h > 100 || !tieneMaxDosDecimales(h)) return 'La humedad debe estar entre 0 y 100 (máx. 2 decimales).';
    }
    return '';
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    setError('');
    setGuardando(true);
    try {
      const productor = catalogos.productores.find((p) => p.id === productorId);
      await db.operaciones.put({
        id,
        tipo: 'recepcion',
        payload: {
          id,
          centroId,
          productorId,
          fincaId,
          estadoProducto: estado,
          pesoBrutoKg: brutoN,
          taraKg: taraN,
          ...(humedad.trim() !== '' && { humedadPct: numero(humedad) }),
          ...(observaciones.trim() && { observaciones: observaciones.trim() }),
          capturadoEn: new Date().toISOString(),
        },
        resumen: `${productor?.codigo ?? ''} ${productor?.nombre ?? ''} · ${estado} · neto ${kg(neto!)}`.trim(),
        estado: 'PENDIENTE',
        intentos: 0,
        creadoEn: new Date().toISOString(),
      });
      try {
        localStorage.setItem(ULTIMO_CENTRO, centroId);
      } catch {
        /* preferencia opcional */
      }
      void sincronizar(); // si hay internet sale de inmediato; si no, queda en la cola
      alGuardar();
    } catch {
      setError('No se pudo guardar en el dispositivo. Intenta de nuevo.');
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <label>
        Centro de acopio
        <select value={centroId} onChange={(e) => setCentroId(e.target.value)}>
          {catalogos.centros.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      <label>
        Productor
        <input
          type="search"
          placeholder="Buscar por código o nombre"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <select
          value={productorId}
          onChange={(e) => {
            setProductorId(e.target.value);
            setFincaId('');
          }}
        >
          <option value="">— elige —</option>
          {productores.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
          ))}
        </select>
      </label>

      <label>
        Finca
        <select value={fincaId} onChange={(e) => setFincaId(e.target.value)} disabled={!productorId}>
          <option value="">{productorId && fincas.length === 0 ? 'Este productor no tiene fincas' : '— elige —'}</option>
          {fincas.map((f) => (
            <option key={f.id} value={f.id}>{f.nombre}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Estado del producto</legend>
        {ESTADOS.map((e) => (
          <label key={e.valor} className="opcion">
            <input type="radio" name="estado" checked={estado === e.valor} onChange={() => setEstado(e.valor)} />
            {e.texto}
          </label>
        ))}
      </fieldset>

      <div className="fila">
        <label>
          Peso bruto (kg)
          <input inputMode="decimal" value={bruto} onChange={(e) => setBruto(e.target.value)} placeholder="0.00" />
        </label>
        <label>
          Tara (kg)
          <input inputMode="decimal" value={tara} onChange={(e) => setTara(e.target.value)} placeholder="0.00" />
        </label>
      </div>
      <p className="neto">Peso neto: <strong>{neto !== null && neto > 0 ? kg(neto) : '—'}</strong></p>

      <label>
        Humedad % (opcional)
        <input inputMode="decimal" value={humedad} onChange={(e) => setHumedad(e.target.value)} placeholder="12.5" />
      </label>

      <label>
        Observaciones (opcional)
        <textarea rows={3} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="primario grande" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar recepción'}
      </button>
      <p className="nota">Se guarda en este teléfono y se envía sola cuando haya internet.</p>
    </form>
  );
}
