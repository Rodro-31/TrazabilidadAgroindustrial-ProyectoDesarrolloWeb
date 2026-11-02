import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { modulosDe } from '../modulos';
import Dashboard from './Dashboard';

// Los mismos roles que GET /dashboard en la API (CAMPO trabaja en la PWA).
const ROLES_DASHBOARD = ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR'];

export default function Inicio() {
  const { sesion } = useAuth();
  const modulos = modulosDe(sesion!.rol);

  return (
    <section>
      <h1>Inicio</h1>
      {ROLES_DASHBOARD.includes(sesion!.rol) && <Dashboard />}

      <h2 className="subtitulo">Módulos</h2>
      <div className="tarjetas">
        {modulos.map((m) => (
          <Link key={m.ruta} to={`/${m.ruta}`} className="tarjeta">
            <strong>{m.titulo}</strong>
            <span>{m.descripcion}</span>
          </Link>
        ))}
        {modulos.length === 0 && <p>Tu rol no tiene módulos en la web de administración. Usa la app de campo.</p>}
      </div>
    </section>
  );
}
