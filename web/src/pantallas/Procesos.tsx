import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarTodo } from '../api';
import { useAuth } from '../auth';
import Exportar from '../componentes/Exportar';
import Tabla, { type Columna } from '../componentes/Tabla';
import { fecha, kg } from '../formato';
import { usePaginado } from '../hooks/usePaginado';
import DetalleProceso from './procesos/DetalleProceso';
import NuevoProceso from './procesos/NuevoProceso';
import { TIPO_PROCESO, type ProcesoCreado, type ProcesoFila } from './procesos/tipos';

const ROLES_CREAR = ['ADMIN', 'SUPERVISOR'];

// Procesos: mezcla, división, secado, limpieza y clasificación de lotes.
// La vista va en la URL, igual que en Lotes: ?id=<proceso> para el detalle, ?nuevo=1 para registrar.
export default function Procesos() {
  const { sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  // Los QR de los lotes nuevos solo llegan al crear el proceso: se guardan para imprimir las etiquetas.
  const [recien, setRecien] = useState<ProcesoCreado | null>(null);

  const id = params.get('id');
  const puedeCrear = ROLES_CREAR.includes(sesion!.rol);
  const volver = () => setParams({});

  let vista;
  if (id) {
    vista = <DetalleProceso key={id} id={id} qrs={recien?.id === id ? recien.qrs : undefined} alVolver={volver} />;
  } else if (params.get('nuevo') && puedeCrear) {
    vista = (
      <NuevoProceso
        alCancelar={volver}
        alCrear={(proceso) => {
          setRecien(proceso);
          setParams({ id: proceso.id });
        }}
      />
    );
  } else {
    vista = <ListaProcesos puedeCrear={puedeCrear} alAbrir={(p) => setParams({ id: p })} alNuevo={() => setParams({ nuevo: '1' })} />;
  }

  return (
    <section>
      <h1>Procesos</h1>
      {vista}
    </section>
  );
}

// Lotes distintos de un lado de las aristas (una mezcla tiene varios padres y un hijo).
const codigos = (lotes: { codigo: string }[]) => [...new Set(lotes.map((l) => l.codigo))].join(', ');

function ListaProcesos({ puedeCrear, alAbrir, alNuevo }: { puedeCrear: boolean; alAbrir: (id: string) => void; alNuevo: () => void }) {
  const [centros, setCentros] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [f, setF] = useState({ tipo: '', centroId: '' });

  useEffect(() => {
    listarTodo<{ id: string; codigo: string; nombre: string }>('/centros').then(setCentros).catch(() => setCentros([]));
  }, []);

  const lista = usePaginado<ProcesoFila>('/procesos', f);
  const cambiar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value });

  const columnas: Columna<ProcesoFila>[] = [
    { titulo: 'Código', celda: (p) => <button className="enlace" onClick={() => alAbrir(p.id)}>{p.codigo}</button> },
    { titulo: 'Tipo', celda: (p) => TIPO_PROCESO[p.tipo] ?? p.tipo },
    { titulo: 'Entraron', celda: (p) => codigos(p.relaciones.map((r) => r.padre)) },
    { titulo: 'Salieron', celda: (p) => codigos(p.relaciones.map((r) => r.hijo)) },
    { titulo: 'Merma', celda: (p) => kg(p.mermaKg) },
    { titulo: 'Centro', celda: (p) => p.centro.codigo },
    { titulo: 'Fecha', celda: (p) => fecha(p.realizadoEn) },
    { titulo: 'Realizado por', celda: (p) => p.realizadoPor.nombre },
  ];

  return (
    <>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <label>
            Tipo
            <select value={f.tipo} onChange={cambiar('tipo')}>
              <option value="">Todos</option>
              {Object.entries(TIPO_PROCESO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label>
            Centro
            <select value={f.centroId} onChange={cambiar('centroId')}>
              <option value="">Todos los centros</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </label>
        </form>
        <div className="acciones">
          <Exportar<ProcesoFila>
            ruta="/procesos"
            filtros={f}
            nombre="procesos"
            columnas={[
              { titulo: 'Código', valor: (p) => p.codigo },
              { titulo: 'Tipo', valor: (p) => TIPO_PROCESO[p.tipo] ?? p.tipo },
              { titulo: 'Entraron', valor: (p) => codigos(p.relaciones.map((r) => r.padre)) },
              { titulo: 'Salieron', valor: (p) => codigos(p.relaciones.map((r) => r.hijo)) },
              { titulo: 'Merma (kg)', valor: (p) => p.mermaKg },
              { titulo: 'Centro', valor: (p) => p.centro.codigo },
              { titulo: 'Fecha', valor: (p) => fecha(p.realizadoEn) },
              { titulo: 'Realizado por', valor: (p) => p.realizadoPor.nombre },
            ]}
          />
          {puedeCrear && <button className="primario" onClick={alNuevo}>Registrar proceso</button>}
        </div>
      </div>
      <Tabla
        columnas={columnas}
        filas={lista.datos}
        clave={(p) => p.id}
        cargando={lista.cargando}
        error={lista.error}
        vacio="No hay procesos con esos filtros."
        pagina={lista.pagina}
        limite={lista.limite}
        total={lista.total}
        alCambiarPagina={lista.setPagina}
      />
    </>
  );
}
