import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ESTADO_LOTE, fecha, kg, mensajeError, PRODUCTO } from '../formato';

// Respuesta de GET /dashboard. Los kg llegan como texto (Decimal).
interface Resumen {
  generadoEn: string;
  indicadores: {
    existenciaKg: string;
    lotesActivos: number;
    recepcionesHoy: number;
    kgRecibidosHoy: string;
    productoresActivos: number;
    procesos30Dias: number;
    merma30DiasKg: string;
  };
  existenciaPorCentro: { id: string; codigo: string; nombre: string; kg: string; lotes: number }[];
  existenciaPorProducto: { producto: string; kg: string }[];
  lotesPorEstado: { estado: string; lotes: number }[];
  recepcionesPorDia: { dia: string; recepciones: number; kg: string }[];
  ultimasRecepciones: {
    id: string;
    capturadoEn: string;
    estadoProducto: string;
    pesoNetoKg: string;
    productor: { nombre: string };
    centro: { codigo: string };
  }[];
  ultimosLotes: {
    id: string;
    codigo: string;
    estado: string;
    estadoProducto: string;
    pesoInicialKg: string;
    creadoEn: string;
    centro: { codigo: string };
  }[];
}

const numero = (n: number) => n.toLocaleString('es-GT');
const kgCorto = (v: string | number) => `${Number(v).toLocaleString('es-GT', { maximumFractionDigits: 1 })} kg`;

// Dashboard con datos reales: todo sale de una sola petición a la API.
export default function Dashboard() {
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setError('');
    api.get<Resumen>('/dashboard').then(setDatos).catch((e) => setError(mensajeError(e)));
  }, [version]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!datos) return <p className="nota">Cargando resumen…</p>;

  const i = datos.indicadores;
  return (
    <div className="dashboard">
      <div className="dashboard-cabecera">
        <small>Actualizado: {fecha(datos.generadoEn)}</small>
        <button onClick={() => setVersion((v) => v + 1)}>Actualizar</button>
      </div>

      <div className="indicadores">
        <Indicador titulo="Existencia total" valor={kgCorto(i.existenciaKg)} detalle="en todos los centros" />
        <Indicador titulo="Lotes activos" valor={numero(i.lotesActivos)} detalle="disponibles en bodega" />
        <Indicador titulo="Recepciones hoy" valor={numero(i.recepcionesHoy)} detalle={kg(i.kgRecibidosHoy)} />
        <Indicador titulo="Productores activos" valor={numero(i.productoresActivos)} />
        <Indicador titulo="Procesos (30 días)" valor={numero(i.procesos30Dias)} detalle={`merma ${kg(i.merma30DiasKg)}`} />
      </div>

      <div className="paneles">
        <section className="panel ancho">
          <h2>Kg recibidos por día (últimos {datos.recepcionesPorDia.length} días)</h2>
          <BarrasPorDia dias={datos.recepcionesPorDia} />
        </section>

        <section className="panel">
          <h2>Existencia por centro</h2>
          <Barras
            filas={datos.existenciaPorCentro.map((c) => ({
              clave: c.id,
              etiqueta: `${c.codigo} · ${c.nombre}`,
              valor: Number(c.kg),
              texto: `${kgCorto(c.kg)} · ${c.lotes} lote(s)`,
            }))}
            vacio="No hay centros activos."
          />
        </section>

        <section className="panel">
          <h2>Existencia por producto</h2>
          <Barras
            filas={['UVA', 'PERGAMINO', 'ORO'].map((p) => {
              const fila = datos.existenciaPorProducto.find((x) => x.producto === p);
              return { clave: p, etiqueta: PRODUCTO[p], valor: Number(fila?.kg ?? 0), texto: kgCorto(fila?.kg ?? 0) };
            })}
          />
        </section>

        <section className="panel">
          <h2>Lotes por estado</h2>
          <Barras
            filas={datos.lotesPorEstado.map((e) => ({
              clave: e.estado,
              etiqueta: ESTADO_LOTE[e.estado] ?? e.estado,
              valor: e.lotes,
              texto: numero(e.lotes),
            }))}
          />
        </section>

        <section className="panel">
          <h2>Últimas recepciones</h2>
          <ul className="recientes">
            {datos.ultimasRecepciones.map((r) => (
              <li key={r.id}>
                <Link to={`/recepciones?id=${r.id}`}>{r.productor.nombre}</Link>
                <span>{kg(r.pesoNetoKg)} · {PRODUCTO[r.estadoProducto]} · {r.centro.codigo}</span>
                <small>{fecha(r.capturadoEn)}</small>
              </li>
            ))}
            {datos.ultimasRecepciones.length === 0 && <li className="nota">Todavía no hay recepciones.</li>}
          </ul>
        </section>

        <section className="panel">
          <h2>Últimos lotes</h2>
          <ul className="recientes">
            {datos.ultimosLotes.map((l) => (
              <li key={l.id}>
                <Link to={`/lotes?id=${l.id}`}>{l.codigo}</Link>
                <span>
                  <span className={`insignia estado-${l.estado}`}>{ESTADO_LOTE[l.estado] ?? l.estado}</span>{' '}
                  {kg(l.pesoInicialKg)} · {PRODUCTO[l.estadoProducto]} · {l.centro.codigo}
                </span>
                <small>{fecha(l.creadoEn)}</small>
              </li>
            ))}
            {datos.ultimosLotes.length === 0 && <li className="nota">Todavía no hay lotes.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="indicador">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {detalle && <small>{detalle}</small>}
    </div>
  );
}

// Barras horizontales: el largo es proporcional al valor más grande y cada fila
// lleva su número escrito (no se depende solo del largo para leer el dato).
function Barras({ filas, vacio = 'Sin datos.' }: { filas: { clave: string; etiqueta: string; valor: number; texto: string }[]; vacio?: string }) {
  if (filas.length === 0) return <p className="nota">{vacio}</p>;
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="barras">
      {filas.map((f) => (
        <li key={f.clave}>
          <span className="barras-etiqueta" title={f.etiqueta}>{f.etiqueta}</span>
          <span className="barras-pista" title={`${f.etiqueta}: ${f.texto}`}>
            <span className="barras-relleno" style={{ width: `${(f.valor / max) * 100}%` }} />
          </span>
          <span className="barras-valor">{f.texto}</span>
        </li>
      ))}
    </ul>
  );
}

// Columnas por día. Al pasar el mouse (o tocar) una columna se ve el detalle del día.
function BarrasPorDia({ dias }: { dias: Resumen['recepcionesPorDia'] }) {
  const [activo, setActivo] = useState<string | null>(null);
  const max = Math.max(...dias.map((d) => Number(d.kg)), 1);
  const total = dias.reduce((s, d) => s + Number(d.kg), 0);
  const elegido = dias.find((d) => d.dia === activo);
  const corto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

  return (
    <>
      <p className="nota columnas-detalle" aria-live="polite">
        {elegido
          ? `${corto(elegido.dia)}: ${elegido.recepciones} recepción(es), ${kg(elegido.kg)}`
          : `Total del periodo: ${kg(total)} en ${dias.reduce((s, d) => s + d.recepciones, 0)} recepción(es)`}
      </p>
      <div className="columnas" onMouseLeave={() => setActivo(null)}>
        {dias.map((d) => (
          <button
            key={d.dia}
            className={`columna${d.dia === activo ? ' activa' : ''}`}
            onMouseEnter={() => setActivo(d.dia)}
            onFocus={() => setActivo(d.dia)}
            onClick={() => setActivo(d.dia)}
            aria-label={`${corto(d.dia)}: ${d.recepciones} recepciones, ${kg(d.kg)}`}
          >
            <span className="columna-pista">
              <span className="columna-relleno" style={{ height: `${(Number(d.kg) / max) * 100}%` }} />
            </span>
            <span className="columna-dia">{d.dia.slice(8, 10)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
