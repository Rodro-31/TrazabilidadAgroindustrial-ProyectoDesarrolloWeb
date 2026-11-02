import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';

const textoError = (e: unknown) => {
  const err = e as ApiError;
  if (err.status === 0) return 'No hay conexión con el servidor.';
  if (err.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  return err.errores?.length ? `${err.message}: ${err.errores.join('; ')}` : err.message;
};

// Paso 1: la persona escribe su correo y recibe el enlace (si la cuenta existe).
export function Recuperar() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/auth/recuperar', { email: email.trim() });
      setEnviado(true);
    } catch (err) {
      setError(textoError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <img src="/icon-192.png" alt="" width={72} height={72} className="logo" />
      <h1>Recuperar contraseña</h1>
      {enviado ? (
        <>
          <p className="aviso" role="status">
            Si el correo está registrado, te llegará un enlace para crear una contraseña nueva. Vence en 30 minutos y
            sirve una sola vez.
          </p>
          <p className="nota">¿No llega? Pide al administrador que te genere el enlace desde la pantalla Usuarios.</p>
        </>
      ) : (
        <form onSubmit={enviar}>
          <label>
            Correo
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
      <p className="enlace-login"><Link to="/">Volver a iniciar sesión</Link></p>
    </main>
  );
}

// El token viene después de "#t=" para que no se envíe al servidor ni quede en logs.
function tokenDelEnlace(): string {
  const valor = new URLSearchParams(location.hash.slice(1)).get('t') ?? '';
  // Se quita de la barra de direcciones para que no quede a la vista ni en el historial.
  if (location.hash) history.replaceState(null, '', location.pathname);
  return valor;
}

// Paso 2: con el enlace, la persona fija su contraseña nueva.
export function Restablecer() {
  const [token] = useState(tokenDelEnlace);
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/auth/restablecer', { token, password });
      setListo(true);
    } catch (err) {
      setError(textoError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <img src="/icon-192.png" alt="" width={72} height={72} className="logo" />
      <h1>Contraseña nueva</h1>
      {listo ? (
        <p className="aviso" role="status">
          Listo. Ya puedes iniciar sesión con tu contraseña nueva en el panel o en la app de campo. Las sesiones que
          tenías abiertas se cerraron.
        </p>
      ) : !token ? (
        <p className="error" role="alert">El enlace está incompleto. Ábrelo de nuevo desde el correo o pide uno nuevo.</p>
      ) : (
        <form onSubmit={enviar}>
          <label>
            Contraseña nueva
            <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Repite la contraseña
            <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </label>
          <small className="nota">Mínimo 8 caracteres.</small>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
      <p className="enlace-login">
        {listo || !token ? <Link to="/">Ir a iniciar sesión</Link> : <Link to="/recuperar">Pedir un enlace nuevo</Link>}
      </p>
    </main>
  );
}
