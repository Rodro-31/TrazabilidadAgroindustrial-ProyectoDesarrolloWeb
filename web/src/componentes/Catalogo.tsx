import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { mensajeError } from '../formato';
import { usePaginado } from '../hooks/usePaginado';
import Tabla, { type Columna } from './Tabla';

// Pantalla genérica de catálogo (listar, filtrar, crear, editar, desactivar y reactivar).
// Cada catálogo se describe con una configuración en src/catalogos.tsx.

export interface Opcion {
  valor: string;
  texto: string;
}

// Las opciones pueden ser fijas (un enum) o venir de la API (por ejemplo, la lista de productores).
type Opciones = Opcion[] | (() => Promise<Opcion[]>);

export interface Campo {
  nombre: string;
  etiqueta: string;
  tipo?: 'texto' | 'numero' | 'entero' | 'email' | 'select';
  requerido?: boolean;
  soloAlCrear?: boolean; // la API no permite cambiarlo después (OmitType en el DTO)
  opciones?: Opciones;
  ayuda?: string;
}

export interface Filtro {
  nombre: string;
  etiqueta: string;
  opciones?: Opciones; // sin opciones = cuadro de texto
  placeholder?: string;
}

export interface ConfigCatalogo<T extends { id: string; activo: boolean }> {
  clave: string;
  titulo: string;
  singular: string;
  ruta: string; // ruta de la API, ej. '/productores'
  columnas: Columna<T>[];
  campos: Campo[];
  filtros: Filtro[];
  rolesEscritura: string[]; // crear y editar
  rolesDesactivar: string[];
}

type Valores = Record<string, string>;

function useOpciones(opciones?: Opciones): Opcion[] {
  const [lista, setLista] = useState<Opcion[]>(Array.isArray(opciones) ? opciones : []);
  useEffect(() => {
    if (typeof opciones === 'function') {
      opciones().then(setLista).catch(() => setLista([]));
    }
  }, [opciones]);
  return lista;
}

// Convierte lo escrito en el formulario al tipo que espera la API.
function convertir(campo: Campo, texto: string): unknown {
  const v = texto.trim();
  if (campo.tipo === 'numero') return Number(v);
  if (campo.tipo === 'entero') return Number.parseInt(v, 10);
  return v;
}

export default function Catalogo<T extends { id: string; activo: boolean }>({ config }: { config: ConfigCatalogo<T> }) {
  const { sesion } = useAuth();
  const puedeEscribir = config.rolesEscritura.includes(sesion!.rol);
  const puedeDesactivar = config.rolesDesactivar.includes(sesion!.rol);

  const [filtros, setFiltros] = useState<Valores>({ activo: 'true' });
  const [editando, setEditando] = useState<T | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState('');
  // Cambiar "version" vuelve a montar la lista: así se recarga después de guardar.
  const [version, setVersion] = useState(0);

  const recargar = (mensaje: string) => {
    setEditando(null);
    setAviso(mensaje);
    setVersion((v) => v + 1);
  };

  async function cambiarActivo(fila: T, activo: boolean) {
    const accion = activo ? 'reactivar' : 'desactivar';
    if (!confirm(`¿Seguro que quieres ${accion} este registro?`)) return;
    try {
      if (activo) await api.patch(`${config.ruta}/${fila.id}`, { activo: true });
      else await api.delete(`${config.ruta}/${fila.id}`);
      recargar(activo ? 'Registro reactivado.' : 'Registro desactivado (no se borra: conserva su historial).');
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  const columnas: Columna<T>[] = [
    ...config.columnas,
    {
      titulo: 'Estado',
      celda: (f) => <span className={`insignia ${f.activo ? 'ok' : 'apagada'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span>,
    },
  ];
  if (puedeEscribir || puedeDesactivar) {
    columnas.push({
      titulo: 'Acciones',
      celda: (f) => (
        <div className="acciones">
          {puedeEscribir && <button onClick={() => { setAviso(''); setEditando(f); }}>Editar</button>}
          {puedeDesactivar && f.activo && <button onClick={() => cambiarActivo(f, false)}>Desactivar</button>}
          {puedeEscribir && !f.activo && <button onClick={() => cambiarActivo(f, true)}>Reactivar</button>}
        </div>
      ),
    });
  }

  return (
    <div>
      <div className="barra">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          {config.filtros.map((f) => (
            <CampoFiltro key={f.nombre} filtro={f} valor={filtros[f.nombre] ?? ''} alCambiar={(v) => setFiltros({ ...filtros, [f.nombre]: v })} />
          ))}
          <label>
            Estado
            <select value={filtros.activo ?? ''} onChange={(e) => setFiltros({ ...filtros, activo: e.target.value })}>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </select>
          </label>
        </form>
        {puedeEscribir && (
          <button className="primario" onClick={() => { setAviso(''); setEditando('nuevo'); }}>
            Nuevo {config.singular}
          </button>
        )}
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}

      {editando && (
        <Formulario
          config={config}
          registro={editando === 'nuevo' ? null : editando}
          alCancelar={() => setEditando(null)}
          alGuardar={() => recargar(editando === 'nuevo' ? 'Registro creado.' : 'Cambios guardados.')}
        />
      )}

      <Lista key={version} config={config} columnas={columnas} filtros={filtros} />
    </div>
  );
}

function Lista<T extends { id: string; activo: boolean }>({
  config,
  columnas,
  filtros,
}: {
  config: ConfigCatalogo<T>;
  columnas: Columna<T>[];
  filtros: Valores;
}) {
  const limpios = Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, v.trim()]));
  const lista = usePaginado<T>(config.ruta, limpios);
  return (
    <Tabla
      columnas={columnas}
      filas={lista.datos}
      clave={(f) => f.id}
      cargando={lista.cargando}
      error={lista.error}
      vacio="No hay registros con esos filtros."
      pagina={lista.pagina}
      limite={lista.limite}
      total={lista.total}
      alCambiarPagina={lista.setPagina}
    />
  );
}

function CampoFiltro({ filtro, valor, alCambiar }: { filtro: Filtro; valor: string; alCambiar: (v: string) => void }) {
  const opciones = useOpciones(filtro.opciones);
  return (
    <label>
      {filtro.etiqueta}
      {filtro.opciones ? (
        <select value={valor} onChange={(e) => alCambiar(e.target.value)}>
          <option value="">Todos</option>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
      ) : (
        <input value={valor} onChange={(e) => alCambiar(e.target.value)} placeholder={filtro.placeholder} />
      )}
    </label>
  );
}

function Formulario<T extends { id: string; activo: boolean }>({
  config,
  registro,
  alCancelar,
  alGuardar,
}: {
  config: ConfigCatalogo<T>;
  registro: T | null;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  const [valores, setValores] = useState<Valores>({});
  const [originales, setOriginales] = useState<Valores>({});
  const [cargando, setCargando] = useState(Boolean(registro));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Para editar se pide el detalle: la fila de la lista no trae todos los campos (por ejemplo, el DPI).
  useEffect(() => {
    if (!registro) return;
    api
      .get<Record<string, unknown>>(`${config.ruta}/${registro.id}`)
      .then((d) => {
        const v: Valores = {};
        for (const c of config.campos) v[c.nombre] = d[c.nombre] == null ? '' : String(d[c.nombre]);
        setValores(v);
        setOriginales(v);
      })
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false));
  }, [registro, config]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (!registro) {
        // Crear: se envían solo los campos con valor.
        const cuerpo: Record<string, unknown> = {};
        for (const c of config.campos) {
          if ((valores[c.nombre] ?? '').trim() !== '') cuerpo[c.nombre] = convertir(c, valores[c.nombre]);
        }
        await api.post(config.ruta, cuerpo);
      } else {
        // Editar (PATCH): se envía solo lo que cambió; vaciar un campo opcional lo deja en null.
        const cuerpo: Record<string, unknown> = {};
        for (const c of config.campos) {
          if (c.soloAlCrear) continue;
          const nuevo = (valores[c.nombre] ?? '').trim();
          if (nuevo === (originales[c.nombre] ?? '')) continue;
          cuerpo[c.nombre] = nuevo === '' ? null : convertir(c, nuevo);
        }
        if (Object.keys(cuerpo).length === 0) return alCancelar();
        await api.patch(`${config.ruta}/${registro.id}`, cuerpo);
      }
      alGuardar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="panel" onSubmit={guardar}>
      <h2>{registro ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</h2>
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <div className="rejilla">
          {config.campos.map((c) => (
            <CampoFormulario
              key={c.nombre}
              campo={c}
              valor={valores[c.nombre] ?? ''}
              bloqueado={Boolean(registro && c.soloAlCrear)}
              alCambiar={(v) => setValores({ ...valores, [c.nombre]: v })}
            />
          ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button type="submit" className="primario" disabled={guardando || cargando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function CampoFormulario({
  campo,
  valor,
  bloqueado,
  alCambiar,
}: {
  campo: Campo;
  valor: string;
  bloqueado: boolean;
  alCambiar: (v: string) => void;
}) {
  const opciones = useOpciones(campo.opciones);
  const titulo = bloqueado ? 'No se puede cambiar después de crearlo' : campo.ayuda;
  return (
    <label title={titulo}>
      {campo.etiqueta}
      {campo.requerido && !bloqueado && <span className="obligatorio"> *</span>}
      {campo.tipo === 'select' ? (
        <select value={valor} onChange={(e) => alCambiar(e.target.value)} required={campo.requerido} disabled={bloqueado}>
          <option value="">— Elegir —</option>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
      ) : (
        <input
          type={campo.tipo === 'email' ? 'email' : campo.tipo === 'numero' || campo.tipo === 'entero' ? 'number' : 'text'}
          step={campo.tipo === 'entero' ? 1 : campo.tipo === 'numero' ? 'any' : undefined}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          required={campo.requerido}
          disabled={bloqueado}
        />
      )}
      {campo.ayuda && !bloqueado && <small>{campo.ayuda}</small>}
    </label>
  );
}
