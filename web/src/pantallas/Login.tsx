import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await entrar(email.trim(), password);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.status === 0 ? 'No hay conexión con el servidor.' : apiErr.message);
      setCargando(false);
    }
  }

  return (
    <main className="login">
      <img src="/icon-192.png" alt="" width={72} height={72} className="logo" />
      <h1>Trazabilidad agroindustrial</h1>
      <p className="sub">Administración</p>
      <form onSubmit={enviar}>
        <label>
          Correo
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primario" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="enlace-login"><Link to="/recuperar">¿Olvidaste tu contraseña?</Link></p>
    </main>
  );
}
