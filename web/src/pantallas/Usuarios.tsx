import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, listarTodo } from '../api';
import Tabla from '../componentes/Tabla';
import { usePaginado } from '../hooks/usePaginado';

const ROLES = ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'CAMPO', 'AUDITOR'] as const;

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  bloqueadoHasta: string | null;
  creadoEn: string;
  centros: { centro: Centro }[];
}

interface Centro {
  id: string;
  codigo: string;
  nombre: string;
}

type Panel = null | { tipo: 'nuevo' } | { tipo: 'editar'; u: Usuario } | { tipo: 'password'; u: Usuario };

const estaBloqueado = (u: Usuario) => !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();
const mensaje = (e: unknown) => {
  const err = e as ApiError;
  return err.errores?.length ? `${err.message}: ${err.errores.join('; ')}` : err.message;
};

// Gestión de cuentas (solo ADMIN): crear, editar rol/estado, restablecer contraseña y desbloquear.
export default function Usuarios() {
  const [buscar, setBuscar] = useState('');
  const [rol, setRol] = useState('');
  const [activo, setActivo] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [aviso, setAviso] = useState('');
  const [version, setVersion] = useState(0); // al cambiar, la lista se vuelve a pedir

  const hecho = (texto: string) => {
    setPanel(null);
    setAviso(texto);
    setVersion((v) => v + 1);
  };

  return (
    <section>
      <h1>Usuarios</h1>
      <div className="barra">
        <div className="filtros">
          <label>Buscar<input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre o correo" /></label>
          <label>Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={activo} onChange={(e) => setActivo(e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Desactivados</option>
            </select>
          </label>
        </div>
        <button className="primario" onClick={() => { setAviso(''); setPanel({ tipo: 'nuevo' }); }}>Nuevo usuario</button>
      </div>

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {panel?.tipo === 'nuevo' && <FormNuevo alCancelar={() => setPanel(null)} alTerminar={hecho} />}
      {panel?.tipo === 'editar' && <FormEditar key={panel.u.id} u={panel.u} alCancelar={() => setPanel(null)} alTerminar={hecho} />}
      {panel?.tipo === 'password' && <FormPassword key={panel.u.id} u={panel.u} alCancelar={() => setPanel(null)} alTerminar={hecho} />}

      <Lista
        key={version}
        filtros={{ buscar: buscar.trim(), rol, activo }}
        alEditar={(u) => { setAviso(''); setPanel({ tipo: 'editar', u }); }}
        alPassword={(u) => { setAviso(''); setPanel({ tipo: 'password', u }); }}
        alDesbloquear={async (u) => {
          try {
            await api.post(`/usuarios/${u.id}/desbloquear`);
            hecho(`Cuenta de ${u.nombre} desbloqueada.`);
          } catch (e) {
            setAviso(mensaje(e));
          }
        }}
      />
    </section>
  );
}

function Lista({
  filtros,
  alEditar,
  alPassword,
  alDesbloquear,
}: {
  filtros: Record<string, string>;
  alEditar: (u: Usuario) => void;
  alPassword: (u: Usuario) => void;
  alDesbloquear: (u: Usuario) => void;
}) {
  const { datos, total, pagina, limite, cargando, error, setPagina } = usePaginado<Usuario>('/usuarios', filtros);
  return (
    <Tabla
      columnas={[
        { titulo: 'Nombre', celda: (u) => u.nombre },
        { titulo: 'Correo', celda: (u) => u.email },
        { titulo: 'Rol', celda: (u) => u.rol },
        {
          titulo: 'Centros',
          celda: (u) => (u.centros?.length ? u.centros.map((c) => c.centro.codigo).join(', ') : <span className="nota">Ninguno</span>),
        },
        {
          titulo: 'Estado',
          celda: (u) => (
            <>
              <span className={u.activo ? 'insignia ok' : 'insignia apagada'}>{u.activo ? 'Activo' : 'Desactivado'}</span>
              {estaBloqueado(u) && <span className="insignia apagada"> Bloqueado</span>}
            </>
          ),
        },
        {
          titulo: 'Acciones',
          celda: (u) => (
            <div className="acciones">
              <button onClick={() => alEditar(u)}>Editar</button>
              <button onClick={() => alPassword(u)}>Contraseña</button>
              {estaBloqueado(u) && <button onClick={() => alDesbloquear(u)}>Desbloquear</button>}
            </div>
          ),
        },
      ]}
      filas={datos}
      clave={(u) => u.id}
      cargando={cargando}
      error={error}
      vacio="No hay usuarios con esos filtros."
      pagina={pagina}
      limite={limite}
      total={total}
      alCambiarPagina={setPagina}
    />
  );
}

interface FormProps {
  alCancelar: () => void;
  alTerminar: (texto: string) => void;
}

function FormNuevo({ alCancelar, alTerminar }: FormProps) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<string>('CAMPO');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/usuarios', { email: email.trim(), nombre: nombre.trim(), rol, password });
      alTerminar(`Usuario ${nombre.trim()} creado.`);
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  }

  return (
    <form className="panel" onSubmit={enviar}>
      <h2>Nuevo usuario</h2>
      <div className="rejilla">
        <label>Nombre <span className="obligatorio">*</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={120} /></label>
        <label>Correo <span className="obligatorio">*</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={120} /></label>
        <label>Rol <span className="obligatorio">*</span>
          <select value={rol} onChange={(e) => setRol(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label>Contraseña inicial <span className="obligatorio">*</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
          <small className="nota">Mínimo 8 caracteres. Entrégala por un canal privado.</small>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button className="primario" disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function FormEditar({ u, alCancelar, alTerminar }: FormProps & { u: Usuario }) {
  const [nombre, setNombre] = useState(u.nombre);
  const [rol, setRol] = useState(u.rol);
  const [activo, setActivo] = useState(u.activo);
  const asignadosAntes = (u.centros ?? []).map((c) => c.centro.id);
  const [centrosSel, setCentrosSel] = useState<string[]>(asignadosAntes);
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cierraSesiones = rol !== u.rol || (u.activo && !activo);

  useEffect(() => {
    listarTodo<Centro>('/centros?activo=true')
      .then(setCentros)
      .catch(() => setCentros([]));
  }, []);

  const alternar = (id: string) =>
    setCentrosSel((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  const centrosCambiaron =
    centrosSel.length !== asignadosAntes.length || centrosSel.some((id) => !asignadosAntes.includes(id));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.patch(`/usuarios/${u.id}`, { nombre: nombre.trim(), rol, activo });
      if (centrosCambiaron) await api.put(`/usuarios/${u.id}/centros`, { centroIds: centrosSel });
      alTerminar(`Usuario ${nombre.trim()} actualizado.`);
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  }

  return (
    <form className="panel" onSubmit={enviar}>
      <h2>Editar {u.email}</h2>
      <div className="rejilla">
        <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={120} /></label>
        <label>Rol
          <select value={rol} onChange={(e) => setRol(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label>Estado
          <select value={String(activo)} onChange={(e) => setActivo(e.target.value === 'true')}>
            <option value="true">Activo</option>
            <option value="false">Desactivado</option>
          </select>
        </label>
      </div>
      <fieldset className="centros">
        <legend>Centros de acopio donde trabaja</legend>
        {centros === null && <p className="nota">Cargando centros…</p>}
        {centros?.length === 0 && <p className="nota">No hay centros activos.</p>}
        {[
          ...(centros ?? []),
          // Un centro desactivado que ya tenía asignado sigue visible para poder quitárselo.
          ...(u.centros ?? []).map((c) => c.centro).filter((c) => centros && !centros.some((x) => x.id === c.id)),
        ].map((c) => (
          <label key={c.id} className="casilla">
            <input type="checkbox" checked={centrosSel.includes(c.id)} onChange={() => alternar(c.id)} />
            {c.codigo} · {c.nombre}
          </label>
        ))}
      </fieldset>
      {cierraSesiones && <p className="nota">Al guardar se cerrarán las sesiones abiertas de este usuario.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function FormPassword({ u, alCancelar, alTerminar }: FormProps & { u: Usuario }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post(`/usuarios/${u.id}/password`, { password });
      alTerminar(`Contraseña de ${u.nombre} restablecida y sus sesiones cerradas.`);
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  }

  return (
    <form className="panel" onSubmit={enviar}>
      <h2>Nueva contraseña para {u.nombre}</h2>
      <label>Contraseña nueva
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
        <small className="nota">Mínimo 8 caracteres. Se cerrarán sus sesiones y se levantará cualquier bloqueo.</small>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Restablecer contraseña'}</button>
        <button type="button" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
