import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarTodo } from '../api';
import { useAuth } from '../auth';
import Tabla, { type Columna } from '../componentes/Tabla';
import { ESTADO_LOTE, kg, PRODUCTO, soloFecha } from '../formato';
import { usePaginado } from '../hooks/usePaginado';
import DetalleLote from './lotes/DetalleLote';
import NuevoLote from './lotes/NuevoLote';
import Trazabilidad from './lotes/Trazabilidad';
import { existenciaTotal, type LoteFila, type QrEmitido } from './lotes/tipos';

const ROLES_CREAR = ['ADMIN', 'SUPERVISOR', 'BASCULA'];

// Lista de lotes ("existencias por centro, lote, calidad y estado"), detalle y creación.
// La vista va en la URL: ?id=<lote> para el detalle, ?nuevo=1 para crear.
export default function Lotes() {
  const { sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  // El QR solo llega al crear el lote: se guarda aquí para mostrar la etiqueta en el detalle.
  const [recien, setRecien] = useState<{ id: string; qr: QrEmitido } | null>(null);

  const id = params.get('id');
  const volver = () => setParams({});

  let vista;
  if (id && params.get('traza')) {
    // ?id=<lote>&traza=1 → trazabilidad; tocar otro lote del camino salta a SU trazabilidad.
    vista = (
      <Trazabilidad
        id={id}
        alVolver={() => setParams({ id })}
        alAbrirLote={(otro) => setParams({ id: otro, traza: '1' })}
      />
    );
  } else if (id) {
    vista = (
      <DetalleLote
        key={id}
        id={id}
        qrInicial={recien?.id === id ? recien.qr : undefined}
        alVolver={volver}
        alVerTrazabilidad={() => setParams({ id, traza: '1' })}
      />
    );
  } else if (params.get('nuevo') && ROLES_CREAR.includes(sesion!.rol)) {
    vista = (
      <NuevoLote
        alCancelar={volver}
        alCrear={(lote) => {
          setRecien({ id: lote.id, qr: lote.qr });
          setParams({ id: lote.id });
        }}
      />
    );
  } else {
    vista = <ListaLotes puedeCrear={ROLES_CREAR.includes(sesion!.rol)} alAbrir={(l) => setParams({ id: l })} alNuevo={() => setParams({ nuevo: '1' })} />;
  }

  return (
    <section>
      <h1>Lotes</h1>
      {vista}
    </section>
  );
}

function ListaLotes({ puedeCrear, alAbrir, alNuevo }: { puedeCrear: boolean; alAbrir: (id: string) => void; alNuevo: () => void }) {
  const [centros, setCentros] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [grados, setGrados] = useState<{ id: string; nombre: string }[]>([]);
  const [f, setF] = useState({ buscar: '', centroId: '', estado: '', estadoProducto: '', gradoCalidadId: '', cosecha: '' });

  useEffect(() => {
    listarTodo<{ id: string; codigo: string; nombre: string }>('/centros').then(setCentros).catch(() => setCentros([]));
    listarTodo<{ id: string; nombre: string }>('/grados-calidad').then(setGrados).catch(() => setGrados([]));
  }, []);

  const lista = usePaginado<LoteFila>('/lotes', { ...f, buscar: f.buscar.trim() });
  const cambiar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });

  const columnas: Columna<LoteFila>[] = [
    {
      titulo: 'Código',
      celda: (l) => <button className="enlace" onClick={() => alAbrir(l.id)}>{l.codigo}</button>,
    },
    { titulo: 'Estado', celda: (l) => <span className={`insignia estado-${l.estado}`}>{ESTADO_LOTE[l.estado] ?? l.estado}</span> },
    { titulo: 'Producto', celda: (l) => PRODUCTO[l.estadoProducto] },
    { titulo: 'Grado', celda: (l) => l.gradoCalidad?.nombre ?? '—' },
    { titulo: 'Existencia', celda: (l) => kg(existenciaTotal(l)) },
    { titulo: 'Dónde está', celda: (l) => l.existencias.map((e) => e.centro.codigo).join(', ') || '—' },
    { titulo: 'Peso inicial', celda: (l) => kg(l.pesoInicialKg) },
    { titulo: 'Creado', celda: (l) => `${soloFecha(l.creadoEn)} · ${l.centro.codigo}` },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>Código<input value={f.buscar} onChange={cambiar('buscar')} placeholder="L-2026-…" /></label>
          <label>
            Con existencia en
            <select value={f.centroId} onChange={cambiar('centroId')}>
              <option value="">Todos los centros</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </label>
          <label>
            Estado
            <select value={f.estado} onChange={cambiar('estado')}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_LOTE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label>
            Producto
            <select value={f.estadoProducto} onChange={cambiar('estadoProducto')}>
              <option value="">Todos</option>
              {Object.entries(PRODUCTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label>
            Grado
            <select value={f.gradoCalidadId} onChange={cambiar('gradoCalidadId')}>
              <option value="">Todos</option>
              {grados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </label>
          <label>Cosecha<input type="number" value={f.cosecha} onChange={cambiar('cosecha')} placeholder="2026" /></label>
        </form>
        {puedeCrear && <button className="primario" onClick={alNuevo}>Nuevo lote</button>}
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(l) => l.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay lotes con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}
