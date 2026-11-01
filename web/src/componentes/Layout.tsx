import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { modulosDe } from '../modulos';

export default function Layout() {
  const { sesion, salir } = useAuth();
  const modulos = modulosDe(sesion!.rol);

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">Trazabilidad</div>
        <nav>
          <NavLink to="/" end>Inicio</NavLink>
          {modulos.map((m) => (
            <NavLink key={m.ruta} to={`/${m.ruta}`}>{m.titulo}</NavLink>
          ))}
        </nav>
        <div className="usuario">
          <span>Rol: <strong>{sesion!.rol}</strong></span>
          <button onClick={() => void salir()}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
