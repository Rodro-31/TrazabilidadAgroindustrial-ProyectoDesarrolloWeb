import { FormEvent, useState } from 'react';
import { ApiError, iniciarSesion, type Sesion } from '../api';

export default function Login({ alEntrar }: { alEntrar: (s: Sesion) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      alEntrar(await iniciarSesion(email.trim(), password));
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 0 ? 'No hay conexión. Para iniciar sesión se necesita internet.' : e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login">
      <img src="/icon-192.png" alt="" width={72} height={72} className="logo" />
      <h1>Trazabilidad de campo</h1>
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
        <button className="primario" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
