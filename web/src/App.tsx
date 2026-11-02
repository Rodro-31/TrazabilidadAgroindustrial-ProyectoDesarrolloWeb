import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './componentes/Layout';
import Inicio from './pantallas/Inicio';
import Login from './pantallas/Login';
import { Recuperar, Restablecer } from './pantallas/Recuperar';
import { MODULOS } from './modulos';

function Rutas() {
  const { sesion } = useAuth();
  if (!sesion) {
    // Sin sesión todo lleva al login (y al entrar se vuelve a la pantalla de inicio).
    return (
      <Routes>
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/restablecer" element={<Restablecer />} />
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        {MODULOS.map((m) => (
          <Route
            key={m.ruta}
            path={m.ruta}
            element={m.roles.includes(sesion.rol) ? m.pantalla : <Navigate to="/" replace />}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rutas />
      </AuthProvider>
    </BrowserRouter>
  );
}
